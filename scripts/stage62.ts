/**
 * Stage 62 marker: 10/10 test payments classified correctly by the LLM.
 * Ground truth covers all four classes; pure classification (hermetic — no
 * PayPal calls, amounts in minor units).
 * Run: npm run stage62
 */
import {
	classifyIncomingPayment,
	type OpenInvoice,
	type PaymentClass,
} from "../src/actions.ts";

const invoices: OpenInvoice[] = [
	{ invoiceNumber: "9001", totalMinor: 3000, currency: "USD", status: "SENT" },
	{ invoiceNumber: "9002", totalMinor: 4000, currency: "USD", status: "SENT" },
	{ invoiceNumber: "9003", totalMinor: 5000, currency: "EUR", status: "SENT" },
	{ invoiceNumber: "9401", totalMinor: 5225, currency: "USD", status: "SENT" },
];

type Case = {
	id: string;
	payment: { amountMinor: number; currency: string; invoiceNumber?: string };
	expected: PaymentClass;
	why: string;
};

const cases: Case[] = [
	{
		id: "C1",
		payment: { amountMinor: 3000, currency: "USD", invoiceNumber: "9001" },
		expected: "PAID",
		why: "exact",
	},
	{
		id: "C2",
		payment: { amountMinor: 3500, currency: "USD", invoiceNumber: "9002" },
		expected: "PARTIAL",
		why: "underpay",
	},
	{
		id: "C3",
		payment: { amountMinor: 4000, currency: "USD" },
		expected: "PAID",
		why: "no ref but unique amount",
	},
	{
		id: "C4",
		payment: { amountMinor: 5000, currency: "USD", invoiceNumber: "9003" },
		expected: "MISMATCH",
		why: "currency USD vs EUR",
	},
	{
		id: "C5",
		payment: { amountMinor: 7777, currency: "USD" },
		expected: "FOREIGN",
		why: "no ref, no amount match",
	},
	{
		id: "C6",
		payment: { amountMinor: 2500, currency: "USD", invoiceNumber: "7777" },
		expected: "FOREIGN",
		why: "reference does not exist",
	},
	{
		id: "C7",
		payment: { amountMinor: 5500, currency: "USD", invoiceNumber: "9401" },
		expected: "MISMATCH",
		why: "overpay +275",
	},
	{
		id: "C8",
		payment: { amountMinor: 5225, currency: "USD", invoiceNumber: "9401" },
		expected: "PAID",
		why: "exact by ref+sum",
	},
	{
		id: "C9",
		payment: { amountMinor: 2000, currency: "USD", invoiceNumber: "9002" },
		expected: "PARTIAL",
		why: "half of 4000",
	},
	{
		id: "C10",
		payment: { amountMinor: 5000, currency: "GBP" },
		expected: "FOREIGN",
		why: "no ref; GBP vs EUR amount coincides but currency unknown",
	},
];

let pass = 0;
for (const c of cases) {
	const res = await classifyIncomingPayment(c.payment, invoices);
	const ok = res.class === c.expected;
	console.log(
		`${ok ? "✓" : "✗"} ${c.id}: got ${res.class.padEnd(8)} expected ${c.expected.padEnd(8)} (${c.why}) | ${res.reason.slice(0, 90)}`,
	);
	if (ok) pass++;
}
console.log(`\n${pass}/${cases.length} payments classified correctly`);
if (pass !== cases.length)
	throw new Error(`CLASSIFICATION FAILED: ${pass}/${cases.length}`);
console.log("STAGE 62 OK: 10/10 incoming payments classified");
