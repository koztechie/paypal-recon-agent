/**
 * Stage 72 marker: LLM API down (invalid key) -> the system keeps working on
 * LOCAL RULES (deterministic logic), and the fallback is logged.
 * Run: npm run stage72
 */

import {
	classifyIncomingPayment,
	decideReminder,
	type OpenInvoice,
} from "../src/actions.ts";
import { getDb } from "../src/db.ts";

const db = getDb();

// --- Disable the LLM "at the key level" (simulated outage) --------------------
const savedKey = process.env.LLM_API_KEY;
process.env.LLM_API_KEY = "REPLACE_WITH_INVALID_KEY_000";
console.log("LLM_API_KEY disabled for this test");

const invoices: OpenInvoice[] = [
	{ invoiceNumber: "9001", totalMinor: 3000, currency: "USD", status: "SENT" },
	{ invoiceNumber: "9002", totalMinor: 4000, currency: "USD", status: "SENT" },
	{ invoiceNumber: "9003", totalMinor: 5000, currency: "EUR", status: "SENT" },
];

const cases = [
	{
		p: { amountMinor: 3000, currency: "USD", invoiceNumber: "9001" },
		want: "PAID",
	},
	{
		p: { amountMinor: 3500, currency: "USD", invoiceNumber: "9002" },
		want: "PARTIAL",
	},
	{
		p: { amountMinor: 5000, currency: "USD", invoiceNumber: "9003" },
		want: "MISMATCH",
	},
	{ p: { amountMinor: 7777, currency: "USD" }, want: "FOREIGN" },
	{ p: { amountMinor: 4000, currency: "USD" }, want: "PAID" },
	{
		p: { amountMinor: 2500, currency: "USD", invoiceNumber: "7777" },
		want: "FOREIGN",
	},
	{
		p: { amountMinor: 4500, currency: "USD", invoiceNumber: "9002" },
		want: "MISMATCH",
	},
	{
		p: { amountMinor: 2000, currency: "USD", invoiceNumber: "9001" },
		want: "PARTIAL",
	},
] as const;

let pass = 0;
const checks: Array<[string, boolean]> = [];

// 1) Classification works WITHOUT the LLM.
let clsOk = 0;
for (const c of cases) {
	const res = await classifyIncomingPayment(c.p, invoices);
	const ok = res.class === c.want && res.raw.includes("rules fallback");
	console.log(
		`${ok ? "✓" : "✗"} classify ${c.want.padEnd(8)} got=${res.class.padEnd(8)} via=rules`,
	);
	if (ok) clsOk++;
}
checks.push([
	`classification works on rules (${clsOk}/${cases.length})`,
	clsOk === cases.length,
]);

// 2) Reminder decisions work WITHOUT the LLM.
const d1 = await decideReminder({
	invoice_number: "X",
	status: "SENT",
	amount: "48.00",
	currency: "USD",
	days_outstanding: 5,
	reminders_last_24h: 0,
	reminders_lifetime: 0,
});
const d2 = await decideReminder({
	invoice_number: "X",
	status: "SENT",
	amount: "48.00",
	currency: "USD",
	days_outstanding: 5,
	reminders_last_24h: 1,
	reminders_lifetime: 1,
});
console.log(
	`${d1.decision === "REMIND" ? "✓" : "✗"} reminder rule: overdue -> REMIND`,
);
console.log(
	`${d2.decision === "WAIT" ? "✓" : "✗"} reminder rule: 24h limit -> WAIT`,
);
checks.push(["overdue -> REMIND (rules)", d1.decision === "REMIND"]);
checks.push(["24h-limited -> WAIT (rules)", d2.decision === "WAIT"]);

// 3) The fallback events were LOGGED (auditable).
const fallbacks = db
	.prepare(
		"SELECT count(*) c FROM agent_actions WHERE action LIKE 'llm_fallback:%'",
	)
	.get() as { c?: number } | undefined;
const fbCount = fallbacks?.c ?? 0;
console.log(`fallback log rows: ${fbCount}`);
checks.push(["fallbacks logged in agent_actions (>=2)", fbCount >= 2]);

// 4) Restore the key (system returns to LLM-first mode).
if (savedKey) process.env.LLM_API_KEY = savedKey;
const restored = await classifyIncomingPayment(
	{ amountMinor: 3000, currency: "USD", invoiceNumber: "9001" },
	invoices,
);
const viaLLM = !restored.raw.includes("rules fallback");
console.log(`after key restore -> via=${viaLLM ? "llm" : "rules"}`);
checks.push(["key restored -> LLM-first mode again", viaLLM]);

for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
pass = checks.filter(([, ok]) => ok).length;
console.log(`\n${pass}/${checks.length} fallback checks passed`);
if (pass !== checks.length)
	throw new Error(`FALLBACK QA FAILED: ${pass}/${checks.length}`);
console.log("STAGE 72 OK: disabled key -> system runs on local rules, logged");
