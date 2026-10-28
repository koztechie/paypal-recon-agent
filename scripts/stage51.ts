/**
 * Stage 51 ★: E2E scenario №1 — create -> send -> PAY (user, one click) -> reconcile.
 * This script: creates+sends invoice #9301 ($43.50), prints the pay link, then waits
 * for the INVOICE.PAID webhook -> payments row -> reconciliation MATCHED.
 * Run: npm run stage51   (re-run safe: it resumes waiting for the same invoice)
 */

import { getDb } from "../src/db.ts";
import { parseToolResult } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";
import { reconcilePending } from "../src/reconcile.ts";

const tools = createPaypalToolkit().getTools();
const db = getDb();
const exec = (t: unknown) =>
	t as { execute: (a: unknown, o: unknown) => Promise<string> };

// 1) Find or create invoice #9301 with a UNIQUE amount ($43.50).
const listed = parseToolResult(
	await exec(tools.list_invoices).execute(
		{ page: 1, page_size: 20 },
		{ toolCallId: "find", messages: [] },
	),
) as {
	items?: Array<{
		id?: string;
		status?: string;
		detail?: { invoice_number?: string };
		metadata?: Record<string, unknown>;
	}>;
};

let invoiceId = listed.items?.find(
	(i) => i.detail?.invoice_number === "9301",
)?.id;
let payUrl: string | undefined;
if (!invoiceId) {
	const created = parseToolResult(
		await exec(tools.create_invoice).execute(
			{
				currency_code: "USD",
				invoice_number: "9301",
				note: "E2E #1: create -> send -> pay -> reconcile",
				primary_recipients: [
					{ billing_info: { email_address: process.env.SANDBOX_BUYER_EMAIL } },
				],
				items: [
					{
						name: "E2E retainer (stage 51)",
						quantity: "1",
						unit_amount: { currency_code: "USD", value: "43.50" },
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

// Pay link for the user.
const full = parseToolResult(
	await exec(tools.get_invoice).execute(
		{ invoice_id: invoiceId },
		{ toolCallId: "get", messages: [] },
	),
) as {
	status?: string;
	detail?: { metadata?: { recipient_view_url?: string } };
};
payUrl = full.detail?.metadata?.recipient_view_url;
console.log(`PAY_URL=${payUrl}`);
console.log(`STATUS=${full.status}`);

if (full.status === "PAID" || full.status === "MARKED_AS_PAID") {
	console.log("already paid — skipping wait");
} else {
	console.log(`\n>>> ВІДКРИЙ ЦЕ ПОСИЛАННЯ І НАТИСНИ Pay Now: ${payUrl}`);
	console.log(">>> чекаю webhook до 10 хв...");
}

// 2) Wait for payments row from the INVOICE.PAID webhook, then reconcile.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let paymentRow: { id: number; paypal_payment_id: string } | undefined;
for (let i = 0; i < 60; i++) {
	await sleep(10000);
	const rows = db
		.prepare(
			`SELECT p.id, p.paypal_payment_id FROM payments p
       WHERE p.raw_json LIKE '%"invoice_number":"9301"%' AND p.source='webhook'
       LIMIT 1`,
		)
		.all() as Array<{ id: number; paypal_payment_id: string }>;
	if (rows[0]) {
		paymentRow = rows[0];
		console.log(
			`payments row appeared after ~${(i + 1) * 10}s:`,
			paymentRow.paypal_payment_id,
		);
		break;
	}
	// Also stop early if invoice got paid but row lags.
	const st = parseToolResult(
		await exec(tools.get_invoice).execute(
			{ invoice_id: invoiceId },
			{ toolCallId: "poll", messages: [] },
		),
	) as { status?: string };
	if (st.status === "PAID")
		console.log("invoice PAID; waiting for payments row...");
}
if (!paymentRow)
	throw new Error("timeout: no payments row for invoice #9301 within 10 min");

// 3) Reconcile (incremental: only unreconciled payments).
await reconcilePending(tools, db);

const recon = db
	.prepare(
		`SELECT r.status, r.match_method m, r.variance_minor v, r.ai_explanation e
     FROM reconciliation_records r WHERE r.payment_id = ? ORDER BY r.id DESC LIMIT 1`,
	)
	.get(paymentRow.id) as
	| { status: string; m: string | null; v: number; e: string }
	| undefined;
console.log("reconciliation:", JSON.stringify(recon));

const invStatus = parseToolResult(
	await exec(tools.get_invoice).execute(
		{ invoice_id: invoiceId },
		{ toolCallId: "final", messages: [] },
	),
) as { status?: string };

const checks: Array<[string, boolean]> = [
	["invoice #9301 status PAID", invStatus.status === "PAID"],
	["payments row from webhook", Boolean(paymentRow)],
	["reconciliation MATCHED", recon?.status === "MATCHED"],
	["variance 0", recon?.v === 0],
	["ai_explanation present", Boolean(recon?.e && recon.e.length > 20)],
];
let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} E2E checks passed`);
if (pass !== checks.length)
	throw new Error(`E2E FAILED: ${pass}/${checks.length}`);
console.log("STAGE 51 OK: E2E #1 create->send->pay->reconcile passed");
