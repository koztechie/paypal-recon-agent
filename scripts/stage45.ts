/**
 * Stage 45 marker: record_payment_for_invoice works; refund stays blocked
 * (SECURITY red list). Flow: draft ($25) -> send -> record CASH payment -> PAID.
 * Run: npm run stage45
 */
import {
	createDraftInvoice,
	parseToolResult,
	sendInvoice,
} from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const buyerEmail = process.env.SANDBOX_BUYER_EMAIL;
if (!buyerEmail) throw new Error("SANDBOX_BUYER_EMAIL missing");

const tools = createPaypalToolkit().getTools();

// Negative guardrail test: refund tool must not exist in the whitelist.
if ("record_refund_for_invoice" in tools || "create_refund" in tools) {
	throw new Error("RED LIST VIOLATION: refund tool exposed to the agent!");
}
console.log("guardrail: refund tools absent ✓");

// Positive flow.
const draft = await createDraftInvoice(tools, {
	buyerEmail,
	itemName: "Stage 45 manual payment recording",
	amount: "25.00",
	note: "External (offline) payment will be recorded manually",
});
console.log("draft:", draft.id, draft.status);

await sendInvoice(
	tools,
	draft.id as string,
	"Sent before recording offline payment",
);
console.log("sent ✓");

const record = (
	tools.record_payment_for_invoice as unknown as {
		execute: (a: unknown, o: unknown) => Promise<unknown>;
	}
).execute;
const result = parseToolResult(
	await record(
		{
			invoice_id: draft.id,
			payment_date: "2026-10-28",
			method: "CASH",
			note: "Offline payment recorded manually (stage 45)",
		},
		{ toolCallId: "record-payment", messages: [] },
	),
);
console.log("record result:", JSON.stringify(result).slice(0, 120));

const full = JSON.parse(
	await (
		tools.get_invoice as unknown as {
			execute: (a: unknown, o: unknown) => Promise<string>;
		}
	).execute({ invoice_id: draft.id }, { toolCallId: "verify", messages: [] }),
) as { status?: string };
console.log("invoice:", draft.id, "| status:", full.status);

// External (offline) payments get MARKED_AS_PAID — PayPal distinguishes them
// from payments processed through PayPal (status PAID). Both mean "nothing due".
if (full.status !== "MARKED_AS_PAID" && full.status !== "PAID") {
	throw new Error(`expected MARKED_AS_PAID (or PAID), got ${full.status}`);
}
console.log(
	"STAGE 45 OK: manual payment recorded, invoice status =",
	full.status,
);
