/**
 * Stage 56 ★: phase criterion — the PayPal core runs END-TO-END with ZERO manual
 * intervention: create -> send -> record payment (PayPal fires INVOICE.PAID itself)
 * -> payments row -> reconciliation MATCHED.
 * The run is scripted for screen recording (evidence MP4, <=60s).
 * Run: npm run stage56
 */
import { getDb } from "../src/db.ts";
import {
	createDraftInvoice,
	parseToolResult,
	recordExternalPayment,
	sendInvoice,
} from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";
import { reconcilePending } from "../src/reconcile.ts";

const tools = createPaypalToolkit().getTools();
const db = getDb();
const exec = (t: unknown) =>
	t as { execute: (a: unknown, o: unknown) => Promise<string> };
const NUM = String((Date.now() % 9000) + 1000); // fresh 4-digit per run
const AMOUNT = "63.33";
const t0 = Date.now();
const step = (s: string) =>
	console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

// Cleanup from previous runs.
db.prepare(
	`DELETE FROM reconciliation_records WHERE payment_id IN (SELECT id FROM payments WHERE raw_json LIKE '%${NUM}%')`,
).run();
db.prepare(`DELETE FROM payments WHERE raw_json LIKE '%${NUM}%'`).run();

step(`STEP 1/5 create invoice #${NUM} $${AMOUNT}`);
const listed = parseToolResult(
	await exec(tools.list_invoices).execute(
		{ page: 1, page_size: 20 },
		{ toolCallId: "find", messages: [] },
	),
) as { items?: Array<{ id?: string; detail?: { invoice_number?: string } }> };
const existing = listed.items?.find(
	(i) => i.detail?.invoice_number === NUM,
)?.id;
if (existing) {
	throw new Error(
		`invoice #${NUM} already exists from a previous run; bump the number`,
	);
}
const createdRec = await createDraftInvoice(tools, {
	buyerEmail: process.env.SANDBOX_BUYER_EMAIL as string,
	itemName: "Stage 56 zero-touch core run",
	amount: AMOUNT,
	note: "E2E without human intervention (stage 56)",
	invoiceNumber: NUM,
});
const id = createdRec.id;
if (!id)
	throw new Error(`no invoice id: ${JSON.stringify(createdRec).slice(0, 120)}`);
step(`created ${id}`);

step("STEP 2/5 send invoice");
await sendInvoice(tools, id, "auto-run (stage 56)");
step("sent ✓");

step("STEP 3/5 record external payment (PayPal state change)");
await recordExternalPayment(tools, id, AMOUNT, "USD", "zero-touch auto run");
step("recorded ✓ — waiting for PayPal INVOICE.PAID webhook");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let paymentRow: { id: number; paypal_payment_id: string } | undefined;
for (let i = 0; i < 45; i++) {
	await sleep(2000);
	const rows = db
		.prepare(
			`SELECT p.id, p.paypal_payment_id FROM payments p
       WHERE p.raw_json LIKE ? AND p.source='webhook' LIMIT 1`,
		)
		.all(`%"invoice_number":"${NUM}"%`) as Array<{
		id: number;
		paypal_payment_id: string;
	}>;
	if (rows[0]) {
		paymentRow = rows[0];
		break;
	}
}
if (!paymentRow) throw new Error("no payments row within 90s");
step(`STEP 4/5 payments row ${paymentRow.paypal_payment_id} (webhook)`);

step("STEP 5/5 reconcile");
await reconcilePending(tools, db);
const recon = db
	.prepare(
		`SELECT r.status, r.variance_minor v FROM reconciliation_records r
     WHERE r.payment_id = ? ORDER BY r.id DESC LIMIT 1`,
	)
	.get(paymentRow.id) as { status: string; v: number } | undefined;

const inv = parseToolResult(
	await exec(tools.get_invoice).execute(
		{ invoice_id: id },
		{ toolCallId: "final", messages: [] },
	),
) as { status?: string };

console.log("────────────────────────────────────────");
console.log(`invoice: ${id} | status: ${inv.status}`);
console.log(`reconciliation: ${recon?.status} | variance: ${recon?.v}`);
console.log(
	`total time: ${((Date.now() - t0) / 1000).toFixed(1)}s | NO human input after start`,
);
if (
	(inv.status !== "PAID" && inv.status !== "MARKED_AS_PAID") ||
	recon?.status !== "MATCHED" ||
	recon.v !== 0
) {
	throw new Error("E2E criterion failed");
}
console.log("STAGE 56 OK: zero-touch core run PASSED");
