/**
 * Stage 47 marker: auto-reconciliation 5/5 test pairs.
 * Policy check: MATCH only on exact number+amount+currency (stage-19 rules).
 * Run: npm run stage47
 */
import { getDb } from "../src/db.ts";
import { parseToolResult } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";
import { type ReconStatus, reconcilePending } from "../src/reconcile.ts";

const tools = createPaypalToolkit().getTools();
const db = getDb();

// Idempotency: clear QA leftovers from previous runs.
db.prepare(
	"DELETE FROM reconciliation_records WHERE payment_id IN (SELECT id FROM payments WHERE paypal_payment_id LIKE 'QA-P%')",
).run();
db.prepare("DELETE FROM payments WHERE paypal_payment_id LIKE 'QA-P%'").run();
db.prepare(
	"DELETE FROM reconciliation_records WHERE invoice_id IN (SELECT id FROM invoices WHERE paypal_invoice_id LIKE 'INV2-TEST-%')",
).run();

// 1) Three test invoices with fixed numbers (reused if the run already created them).
async function makeInvoice(
	invoiceNumber: string,
	amount: string,
	currency: string,
	itemName: string,
) {
	const listed = parseToolResult(
		await (
			tools.list_invoices as unknown as {
				execute: (a: unknown, o: unknown) => Promise<unknown>;
			}
		).execute(
			{ page: 1, page_size: 20 },
			{ toolCallId: `find-${invoiceNumber}`, messages: [] },
		),
	) as { items?: Array<{ id?: string; detail?: { invoice_number?: string } }> };
	const existing = listed.items?.find(
		(i) => i.detail?.invoice_number === invoiceNumber,
	)?.id;
	if (existing) {
		console.log(`invoice #${invoiceNumber} reused:`, existing);
		return existing;
	}
	const result = parseToolResult(
		await (
			tools.create_invoice as unknown as {
				execute: (a: unknown, o: unknown) => Promise<unknown>;
			}
		).execute(
			{
				currency_code: currency,
				invoice_number: invoiceNumber,
				note: `stage 47 reconciliation test #${invoiceNumber}`,
				primary_recipients: [
					{ billing_info: { email_address: process.env.SANDBOX_BUYER_EMAIL } },
				],
				items: [
					{
						name: itemName,
						quantity: "1",
						unit_amount: { currency_code: currency, value: amount },
					},
				],
			},
			{ toolCallId: `mk-${invoiceNumber}`, messages: [] },
		),
	);
	const href = (result as { href?: string }).href ?? "";
	return href.split("/").pop() as string;
}

const inv9001 = await makeInvoice(
	"9001",
	"30.00",
	"USD",
	"Recon test: exact match",
);
const inv9002 = await makeInvoice(
	"9002",
	"40.00",
	"USD",
	"Recon test: underpayment",
);
const inv9003 = await makeInvoice(
	"9003",
	"50.00",
	"EUR",
	"Recon test: currency pair",
);
console.log("invoices created:", inv9001, inv9002, inv9003);

// Send them: amount+currency matching only applies to open (SENT) invoices.
for (const id of [inv9001, inv9002, inv9003]) {
	const r = parseToolResult(
		await (
			tools.send_invoice as unknown as {
				execute: (a: unknown, o: unknown) => Promise<unknown>;
			}
		).execute(
			{ invoice_id: id, send_to_recipient: true },
			{ toolCallId: `send-${id}`, messages: [] },
		),
	);
	if ("error" in (r as Record<string, unknown>))
		throw new Error(`send failed: ${JSON.stringify(r)}`);
}
console.log("invoices sent ✓");

// 2) Five synthetic incoming payments (as if imported from webhooks/bank feed).
function addPayment(
	id: string,
	currency: string,
	dollars: string,
	extra: Record<string, unknown>,
) {
	const minor = Math.round(parseFloat(dollars) * 100);
	db.prepare(
		`INSERT INTO payments (paypal_payment_id, currency, amount_minor, fee_minor, net_minor, status, source, received_at, raw_json)
     VALUES (?, ?, ?, 0, ?, 'COMPLETED', 'local_import', datetime('now'), ?)`,
	).run(id, currency, minor, minor, JSON.stringify({ qa_pair: id, ...extra }));
}
addPayment("QA-P1", "USD", "30.00", { invoice_number: "9001" }); // exact
addPayment("QA-P2", "USD", "35.00", { invoice_number: "9002" }); // underpay -> REVIEW
addPayment("QA-P3", "EUR", "50.00", {}); // unique amount+currency -> MATCHED
addPayment("QA-P4", "USD", "50.00", { invoice_number: "9003" }); // currency mismatch -> REVIEW
addPayment("QA-P5", "USD", "55.00", {}); // nothing -> UNMATCHED
console.log("payments inserted: 5");

// 3) Reconcile.
await reconcilePending(tools, db);

const rows = db
	.prepare(
		`SELECT p.paypal_payment_id pid, r.status, r.match_method m, r.variance_minor v, r.reason reason
     FROM reconciliation_records r JOIN payments p ON p.id = r.payment_id
     WHERE p.paypal_payment_id LIKE 'QA-P%' ORDER BY p.paypal_payment_id`,
	)
	.all() as {
	pid: string;
	status: ReconStatus;
	m: string | null;
	v: number;
	reason: string | null;
}[];

const expected: Record<string, ReconStatus> = {
	"QA-P1": "MATCHED",
	"QA-P2": "REVIEW",
	"QA-P3": "MATCHED",
	"QA-P4": "REVIEW",
	"QA-P5": "UNMATCHED",
};

let pass = 0;
for (const r of rows) {
	const ok = r.status === expected[r.pid];
	console.log(
		`${ok ? "✓" : "✗"} ${r.pid}: ${r.status} (method=${r.m ?? "-"}, variance=${r.v}${r.reason ? `, ${r.reason}` : ""})`,
	);
	if (ok) pass++;
}
console.log(
	`\n${pass}/${Object.keys(expected).length} reconciliation pairs correct`,
);
if (pass !== 5) throw new Error(`expected 5/5, got ${pass}/5`);
console.log("STAGE 47 OK: auto-reconciliation 5/5");
