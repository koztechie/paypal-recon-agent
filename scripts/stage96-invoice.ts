/**
 * Stage 96 ★: settled agreement -> invoices.create through the SAME core shell
 * (createDraftInvoice -> Agent Toolkit -> guardrails). Verifies the created invoice
 * against PayPal's own get_invoice and the agent_actions audit trail.
 * Run: npm run stage96
 */
import { getDb } from "../src/db.ts";
import { buildContract, createInvoiceFromContract } from "../src/contract.ts";
import { negotiate } from "../src/negotiation.ts";
import { createPaypalToolkit, type ToolkitTools } from "../src/paypal.ts";

const buyerEmail = process.env.SANDBOX_BUYER_EMAIL;
if (!buyerEmail) {
	console.log("MARKER_INVOICE_FROM_CONTRACT: FAIL (SANDBOX_BUYER_EMAIL missing)");
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

// 1) agreement
const result = await negotiate(cfg);
if (!result.settled || result.agreedMinor === undefined) {
	console.log(`MARKER_INVOICE_FROM_CONTRACT: FAIL (not settled: ${result.reason})`);
	process.exit(1);
}
console.log(`agreement: SETTLED at ${(result.agreedMinor / 100).toFixed(2)} in ${result.rounds.length} rounds`);

// 2) contract (validated)
const transcript = result.rounds.map((r) => `${r.agent.toUpperCase()}: ${r.message}`);
const contract = await buildContract(result, cfg, transcript, { buyerEmail });
console.log(`contract: ${contract.id} — total ${(contract.price.total_minor / 100).toFixed(2)} ${contract.subject.currency}, ${contract.terms.type} ${contract.terms.days}d`);

// 3) invoice through the core shell
const tools: ToolkitTools = createPaypalToolkit().getTools();
const inv = await createInvoiceFromContract(tools, contract);
console.log(`invoice: ${inv.invoiceId} (${inv.invoiceNumber}) amount=${inv.amount} ${inv.currency} to ${inv.buyerEmail}`);

// 4) verify against PayPal truth (get_invoice)
const getExecute = (
	tools.get_invoice as unknown as {
		execute: (a: unknown, o: unknown) => Promise<unknown>;
	}
).execute;
const fullRaw = await getExecute(
	{ invoice_id: inv.invoiceId },
	{ toolCallId: "stage96-verify", messages: [] },
);
const full = (typeof fullRaw === "string" ? JSON.parse(fullRaw) : fullRaw) as Record<string, unknown> & {
	detail?: { invoice_number?: unknown; note?: unknown };
};

const checks: Record<string, boolean> = {
	"invoice exists on PayPal": !!full.id,
	"amount == contract total": String((full.amount as { value?: unknown } | undefined)?.value ?? "") === inv.amount,
	"currency matches": String((full.amount as { currency_code?: unknown } | undefined)?.currency_code ?? "") === inv.currency,
	"invoice_number == contract id":
		String(full.invoice_number ?? full.detail?.invoice_number ?? "") === contract.id,
	"buyer email present in invoice": JSON.stringify(full).includes(buyerEmail),
	"note carries contract terms": String(full.detail?.note ?? full.note ?? JSON.stringify(full)).includes(contract.id),
	"total matches the agreed price": contract.price.total_minor === result.agreedMinor,
};

// 5) audit trail: the shell logged create_invoice
const db = getDb();
const audit = db
	.prepare(
		`SELECT limit_check, executed FROM agent_actions
     WHERE action = 'create_invoice' ORDER BY id DESC LIMIT 1`,
	)
	.get() as { limit_check: string; executed: number } | undefined;
checks["audit-logged with limit_check PASS"] = !!audit && audit.limit_check === "PASS" && audit.executed === 1;
console.log(`audit: ${audit ? `${audit.limit_check}/executed=${audit.executed}` : "MISSING"}`);

for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "OK  " : "FAIL"} ${k}`);
const pass = Object.values(checks).every(Boolean);
console.log(`MARKER_INVOICE_FROM_CONTRACT: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
