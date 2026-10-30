/**
 * Stage 97: payment + confirmation for BOTH agents.
 * negotiate -> contract -> invoice (core shell) -> send -> record payment (guarded
 * wrapper, real PayPal) -> BOTH agents get their confirmation message in the shared
 * negotiation log -> each agent's view is read back and asserted.
 * Run: npm run stage97
 */

import { confirmPaymentToAgents, readAgentView } from "../src/confirmation.ts";
import { buildContract, createInvoiceFromContract } from "../src/contract.ts";
import { getDb } from "../src/db.ts";
import {
	type InvoiceResult,
	parseToolResult,
	recordExternalPayment,
	sendInvoice,
} from "../src/invoicing.ts";
import { negotiate } from "../src/negotiation.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const buyerEmail = process.env.SANDBOX_BUYER_EMAIL;
if (!buyerEmail) {
	console.log(
		"MARKER_BOTH_AGENTS_CONFIRMED: FAIL (SANDBOX_BUYER_EMAIL missing)",
	);
	process.exit(1);
}
const cfg = {
	item: "cross-border reconciliation report",
	quantity: 10,
	buyerTargetMinor: 40_000,
	buyerMaxMinor: 46_000,
	sellerFloorMinor: 45_000,
	maxRounds: 3,
	currency: "USD",
	paymentDays: 7,
};

// 1) agreement -> contract -> invoice -> send
const result = await negotiate(cfg);
if (!result.settled || result.agreedMinor === undefined) {
	console.log(
		`MARKER_BOTH_AGENTS_CONFIRMED: FAIL (not settled: ${result.reason})`,
	);
	process.exit(1);
}
const transcript = result.rounds.map(
	(r) => `${r.agent.toUpperCase()}: ${r.message}`,
);
const contract = await buildContract(result, cfg, transcript, { buyerEmail });
const tools = createPaypalToolkit().getTools();
const inv = await createInvoiceFromContract(tools, contract);
await sendInvoice(
	tools,
	inv.invoiceId,
	`Contract ${contract.id}: ${inv.termsNote}.`,
);
console.log(
	`invoice sent: ${inv.invoiceId} (${inv.amount} ${inv.currency}, ${contract.id})`,
);

// 2) PAYMENT — the buyer's side, through the guarded record-payment wrapper
//    (real PayPal API; audit-logged; full amount -> invoice closes the money side).
const paid = await recordExternalPayment(
	tools,
	inv.invoiceId,
	inv.amount,
	inv.currency,
	`Buyer agent settled contract ${contract.id}`,
);
const after = parseToolResult(
	await (
		tools.get_invoice as unknown as {
			execute: (a: unknown, o: unknown) => Promise<unknown>;
		}
	).execute(
		{ invoice_id: inv.invoiceId },
		{ toolCallId: "stage97-get", messages: [] },
	),
) as InvoiceResult;
const invoiceStatus = String(after.status ?? paid.status ?? "UNKNOWN");
console.log(`payment recorded -> invoice status: ${invoiceStatus}`);

// 3) confirm BOTH agents (shared log; each view read back)
const local = getDb()
	.prepare(
		`SELECT p.paypal_payment_id ref FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE i.paypal_invoice_id = ? ORDER BY p.id DESC LIMIT 1`,
	)
	.get(inv.invoiceId) as { ref: string } | undefined;
const [buyerMsg, sellerMsg] = confirmPaymentToAgents({
	contractId: contract.id,
	invoiceId: inv.invoiceId,
	amountMinor: contract.price.total_minor,
	currency: contract.subject.currency,
	invoiceStatus,
	...(local?.ref ? { paymentRef: local.ref } : {}),
});

const buyerView = readAgentView("buyer", contract.id);
const sellerView = readAgentView("seller", contract.id);
console.log(`\nbuyer sees:  "${buyerView.at(-1)?.message ?? "NOTHING"}"`);
console.log(`seller sees: "${sellerView.at(-1)?.message ?? "NOTHING"}"`);
if (local) console.log(`(local payments row from webhook: ${local.ref})`);

// 4) assertions
const money = `$${(contract.price.total_minor / 100).toFixed(2)}`;
const checks: Record<string, boolean> = {
	"invoice paid on PayPal": [
		"PAID",
		"MARKED_AS_PAID",
		"PARTIALLY_PAID",
	].includes(invoiceStatus),
	"buyer has the confirmation": buyerView.some(
		(m) => m.event === "payment_confirmed",
	),
	"seller has the confirmation": sellerView.some(
		(m) => m.event === "payment_confirmed",
	),
	"both messages mention the amount": [buyerMsg, sellerMsg].every((m) =>
		m.message.includes(money),
	),
	"messages differ per agent": buyerMsg.message !== sellerMsg.message,
	"same contract/invoice in both":
		buyerMsg.invoiceId === sellerMsg.invoiceId &&
		buyerMsg.contractId === contract.id,
};
for (const [k, v] of Object.entries(checks))
	console.log(`  ${v ? "OK  " : "FAIL"} ${k}`);
const pass = Object.values(checks).every(Boolean);
console.log(`MARKER_BOTH_AGENTS_CONFIRMED: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
