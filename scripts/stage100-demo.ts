/**
 * Stage 100 ★ demo: "two agents pay each other" — the full Module A story in one
 * narrated console run (~45 s): negotiate -> contract -> invoice -> payment ->
 * confirmations to BOTH agents. This script IS the demo (npm run demo); the stage
 * video records one run of it.
 */
import { buildContract, createInvoiceFromContract } from "../src/contract.ts";
import { confirmPaymentToAgents, readAgentView } from "../src/confirmation.ts";
import { negotiate } from "../src/negotiation.ts";
import {
	parseToolResult,
	recordExternalPayment,
	sendInvoice,
	type InvoiceResult,
} from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
const t0 = Date.now();

const buyerEmail = process.env.SANDBOX_BUYER_EMAIL;
if (!buyerEmail) throw new Error("SANDBOX_BUYER_EMAIL missing");

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

console.log("=== Module A demo: two agents pay each other ===");
console.log("scenario: 10 x cross-border reconciliation report (DEMO-SCENARIO.md)\n");
await sleep(2500);

// --- 1) negotiation (two LLM agents) ---------------------------------------
console.log("[1/5] negotiating (buyer authorization $460, seller floor $450)...");
const result = await negotiate(cfg);
for (const r of result.rounds) {
	console.log(`  ${r.agent.toUpperCase()} R${r.round}: "${r.message}"  (${money(r.priceMinor)})`);
	await sleep(2000);
}
if (!result.settled || result.agreedMinor === undefined) {
	console.log(`ABORT: not settled (${result.reason})`);
	process.exit(1);
}
console.log(`  -> SETTLED at ${money(result.agreedMinor)} after ${result.rounds.length} rounds`);
await sleep(4500);

// --- 2) contract ------------------------------------------------------------
const transcript = result.rounds.map((r) => `${r.agent.toUpperCase()}: ${r.message}`);
const contract = await buildContract(result, cfg, transcript, { buyerEmail });
console.log(`\n[2/5] contract ${contract.id}: ${money(contract.price.total_minor)} ${contract.subject.currency}, net ${contract.terms.days} days  [VALID]`);
await sleep(4000);

// --- 3) invoice (seller side, core shell) ----------------------------------
const tools = createPaypalToolkit().getTools();
const inv = await createInvoiceFromContract(tools, contract);
await sendInvoice(tools, inv.invoiceId, `Contract ${contract.id}: ${inv.termsNote}.`);
console.log(`\n[3/5] seller agent sends PayPal invoice ${inv.invoiceId}`);
console.log(`        ${inv.amount} ${inv.currency} to ${inv.buyerEmail}`);
await sleep(3500);

// --- 4) payment (buyer side) ------------------------------------------------
console.log(`\n[4/5] buyer agent pays ${money(contract.price.total_minor)}...`);
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
	).execute({ invoice_id: inv.invoiceId }, { toolCallId: "demo-get", messages: [] }),
) as InvoiceResult;
const invoiceStatus = String(after.status ?? paid.status ?? "UNKNOWN");
console.log(`  -> invoice ${inv.invoiceId} is now ${invoiceStatus}`);
await sleep(4500);

// --- 5) both agents see the confirmation -------------------------------------
const [buyerMsg, sellerMsg] = confirmPaymentToAgents({
	contractId: contract.id,
	invoiceId: inv.invoiceId,
	amountMinor: contract.price.total_minor,
	currency: contract.subject.currency,
	invoiceStatus,
});
console.log(`\n[5/5] confirmations delivered to BOTH agents:`);
console.log(`  buyer : "${buyerMsg.message}"`);
await sleep(2000);
console.log(`  seller: "${sellerMsg.message}"`);
const buyerView = readAgentView("buyer", contract.id);
const sellerView = readAgentView("seller", contract.id);
console.log(`  (buyer view: ${buyerView.length} msg, seller view: ${sellerView.length} msg)`);
await sleep(1500);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
const ok = buyerView.length > 0 && sellerView.length > 0 && ["PAID", "MARKED_AS_PAID"].includes(invoiceStatus);
console.log(`\n=== DONE in ${secs}s — ${ok ? "two agents paid each other: PROVEN" : "FAILED"} ===`);
process.exit(ok ? 0 : 1);
