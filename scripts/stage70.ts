/**
 * Stage 70 marker: stability — 10 repeats of ONE scenario produce the SAME
 * status every time (temperature 0 + fixed prompt + fixed inputs).
 * Scenario: payment $35.00 with invoice reference #9002 ($40.00 total) -> PARTIAL.
 * Run: npm run stage70
 */
import { classifyIncomingPayment, type OpenInvoice } from "../src/actions.ts";

const invoices: OpenInvoice[] = [
	{ invoiceNumber: "9001", totalMinor: 3000, currency: "USD", status: "SENT" },
	{ invoiceNumber: "9002", totalMinor: 4000, currency: "USD", status: "SENT" },
	{ invoiceNumber: "9003", totalMinor: 5000, currency: "EUR", status: "SENT" },
];

const payment = {
	amountMinor: 3500,
	currency: "USD",
	invoiceNumber: "9002",
}; // expected: PARTIAL (underpay $5)

const REPEATS = 10;
const classes: string[] = [];
const reasons: string[] = [];
const times: number[] = [];

for (let i = 1; i <= REPEATS; i++) {
	const res = await classifyIncomingPayment(payment, invoices);
	classes.push(res.class);
	reasons.push(res.reason);
	times.push(res.ms);
	console.log(
		`run ${String(i).padStart(2)}: ${res.class.padEnd(8)} ${res.ms}ms | ${res.reason.slice(0, 80)}`,
	);
}

const unique = new Set(classes);
const statusesIdentical = unique.size === 1 && classes[0] === "PARTIAL";
const medianMs = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];

const checks: Array<[string, boolean]> = [
	[`all ${REPEATS} runs completed`, classes.length === REPEATS],
	["statuses identical across repeats (no discrepancies)", statusesIdentical],
	["the stable status is correct (PARTIAL)", classes[0] === "PARTIAL"],
	[
		"every reason carries concrete digits (never vague)",
		reasons.every((r) => /\d/.test(r)),
	],
];

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(
	`\n${pass}/${checks.length} stability checks | median ${medianMs}ms over ${REPEATS} runs`,
);
if (pass !== checks.length)
	throw new Error(`STABILITY FAILED: ${pass}/${checks.length}`);
console.log("STAGE 70 OK: 10/10 repeats — identical statuses");
