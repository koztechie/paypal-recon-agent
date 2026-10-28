/**
 * Stage 64 marker: reminder action with the frequency limit — never more than
 * 1/24h (verified from the LOG: reminders ledger + agent_actions).
 * Flow: LLM decides (REMIND|WAIT) -> hard gate (ledger) -> guarded send.
 * Run: npm run stage64
 */
import { existsSync, readFileSync } from "node:fs";
import { decideReminder } from "../src/actions.ts";
import { getDb } from "../src/db.ts";
import {
	checkReminderAllowed,
	createDraftInvoice,
	sendInvoiceReminder,
} from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const tools = createPaypalToolkit().getTools();
const db = getDb();
const NUM = String((Date.now() % 9000) + 1000);
const AMOUNT = "48.00";

const checks: Array<[string, boolean]> = [];

// --- T0: LLM decision logic (hermetic: synthetic overdue case) ---------------
const d1 = await decideReminder({
	invoice_number: "X1",
	status: "SENT",
	amount: "48.00",
	currency: "USD",
	days_outstanding: 7,
	reminders_last_24h: 0,
	reminders_lifetime: 0,
});
console.log(
	`T1 decision (overdue, no reminders): ${d1.decision} — ${d1.reason}`,
);
checks.push(["T1 overdue -> REMIND", d1.decision === "REMIND"]);

const d2 = await decideReminder({
	invoice_number: "X2",
	status: "SENT",
	amount: "48.00",
	currency: "USD",
	days_outstanding: 7,
	reminders_last_24h: 1,
	reminders_lifetime: 1,
});
console.log(`T2 decision (reminded today): ${d2.decision} — ${d2.reason}`);
checks.push(["T2 reminded-in-24h -> WAIT", d2.decision === "WAIT"]);

const d3 = await decideReminder({
	invoice_number: "X3",
	status: "PAID",
	amount: "48.00",
	currency: "USD",
	days_outstanding: 10,
	reminders_last_24h: 0,
	reminders_lifetime: 2,
});
console.log(`T3 decision (paid invoice): ${d3.decision} — ${d3.reason}`);
checks.push(["T3 paid -> WAIT", d3.decision === "WAIT"]);

// --- Real send + hard gate ---------------------------------------------------
const rec = await createDraftInvoice(tools, {
	buyerEmail: process.env.SANDBOX_BUYER_EMAIL as string,
	itemName: `Stage 64 reminder test #${NUM}`,
	amount: AMOUNT,
	note: "stage 64: reminder frequency limit",
	invoiceNumber: NUM,
});
const invoiceId = rec.id as string;
const gate0 = checkReminderAllowed(invoiceId);
if (!gate0.allowed) throw new Error(gate0.reason);
await sendInvoiceReminder(
	tools,
	invoiceId,
	"stage 64 first reminder (overdue test)",
);

const ledger = JSON.parse(
	readFileSync("logs/reminders.json", "utf8"),
) as Record<string, string[]>;
const firstCount = (ledger[invoiceId] ?? []).length;
console.log(`ledger after 1st reminder: ${firstCount}`);

// --- Immediate second attempt -> hard gate BLOCKED, NO second send -----------
let blocked = false;
try {
	await sendInvoiceReminder(
		tools,
		invoiceId,
		"stage 64 second attempt (must be blocked)",
	);
} catch (e) {
	blocked = /BLOCKED/i.test(e instanceof Error ? e.message : String(e));
	console.log(
		`2nd attempt: ${e instanceof Error ? e.message.slice(0, 80) : e}`,
	);
}
const ledger2 = JSON.parse(
	readFileSync("logs/reminders.json", "utf8"),
) as Record<string, string[]>;
const secondCount = (ledger2[invoiceId] ?? []).length;

checks.push(["real reminder sent (1/24h rule allows)", firstCount === 1]);
checks.push(["2nd attempt BLOCKED by gate", blocked]);
checks.push([
	"LOG proves no more than 1/24h (ledger count still 1)",
	secondCount === 1,
]);

// --- agent_actions log: PASS-executed + BLOCKED rows --------------------------
const actions = db
	.prepare(
		"SELECT action, limit_check, executed FROM agent_actions WHERE action='send_invoice_reminder' ORDER BY id DESC LIMIT 3",
	)
	.all() as Array<{ action: string; limit_check: string; executed: number }>;
checks.push([
	"agent_actions shows BLOCKED attempt (audit trail)",
	actions.some((a) => a.limit_check === "BLOCKED" && a.executed === 0),
]);
checks.push([
	"agent_actions shows executed PASS",
	actions.some((a) => a.limit_check === "PASS" && a.executed === 1),
]);
void existsSync;

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} reminder-limit checks passed`);
if (pass !== checks.length)
	throw new Error(`REMINDER QA FAILED: ${pass}/${checks.length}`);
console.log("STAGE 64 OK: reminder never more than 1/24h (verified from log)");
