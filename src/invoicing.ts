/**
 * Invoicing helpers on top of the Agent Toolkit (stages 40-45).
 * All calls go through the guardrail whitelist in src/paypal.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// --- Reminder with SECURITY.md rule-4 limits (max 1/24h, max 3 per invoice) ---

const REMINDER_LEDGER = "logs/reminders.json";
const REMINDER_MAX_PER_DAY = 1;
const REMINDER_MAX_LIFETIME = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Toolkit execute() returns JSON strings; some calls return nothing (HTTP 204). */
export function parseToolResult(result: unknown): InvoiceResult {
	if (result == null || result === "") return {};
	const parsed =
		typeof result === "string" ? (JSON.parse(result) as unknown) : result;
	if (parsed && typeof parsed === "object" && "error" in parsed) {
		throw new Error(`PayPal tool error: ${JSON.stringify(parsed)}`);
	}
	return parsed as InvoiceResult;
}

interface ReminderLedger {
	[invoiceId: string]: string[]; // ISO timestamps
}

function loadLedger(): ReminderLedger {
	try {
		return JSON.parse(readFileSync(REMINDER_LEDGER, "utf8")) as ReminderLedger;
	} catch {
		return {};
	}
}

export function checkReminderAllowed(invoiceId: string): {
	allowed: boolean;
	reason: string;
} {
	const ledger = loadLedger();
	const stamps = (ledger[invoiceId] ?? []).map((s) => new Date(s).getTime());
	const now = Date.now();

	if (stamps.length >= REMINDER_MAX_LIFETIME) {
		return {
			allowed: false,
			reason: `BLOCKED: lifetime limit reached (${REMINDER_MAX_LIFETIME})`,
		};
	}
	const recent = stamps.filter((t) => now - t < DAY_MS).length;
	if (recent >= REMINDER_MAX_PER_DAY) {
		return {
			allowed: false,
			reason: `BLOCKED: 24h limit reached (${REMINDER_MAX_PER_DAY}/day)`,
		};
	}
	return { allowed: true, reason: "PASS" };
}

/** Guarded manual/external payment recording (stage 53 wrapper — never raw execute). */
export async function recordExternalPayment(
	tools: ToolkitTools,
	invoiceId: string,
	amount: string,
	currency: string,
	note?: string,
): Promise<InvoiceResult> {
	const execute = (
		tools.record_payment_for_invoice as unknown as {
			execute: (a: unknown, o: unknown) => Promise<unknown>;
		}
	).execute;
	const result = await execute(
		{
			invoice_id: invoiceId,
			payment_date: "2026-10-28",
			method: "CASH",
			amount: { currency_code: currency, value: amount },
			...(note ? { note } : {}),
		},
		{ toolCallId: "record-external-payment", messages: [] },
	);
	return parseToolResult(result);
}

export async function sendInvoiceReminder(
	tools: ToolkitTools,
	invoiceId: string,
	note?: string,
): Promise<InvoiceResult> {
	const gate = checkReminderAllowed(invoiceId);
	if (!gate.allowed) {
		throw new Error(gate.reason);
	}

	const execute = (
		tools.send_invoice_reminder as unknown as {
			execute: (a: unknown, o: unknown) => Promise<unknown>;
		}
	).execute;
	const result = await execute(
		{ invoice_id: invoiceId, ...(note ? { note } : {}) },
		{ toolCallId: "send-reminder", messages: [] },
	);

	// Record only after a successful call.
	const ledger = loadLedger();
	ledger[invoiceId] = [...(ledger[invoiceId] ?? []), new Date().toISOString()];
	mkdirSync("logs", { recursive: true });
	writeFileSync(REMINDER_LEDGER, JSON.stringify(ledger, null, 2));

	const parsed =
		typeof result === "string"
			? (JSON.parse(result) as InvoiceResult)
			: (result as InvoiceResult);
	if ("error" in (parsed as Record<string, unknown>)) {
		throw new Error(`PayPal tool error: ${JSON.stringify(parsed)}`);
	}
	return parsed;
}
