/**
 * Stage 52: E2E №2 — create -> send -> REMIND -> pay (user, one click) -> reconcile.
 * Run: npm run stage52   (re-run safe)
 */
import { existsSync, readFileSync } from "node:fs";
import { getDb } from "../src/db.ts";
import { checkReminderAllowed, parseToolResult } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";
import { reconcilePending } from "../src/reconcile.ts";

const tools = createPaypalToolkit().getTools();
const db = getDb();
const exec = (t: unknown) =>
	t as { execute: (a: unknown, o: unknown) => Promise<string> };
const INVOICE_NUMBER = "9401";
const AMOUNT = "52.25"; // unique

// 1) Find or create invoice #9401.
const listed = parseToolResult(
	await exec(tools.list_invoices).execute(
		{ page: 1, page_size: 20 },
		{ toolCallId: "find", messages: [] },
	),
) as { items?: Array<{ id?: string; detail?: { invoice_number?: string } }> };
let invoiceId = listed.items?.find(
	(i) => i.detail?.invoice_number === INVOICE_NUMBER,
)?.id;
if (!invoiceId) {
	const created = parseToolResult(
		await exec(tools.create_invoice).execute(
			{
				currency_code: "USD",
				invoice_number: INVOICE_NUMBER,
				note: "E2E #2: reminder -> pay -> reconcile",
				primary_recipients: [
					{ billing_info: { email_address: process.env.SANDBOX_BUYER_EMAIL } },
				],
				items: [
					{
						name: "E2E #2 retainer (stage 52)",
						quantity: "1",
						unit_amount: { currency_code: "USD", value: AMOUNT },
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

// 2) REMINDER step (the distinguishing feature of E2E #2; rate-limit aware).
const gate = checkReminderAllowed(invoiceId);
console.log("reminder gate:", gate.reason);
if (gate.allowed) {
	const r = parseToolResult(
		await exec(tools.send_invoice_reminder).execute(
			{ invoice_id: invoiceId, note: "Friendly E2E #2 reminder (stage 52)" },
			{ toolCallId: "remind", messages: [] },
		),
	);
	console.log("reminder sent ✓", JSON.stringify(r).slice(0, 60));
} else {
	console.log(
		"reminder skipped by rate limit (already reminded in this window)",
	);
}

const full = parseToolResult(
	await exec(tools.get_invoice).execute(
		{ invoice_id: invoiceId },
		{ toolCallId: "get", messages: [] },
	),
) as {
	status?: string;
	detail?: { metadata?: { recipient_view_url?: string } };
};
const payUrl = full.detail?.metadata?.recipient_view_url;
console.log(`STATUS=${full.status}`);
console.log(`PAY_URL=${payUrl}`);
if (full.status !== "PAID" && full.status !== "MARKED_AS_PAID") {
	console.log(`\n>>> ТВІЙ КРОК: відкрий і натисни Pay Now: ${payUrl}`);
}

// 3) Wait for payments row -> reconcile.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let paymentRow: { id: number; paypal_payment_id: string } | undefined;
for (let i = 0; i < 60; i++) {
	await sleep(10000);
	const rows = db
		.prepare(
			`SELECT p.id, p.paypal_payment_id FROM payments p
       WHERE p.raw_json LIKE ? AND p.source='webhook' LIMIT 1`,
		)
		.all(`%"invoice_number":"${INVOICE_NUMBER}"%`) as Array<{
		id: number;
		paypal_payment_id: string;
	}>;
	if (rows[0]) {
		paymentRow = rows[0];
		console.log(
			`payments row after ~${(i + 1) * 10}s:`,
			paymentRow.paypal_payment_id,
		);
		break;
	}
}
if (!paymentRow)
	throw new Error(`timeout: no payments row for #${INVOICE_NUMBER}`);

await reconcilePending(tools, db);
const recon = db
	.prepare(
		`SELECT r.status, r.variance_minor v, r.ai_explanation e FROM reconciliation_records r
     WHERE r.payment_id = ? ORDER BY r.id DESC LIMIT 1`,
	)
	.get(paymentRow.id) as { status: string; v: number; e: string } | undefined;
console.log("reconciliation:", recon?.status, "| variance:", recon?.v);

const invStatus = parseToolResult(
	await exec(tools.get_invoice).execute(
		{ invoice_id: invoiceId },
		{ toolCallId: "final", messages: [] },
	),
) as { status?: string };

const checks: Array<[string, boolean]> = [
	[
		"reminder was executed (ledger)",
		JSON.stringify(readLedger()).includes(invoiceId),
	],
	["invoice PAID", invStatus.status === "PAID"],
	["payments row from webhook", Boolean(paymentRow)],
	[
		"reconciliation MATCHED, variance 0",
		recon?.status === "MATCHED" && recon.v === 0,
	],
	["ai_explanation present", Boolean(recon?.e && recon.e.length > 20)],
];
let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} E2E#2 checks passed`);
if (pass !== checks.length)
	throw new Error(`E2E#2 FAILED: ${pass}/${checks.length}`);
console.log("STAGE 52 OK: E2E #2 remind->pay->reconcile passed");

function readLedger(): Record<string, string[]> {
	if (!existsSync("logs/reminders.json")) return {};
	return JSON.parse(readFileSync("logs/reminders.json", "utf8")) as Record<
		string,
		string[]
	>;
}
