/**
 * Invoicing helpers on top of the Agent Toolkit (stages 40-45).
 * All calls go through the guardrail whitelist in src/paypal.ts.
 */
import type { ToolkitTools } from "./paypal.ts";

export interface DraftInvoiceInput {
	buyerEmail: string;
	itemName: string;
	amount: string; // decimal string, e.g. "75.00"
	currency?: string;
	note?: string;
}

export interface InvoiceResult {
	id?: string;
	status?: string;
	detail?: { invoice_number?: string };
	links?: Array<{ rel: string; href: string }>;
	[key: string]: unknown;
}

export async function createDraftInvoice(
	tools: ToolkitTools,
	input: DraftInvoiceInput,
): Promise<InvoiceResult> {
	const execute = (
		tools.create_invoice as unknown as {
			execute: (a: unknown, o: unknown) => Promise<unknown>;
		}
	).execute;

	const result = await execute(
		{
			currency_code: input.currency ?? "USD",
			note: input.note ?? "Created via Agent Toolkit",
			primary_recipients: [
				{ billing_info: { email_address: input.buyerEmail } },
			],
			items: [
				{
					name: input.itemName,
					quantity: "1",
					unit_amount: {
						currency_code: input.currency ?? "USD",
						value: input.amount,
					},
				},
			],
		},
		{ toolCallId: "create-draft-invoice", messages: [] },
	);

	// Toolkit quirk (v1.11.0, stage 40 finding): create_invoice returns ONLY the
	// self link {rel,href,method} (not the invoice body). Extract the id and
	// fetch the full record via get_invoice.
	const parsed =
		typeof result === "string"
			? (JSON.parse(result) as InvoiceResult)
			: (result as InvoiceResult);

	if ("error" in (parsed as Record<string, unknown>)) {
		throw new Error(`PayPal tool error: ${JSON.stringify(parsed)}`);
	}

	let invoiceId: string | undefined = parsed.id;
	if (!invoiceId && typeof parsed.href === "string") {
		invoiceId = parsed.href.split("/").pop();
	}
	if (!invoiceId) {
		throw new Error(`cannot determine invoice id: ${JSON.stringify(parsed)}`);
	}

	const getExecute = (
		tools.get_invoice as unknown as {
			execute: (a: unknown, o: unknown) => Promise<unknown>;
		}
	).execute;
	const full = await getExecute(
		{ invoice_id: invoiceId },
		{ toolCallId: "get-created-invoice", messages: [] },
	);
	return (typeof full === "string" ? JSON.parse(full) : full) as InvoiceResult;
}

export async function sendInvoice(
	tools: ToolkitTools,
	invoiceId: string,
	note?: string,
): Promise<InvoiceResult> {
	const execute = (
		tools.send_invoice as unknown as {
			execute: (a: unknown, o: unknown) => Promise<unknown>;
		}
	).execute;

	const result = await execute(
		{
			invoice_id: invoiceId,
			send_to_recipient: true,
			...(note ? { note } : {}),
		},
		{ toolCallId: "send-invoice", messages: [] },
	);

	const parsed =
		typeof result === "string"
			? (JSON.parse(result) as InvoiceResult)
			: (result as InvoiceResult);
	if ("error" in (parsed as Record<string, unknown>)) {
		throw new Error(`PayPal tool error: ${JSON.stringify(parsed)}`);
	}
	return parsed;
}
