/**
 * Stage 53: E2E №3 — partial payment -> discrepancy -> MANUAL resolution.
 * Run: npm run stage53   (re-run safe)
 */
import { getDb } from "../src/db.ts";
import { parseToolResult, recordExternalPayment } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";
import { reconcilePending, resolveReconciliation } from "../src/reconcile.ts";

const tools = createPaypalToolkit().getTools();
const db = getDb();
const exec = (t: unknown) =>
	t as { execute: (a: unknown, o: unknown) => Promise<string> };
const NUM = "9501";
const TOTAL = "75.00";
const FIRST = "40.00";
const REST = "35.00";

// Cleanup previous runs of this scenario.
db.prepare(
	"DELETE FROM reconciliation_records WHERE payment_id IN (SELECT id FROM payments WHERE paypal_payment_id LIKE 'QA-R3%')",
).run();
db.prepare("DELETE FROM payments WHERE paypal_payment_id LIKE 'QA-R3%'").run();

// 1) Invoice #9501 $75 (find-or-create) + send.
const listed = parseToolResult(
	await exec(tools.list_invoices).execute(
		{ page: 1, page_size: 20 },
		{ toolCallId: "find", messages: [] },
	),
) as { items?: Array<{ id?: string; detail?: { invoice_number?: string } }> };
let invoiceId = listed.items?.find((i) => i.detail?.invoice_number === NUM)?.id;
if (!invoiceId) {
	const created = parseToolResult(
		await exec(tools.create_invoice).execute(
			{
				currency_code: "USD",
				invoice_number: NUM,
				note: "E2E #3: partial -> discrepancy -> manual resolution",
				primary_recipients: [
					{ billing_info: { email_address: process.env.SANDBOX_BUYER_EMAIL } },
				],
				items: [
					{
						name: "E2E #3 project fee (stage 53)",
						quantity: "1",
						unit_amount: { currency_code: "USD", value: TOTAL },
					},
				],
			},
			{ toolCallId: "mk", messages: [] },
		),
	) as { href?: string };
	invoiceId = (created.href ?? "").split("/").pop() as string;
	await exec(tools.send_invoice).execute(
		{ invoice_id: invoiceId, send_to_recipient: true },
		{ toolCallId: "send", messages: [] },
	);
	console.log("invoice created + sent:", invoiceId);
} else {
	console.log("invoice exists:", invoiceId);
}

// 2) PARTIAL external payment $40 (guarded wrapper).
await recordExternalPayment(
	tools,
	invoiceId,
	FIRST,
	"USD",
	"Partial payment (E2E #3)",
);
const afterPartial = parseToolResult(
	await exec(tools.get_invoice).execute(
		{ invoice_id: invoiceId },
		{ toolCallId: "get1", messages: [] },
	),
) as { status?: string };
console.log("after partial $40:", afterPartial.status);

// 3) Incoming payment row -> reconciliation => REVIEW (discrepancy).
db.prepare(
	`INSERT INTO payments (paypal_payment_id, currency, amount_minor, fee_minor, net_minor, status, source, received_at, raw_json)
   VALUES ('QA-R3-1', 'USD', 4000, 0, 4000, 'COMPLETED', 'local_import', datetime('now'), ?)`,
).run(JSON.stringify({ qa_edge: "QA-R3-1", invoice_number: NUM }));
await reconcilePending(tools, db);

const reconRow = db
	.prepare(
		`SELECT r.id, r.status, r.variance_minor v FROM reconciliation_records r
     JOIN payments p ON p.id = r.payment_id WHERE p.paypal_payment_id = 'QA-R3-1'`,
	)
	.get() as { id: number; status: string; v: number } | undefined;
console.log("recon after partial:", JSON.stringify(reconRow));

// 4) MANUAL resolution (human decision: accept the shortfall as final).
resolveReconciliation(
	db,
	reconRow?.id ?? -1,
	"Seller accepted short payment of $35 as final settlement (stage 53 human decision)",
);
const resolved = db
	.prepare(
		`SELECT status, match_method m, resolution res, resolved_at ra, decided_by by, variance_minor v, ai_explanation e
     FROM reconciliation_records WHERE id = ?`,
	)
	.get(reconRow?.id ?? -1) as
	| {
			status: string;
			m: string;
			res: string;
			ra: string;
			by: string;
			v: number;
			e: string;
	  }
	| undefined;
console.log("resolved:", JSON.stringify(resolved).slice(0, 160));

// 5) Money side closes: record the remaining $35.
await recordExternalPayment(
	tools,
	invoiceId,
	REST,
	"USD",
	"Final balance (E2E #3)",
);
const finalInv = parseToolResult(
	await exec(tools.get_invoice).execute(
		{ invoice_id: invoiceId },
		{ toolCallId: "get2", messages: [] },
	),
) as { status?: string };
console.log("final invoice status:", finalInv.status);

const checks: Array<[string, boolean]> = [
	[
		"partial -> invoice PARTIALLY_PAID",
		afterPartial.status === "PARTIALLY_PAID",
	],
	[
		"discrepancy -> recon REVIEW variance -3500",
		reconRow?.status === "REVIEW" && reconRow.v === -3500,
	],
	[
		"resolution recorded (text + resolved_at)",
		Boolean(resolved?.res?.includes("stage 53") && resolved.ra),
	],
	[
		"decided_by=human, method=manual, variance preserved",
		resolved?.by === "human" && resolved.m === "manual" && resolved.v === -3500,
	],
	[
		"money side closed (invoice paid after balance)",
		finalInv.status === "MARKED_AS_PAID" || finalInv.status === "PAID",
	],
];
let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} E2E#3 checks passed`);
if (pass !== checks.length)
	throw new Error(`E2E#3 FAILED: ${pass}/${checks.length}`);
console.log(
	"STAGE 53 OK: E2E #3 partial -> discrepancy -> manual resolution passed",
);
