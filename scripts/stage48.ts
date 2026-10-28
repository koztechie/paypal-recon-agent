/**
 * Stage 48 marker: 3 discrepancy edge-case categories handled with correct statuses.
 *  E1 partial payment: $80 invoice, $30 recorded -> PARTIALLY_PAID + REVIEW variance
 *  E2 multi-currency both directions (USD->EUR, EUR->USD) -> REVIEW, no FX guessing
 *  E3 commission/fee: gross-based matching (fee must NOT create false variance)
 * Run: npm run stage48
 */
import { getDb } from "../src/db.ts";
import { parseToolResult } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";
import { reconcilePending } from "../src/reconcile.ts";

const tools = createPaypalToolkit().getTools();
const db = getDb();

db.prepare(
	"DELETE FROM reconciliation_records WHERE payment_id IN (SELECT id FROM payments WHERE paypal_payment_id LIKE 'QA-E%')",
).run();
db.prepare("DELETE FROM payments WHERE paypal_payment_id LIKE 'QA-E%'").run();

const exec = (t: unknown) =>
	t as { execute: (a: unknown, o: unknown) => Promise<unknown> };

async function ensureInvoice(
	num: string,
	amount: string,
	currency: string,
	item: string,
) {
	const listed = parseToolResult(
		await exec(tools.list_invoices).execute(
			{ page: 1, page_size: 20 },
			{ toolCallId: `f-${num}`, messages: [] },
		),
	) as { items?: Array<{ id?: string; detail?: { invoice_number?: string } }> };
	const found = listed.items?.find((i) => i.detail?.invoice_number === num)?.id;
	if (found) return found;
	const created = parseToolResult(
		await exec(tools.create_invoice).execute(
			{
				currency_code: currency,
				invoice_number: num,
				note: `stage 48 edge-case #${num}`,
				primary_recipients: [
					{ billing_info: { email_address: process.env.SANDBOX_BUYER_EMAIL } },
				],
				items: [
					{
						name: item,
						quantity: "1",
						unit_amount: { currency_code: currency, value: amount },
					},
				],
			},
			{ toolCallId: `c-${num}`, messages: [] },
		),
	) as { href?: string };
	const id = (created.href ?? "").split("/").pop() as string;
	await exec(tools.send_invoice).execute(
		{ invoice_id: id, send_to_recipient: true },
		{ toolCallId: `s-${num}`, messages: [] },
	);
	return id;
}

function addPayment(
	id: string,
	currency: string,
	dollars: string,
	fee: string,
	ref?: Record<string, unknown>,
) {
	const minor = Math.round(parseFloat(dollars) * 100);
	const feeMinor = Math.round(parseFloat(fee) * 100);
	db.prepare(
		`INSERT INTO payments (paypal_payment_id, currency, amount_minor, fee_minor, net_minor, status, source, received_at, raw_json)
     VALUES (?, ?, ?, ?, ?, 'COMPLETED', 'local_import', datetime('now'), ?)`,
	).run(
		id,
		currency,
		minor,
		feeMinor,
		minor - feeMinor,
		JSON.stringify({ qa_edge: id, ...ref }),
	);
}

// ---- E1: partial payment --------------------------------------------------
const e1 = await ensureInvoice("9101", "80.00", "USD", "Edge: partial payment");
// Record a $30 external payment against it (PayPal-side partial status).
await exec(tools.record_payment_for_invoice).execute(
	{
		invoice_id: e1,
		payment_date: "2026-10-28",
		method: "CASH",
		amount: { currency_code: "USD", value: "30.00" },
	},
	{ toolCallId: "rec-30", messages: [] },
);
const e1state = parseToolResult(
	await exec(tools.get_invoice).execute(
		{ invoice_id: e1 },
		{ toolCallId: "get-e1", messages: [] },
	),
) as { status?: string };
addPayment("QA-E1a", "USD", "30.00", "0", { invoice_number: "9101" });
addPayment("QA-E1b", "USD", "50.00", "0", { invoice_number: "9101" }); // second leg

// ---- E2: multi-currency, both directions ----------------------------------
const e2a = await ensureInvoice(
	"9102",
	"60.00",
	"USD",
	"Edge: USD invoice vs EUR payment",
);
addPayment("QA-E2a", "EUR", "60.00", "0", { invoice_number: "9102" });
const e2b = await ensureInvoice(
	"9103",
	"40.00",
	"EUR",
	"Edge: EUR invoice vs USD payment",
);
addPayment("QA-E2b", "USD", "40.00", "0", { invoice_number: "9103" });

// ---- E3: commission/fee must not break gross matching ---------------------
const e3 = await ensureInvoice("9104", "20.00", "USD", "Edge: fee/commission");
addPayment("QA-E3", "USD", "20.00", "0.88", { invoice_number: "9104" });

console.log("payments inserted: 6 | invoices:", e1, e2a, e2b, e3);

// ---- Reconcile + assert ---------------------------------------------------
await reconcilePending(tools, db);

const rows = db
	.prepare(
		`SELECT p.paypal_payment_id pid, p.fee_minor fee, r.status, r.variance_minor v, r.reason reason
     FROM reconciliation_records r JOIN payments p ON p.id = r.payment_id
     WHERE p.paypal_payment_id LIKE 'QA-E%' ORDER BY p.paypal_payment_id`,
	)
	.all() as Array<{
	pid: string;
	fee: number;
	status: string;
	v: number;
	reason: string | null;
}>;

type Expect = { status: string; variance?: number; reasonIncludes?: string };
const expected: Record<string, Expect> = {
	"QA-E1a": { status: "REVIEW", variance: -5000, reasonIncludes: "variance" },
	"QA-E1b": { status: "REVIEW", variance: -3000, reasonIncludes: "variance" },
	"QA-E2a": {
		status: "REVIEW",
		reasonIncludes: "currency mismatch: payment EUR vs invoice USD",
	},
	"QA-E2b": {
		status: "REVIEW",
		reasonIncludes: "currency mismatch: payment USD vs invoice EUR",
	},
	"QA-E3": { status: "MATCHED", variance: 0 },
};

const checks: Array<[string, boolean]> = [];
checks.push([
	"E1 invoice status PARTIALLY_PAID",
	e1state.status === "PARTIALLY_PAID",
]);
for (const r of rows) {
	const e = expected[r.pid];
	if (!e) continue;
	const okStatus = r.status === e.status;
	const okVar = e.variance === undefined || r.v === e.variance;
	const okReason =
		e.reasonIncludes === undefined ||
		(r.reason ?? "").includes(e.reasonIncludes);
	checks.push([
		`${r.pid}: ${r.status} (var=${r.v})`,
		okStatus && okVar && okReason,
	]);
	if (r.pid === "QA-E3")
		checks.push(["E3 fee preserved, net = gross - fee", r.fee === 88]);
}
checks.push(["all 5 recon rows created", rows.length === 5]);

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} edge-case checks passed`);
if (pass !== checks.length)
	throw new Error(`QA FAILED: ${pass}/${checks.length}`);
console.log("STAGE 48 OK: partial/multi-currency/fee — statuses correct");
