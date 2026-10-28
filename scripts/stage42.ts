/**
 * Stage 42 (auto-reminder path, ADR-012): an invoice with a due date is sent,
 * an automatic reminder is configured 3 days before the due date (fires today),
 * and we wait for INVOICING.INVOICE.AUTOMATIC-REMINDER-SENT in the local log.
 * Run: node --env-file=.env.local scripts/stage42.ts
 */
import { readFileSync } from "node:fs";
import { checkReminderAllowed, parseToolResult } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const logPath = "logs/webhooks.ndjson";
const dueDate = "2026-10-31"; // today + 3 days => BEFORE_DUE(3) computes to today

const countLines = () =>
	readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).length;

// 1) Create a DUE-dated invoice via direct REST (toolkit create has no due-date field).
const cid = process.env.PAYPAL_CLIENT_ID;
const cs = process.env.PAYPAL_CLIENT_SECRET;
const buyer = process.env.SANDBOX_BUYER_EMAIL;
const auth = Buffer.from(`${cid}:${cs}`).toString("base64");

async function rest(
	path: string,
	method: string,
	body?: unknown,
): Promise<Record<string, unknown>> {
	const tokenRes = await fetch(
		"https://api-m.sandbox.paypal.com/v1/oauth2/token",
		{
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: "grant_type=client_credentials",
		},
	);
	const { access_token } = (await tokenRes.json()) as { access_token: string };
	const res = await fetch(`https://api-m.sandbox.paypal.com${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${access_token}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	if (!res.ok)
		throw new Error(
			`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`,
		);
	return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

const created = (await rest("/v2/invoicing/invoices", "POST", {
	primary_recipients: [{ billing_info: { email_address: buyer } }],
	items: [
		{
			name: "Stage 42 auto-reminder test",
			quantity: "1",
			unit_amount: { currency_code: "USD", value: "60.00" },
		},
	],
	detail: {
		currency_code: "USD",
		memo: "stage 42: auto reminder",
		payment_term: { term_type: "DUE_ON_DATE_SPECIFIED", due_date: dueDate },
	},
})) as { href?: string };
const invoiceId = (created.href ?? "").split("/").pop();
if (!invoiceId)
	throw new Error(`no invoice id: ${JSON.stringify(created).slice(0, 200)}`);
console.log("due-dated invoice:", invoiceId, "due:", dueDate);

// 2) Send it (recipient persists via primary_recipients).
await rest(`/v2/invoicing/invoices/${invoiceId}/send`, "POST", {
	send_to_recipient: true,
});
console.log("invoice sent");

// 3) Rate-limit check for the manual reminder path is untouched; auto config:
const tools = createPaypalToolkit().getTools();
const setup = (
	tools.setup_invoice_auto_reminders as unknown as {
		execute: (a: unknown, o: unknown) => Promise<unknown>;
	}
).execute;
const setupResult = parseToolResult(
	await setup(
		{
			configurations: [
				{
					type: "BEFORE_DUE",
					interval: { unit: "DAY", value: 3 },
					repetition: 1,
					notification: { send_to_recipient: true, send_to_invoicer: false },
				},
			],
		},
		{ toolCallId: "setup-auto-reminder", messages: [] },
	),
);
console.log("auto-reminder config:", JSON.stringify(setupResult).slice(0, 220));

// 4) Wait for the reminder event in the local log.
const gate = checkReminderAllowed(invoiceId);
console.log("manual-reminder gate (для довідки):", gate.reason);

const before = countLines();
console.log(`waiting for AUTOMATIC-REMINDER-SENT (log lines ${before})...`);
let after = before;
for (let i = 0; i < 40 && after <= before; i++) {
	await new Promise((r) => setTimeout(r, 15000));
	after = countLines();
	if (after > before)
		console.log(`event arrived after ~${Math.round(((i + 1) * 15) / 60)} min`);
}

const lines = readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean);
console.log(`log lines: ${before} -> ${lines.length}`);
for (const ln of lines.slice(before)) {
	const ev = JSON.parse(ln) as { event_type?: string; received_at?: string };
	console.log("NEW EVENT:", ev.received_at, ev.event_type);
}

const gotReminder = lines
	.slice(before)
	.some(
		(l) =>
			(JSON.parse(l) as { event_type?: string }).event_type ===
			"INVOICING.INVOICE.AUTOMATIC-REMINDER-SENT",
	);

if (!gotReminder) {
	throw new Error(
		"no AUTOMATIC-REMINDER-SENT within 10 min (PayPal batch scheduling); re-run npm run stage42:wait later",
	);
}
console.log("STAGE 42 OK: reminder event received in local log");
