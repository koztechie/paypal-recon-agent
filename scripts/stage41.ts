/**
 * Stage 41 marker: invoice status becomes SENT via send_invoice.
 * Run: npm run stage41
 */
import { sendInvoice } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const invoiceId = process.env.STAGE41_INVOICE_ID ?? "INV2-GJEB-FRLW-T2SP-HV3M";

const tools = createPaypalToolkit().getTools();
const result = await sendInvoice(
	tools,
	invoiceId,
	"Sent via Agent Toolkit (stage 41)",
);

console.log("send result keys:", Object.keys(result).slice(0, 8).join(", "));

const full = JSON.parse(
	await (
		tools.get_invoice as unknown as {
			execute: (a: unknown, o: unknown) => Promise<string>;
		}
	).execute(
		{ invoice_id: invoiceId },
		{ toolCallId: "verify-status", messages: [] },
	),
) as {
	status?: string;
	sent_to_recipient?: boolean;
	metadata?: Record<string, unknown>;
};

console.log("invoice:", invoiceId);
console.log("status:", full.status);

if (full.status !== "SENT") {
	throw new Error(`expected SENT, got ${full.status}`);
}
console.log("STAGE 41 OK: invoice status is SENT");
