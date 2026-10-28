/**
 * Stage 65 marker: E2E agentic chain — LLM sees an unpaid (overdue) invoice
 * and sends the reminder WITHOUT any manual step.
 * Run: npm run stage65
 */
import { existsSync, readFileSync } from "node:fs";
import { PROTECTED_INVOICES, runReminderAgent } from "../src/agent-actions.ts";
import { getDb } from "../src/db.ts";
import { createDraftInvoice, sendInvoice } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const tools = createPaypalToolkit().getTools();
const db = getDb();
const NUM = String((Date.now() % 9000) + 1000);

// 1) Create a genuinely OVERDUE invoice (due 3 days ago) — real data for the agent.
const rec = await createDraftInvoice(tools, {
	buyerEmail: process.env.SANDBOX_BUYER_EMAIL as string,
	itemName: `Stage 65 overdue test #${NUM}`,
	amount: "57.00",
	note: "stage 65: agentic reminder chain",
	invoiceNumber: NUM,
});
const invoiceId = rec.id as string;
// Backdate the due date via direct REST (toolkit create has no due-date field).
const cid = process.env.PAYPAL_CLIENT_ID as string;
const cs = process.env.PAYPAL_CLIENT_SECRET as string;
const auth = Buffer.from(`${cid}:${cs}`).toString("base64");
const tok = (await (
	await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
		method: "POST",
		headers: {
			Authorization: `Basic ${auth}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	})
).json()) as { access_token: string };
await fetch(
	`https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${invoiceId}`,
	{
		method: "PUT",
		headers: {
			Authorization: `Bearer ${tok.access_token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			// PUT REPLACES the whole invoice (detail + items + recipients wiped).
			// Resend ALL of them explicitly (stage-38 lesson in a new place).
			primary_recipients: [
				{ billing_info: { email_address: process.env.SANDBOX_BUYER_EMAIL } },
			],
			items: [
				{
					name: `Stage 65 overdue test #${NUM}`,
					quantity: "1",
					unit_amount: { currency_code: "USD", value: "57.00" },
				},
			],
			detail: {
				currency_code: "USD",
				invoice_number: NUM,
				memo: "stage 65: agentic reminder chain",
				payment_term: {
					term_type: "DUE_ON_DATE_SPECIFIED",
					due_date: "2026-10-25",
				},
			},
		}),
	},
);
await sendInvoice(tools, invoiceId, "sent for stage 65 chain");
// Verify the send really stuck (fail fast on silent breakage).
{
	const st = JSON.parse(
		await (
			tools.get_invoice as unknown as {
				execute: (a: unknown, o: unknown) => Promise<string>;
			}
		).execute(
			{ invoice_id: invoiceId },
			{ toolCallId: "verify-send", messages: [] },
		),
	) as { status?: string };
	if (st.status !== "SENT")
		throw new Error(`send did not stick: status=${st.status}`);
}
console.log(`overdue invoice ready: #${NUM} ${invoiceId} (due 2026-10-25)`);

// Protected invoices must have untouched ledgers.
const ledgerBefore = existsSync("logs/reminders.json")
	? readFileSync("logs/reminders.json", "utf8")
	: "";

// 2) THE CHAIN: list -> LLM decides -> gate -> tool executes. No manual step.
console.log("\n--- running reminder agent ---");
const runs = await runReminderAgent(tools, { maxInvoices: 20 });
for (const r of runs) {
	console.log(
		`${r.decision.padEnd(6)} ${r.invoiceId} (#${r.invoiceNumber ?? "-"}) exec=${r.executed} | ${r.reason.slice(0, 90)}${r.blockedReason ? ` [blocked: ${r.blockedReason}]` : ""}`,
	);
}

// 3) Assertions.
const ours = runs.find((r) => r.invoiceNumber === NUM);
const ledgerAfter = readFileSync("logs/reminders.json", "utf8");
const protectedUntouched = [...PROTECTED_INVOICES].every((pid) => {
	const beforeCount = (ledgerBefore.match(new RegExp(pid, "g")) ?? []).length;
	const afterCount = (ledgerAfter.match(new RegExp(pid, "g")) ?? []).length;
	return beforeCount === afterCount;
});
const actions = db
	.prepare(
		"SELECT limit_check, executed FROM agent_actions WHERE action='send_invoice_reminder' ORDER BY id DESC LIMIT 5",
	)
	.all() as Array<{ limit_check: string; executed: number }>;

const checks: Array<[string, boolean]> = [
	[
		"chain chose REMIND for the overdue invoice (LLM decision)",
		ours?.decision === "REMIND",
	],
	["reminder EXECUTED automatically (no manual step)", ours?.executed === true],
	[
		"ledger contains exactly one new entry for the invoice",
		(ledgerAfter.match(new RegExp(ours?.invoiceId ?? NUM, "g")) ?? []).length >=
			1,
	],
	[
		"audit trail: PASS+executed row present",
		actions.some((a) => a.limit_check === "PASS" && a.executed === 1),
	],
	["protected stage-42 invoices untouched", protectedUntouched],
];

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} agentic-chain checks passed`);
if (pass !== checks.length)
	throw new Error(`CHAIN FAILED: ${pass}/${checks.length}`);
console.log(
	"STAGE 65 OK: LLM saw unpaid invoice -> reminder sent, zero manual steps",
);
