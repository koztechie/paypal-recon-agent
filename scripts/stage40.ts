/**
 * Stage 40 marker: invoice created via Agent Toolkit, status DRAFT.
 * Run: npm run stage40
 */
import { createDraftInvoice } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const buyerEmail = process.env.SANDBOX_BUYER_EMAIL;
if (!buyerEmail || buyerEmail.startsWith("sb-...")) {
	throw new Error("SANDBOX_BUYER_EMAIL is missing (see .env.example)");
}

const tools = createPaypalToolkit().getTools();
const invoice = await createDraftInvoice(tools, {
	buyerEmail,
	itemName: "Reconciliation retainer — stage 40",
	amount: "75.00",
	note: "Created via PayPal Agent Toolkit (hackathon stage 40)",
});

console.log("invoice id:", invoice.id);
console.log("status:", invoice.status);
console.log("invoice_number:", invoice.detail?.invoice_number);

if (invoice.status !== "DRAFT") {
	throw new Error(`expected DRAFT, got ${invoice.status}`);
}
console.log("STAGE 40 OK: invoice created with status DRAFT");
