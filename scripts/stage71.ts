/**
 * Stage 71 marker: agent action latency — MEDIAN < 10s on the production path
 * (chat() with retries, thinkingLevel=low), while staying correct.
 * 10 classification actions over a fixed mixed case set.
 * Run: npm run stage71
 */
import { classifyIncomingPayment, type OpenInvoice } from "../src/actions.ts";

const invoices: OpenInvoice[] = [
	{ invoiceNumber: "9001", totalMinor: 3000, currency: "USD", status: "SENT" },
	{ invoiceNumber: "9002", totalMinor: 4000, currency: "USD", status: "SENT" },
	{ invoiceNumber: "9003", totalMinor: 5000, currency: "EUR", status: "SENT" },
];

const cases = [
	{
		p: { amountMinor: 3500, currency: "USD", invoiceNumber: "9002" },
		want: "PARTIAL",
	},
	{
		p: { amountMinor: 4000, currency: "USD", invoiceNumber: "9002" },
		want: "PAID",
	},
	{ p: { amountMinor: 7777, currency: "USD" }, want: "FOREIGN" },
	{
		p: { amountMinor: 5000, currency: "USD", invoiceNumber: "9003" },
		want: "MISMATCH",
	},
	{
		p: { amountMinor: 3000, currency: "USD", invoiceNumber: "9001" },
		want: "PAID",
	},
] as const;

const times: number[] = [];
let correct = 0;
for (let i = 0; i < 2; i++) {
	for (const c of cases) {
		const t0 = Date.now();
		const res = await classifyIncomingPayment(c.p, invoices);
		const ms = Date.now() - t0;
		times.push(ms);
		const ok = res.class === c.want;
		if (ok) correct++;
		console.log(
			`run${i + 1}.${cases.indexOf(c) + 1} ${ok ? "✓" : "✗"} ${res.class.padEnd(8)} want=${c.want} ${ms}ms`,
		);
	}
}

const sorted = [...times].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
const p90 =
	sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0;

const checks: Array<[string, boolean]> = [
	[`all ${times.length} actions completed`, times.length === 10],
	[`correctness kept (${correct}/10)`, correct === 10],
	[`MEDIAN < 10000ms (got ${median}ms)`, median < 10_000],
	[`p90 reported (${p90}ms) — informational`, p90 > 0],
];

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(
	`\nmedian=${median}ms p90=${p90}ms min=${sorted[0]}ms max=${sorted[sorted.length - 1]}ms`,
);
console.log(`${pass}/${checks.length} latency checks passed`);
if (pass !== checks.length)
	throw new Error(
		`LATENCY FAILED: ${pass}/${checks.length} (median ${median}ms)`,
	);
console.log("STAGE 71 OK: agent action median < 10s");
