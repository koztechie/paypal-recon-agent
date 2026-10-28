/**
 * Agent action #1 (stage 62): classify an incoming payment.
 * Classes (stage-19 wording):
 *   PAID      — full payment matching an invoice exactly (number+amount+currency)
 *   PARTIAL   — payment below the invoice total (same currency, invoice known)
 *   FOREIGN   — cannot be tied to any known invoice (unknown/foreign/ambiguous)
 *   MISMATCH  — identifiable invoice but discrepancy (currency differs, overpay)
 * Classification is LLM-based; temperature=0; strict JSON output.
 */
import { chat } from "./llm.ts";

export type PaymentClass = "PAID" | "PARTIAL" | "FOREIGN" | "MISMATCH";

export interface IncomingPayment {
	amountMinor: number;
	currency: string;
	invoiceNumber?: string; // reference carried by the payment, if any
}

export interface OpenInvoice {
	invoiceNumber: string;
	totalMinor: number;
	currency: string;
	status: string;
}

export interface Classification {
	class: PaymentClass;
	reason: string;
	raw: string;
	ms: number;
}

const CLASSIFY_SYSTEM = [
	"You classify ONE incoming payment for a PayPal merchant.",
	"Known open invoices are given as JSON: [{invoiceNumber, totalMinor, currency, status}]",
	"(amounts are MINOR units, e.g. 3000 = 30.00).",
	"The payment is given as JSON: {amountMinor, currency, invoiceNumber?}.",
	"Decide the class:",
	'  "PAID"     - EITHER invoiceNumber matches an invoice AND amount equals its total AND currency equals,',
	"               OR there is no invoiceNumber and EXACTLY ONE open invoice has the same amount AND same currency",
	'  "PARTIAL"  - invoiceNumber matches an invoice, same currency, amount is BELOW the total',
	'  "MISMATCH" - invoiceNumber matches an invoice BUT currency differs, or amount is ABOVE the total',
	'  "FOREIGN"  - the reference does not exist, or the match is ambiguous (several candidates), or nothing matches',
	'Reply with STRICT JSON only: {"class":"PAID|PARTIAL|FOREIGN|MISMATCH","reason":"one short sentence with exact numbers"}',
	"No markdown, no extra keys.",
].join("\n");

function parseJsonLoose(text: string): {
	class?: string;
	reason?: string;
	decision?: string;
} {
	const cleaned = text
		.replace(/^```(?:json)?/m, "")
		.replace(/```$/m, "")
		.trim();
	const start = cleaned.indexOf("{");
	const end = cleaned.lastIndexOf("}");
	if (start >= 0 && end > start) {
		try {
			return JSON.parse(cleaned.slice(start, end + 1)) as {
				class?: string;
				reason?: string;
			};
		} catch {
			/* fall through */
		}
	}
	return {};
}

export async function classifyIncomingPayment(
	payment: IncomingPayment,
	openInvoices: OpenInvoice[],
): Promise<Classification> {
	const user = JSON.stringify({
		payment,
		open_invoices: openInvoices,
	});
	const r = await chat(CLASSIFY_SYSTEM, user, {
		temperature: 0,
		maxTokens: 120,
	});
	const parsed = parseJsonLoose(r.text);
	const cls = (parsed.class ?? "").toUpperCase();
	const valid: PaymentClass[] = ["PAID", "PARTIAL", "FOREIGN", "MISMATCH"];
	if (!valid.includes(cls as PaymentClass)) {
		throw new Error(
			`classifier returned invalid class: ${r.text.slice(0, 160)}`,
		);
	}
	return {
		class: cls as PaymentClass,
		reason: (parsed.reason ?? "").trim(),
		raw: r.text,
		ms: r.ms,
	};
}

// --- Action #2 (stage 63): LLM explanation for a reconciliation outcome ------

const EXPLAIN_SYSTEM = [
	"You explain ONE reconciliation outcome to a small-merchant PayPal user.",
	"Input is JSON: {payment:{amountMinor,currency,invoiceNumber?},",
	"invoice:{invoiceNumber?,totalMinor?,currency?,status?}|null,",
	"outcome:{status:MATCHED|REVIEW|UNMATCHED,matchMethod?,varianceMinor,reason}}",
	"(amounts are MINOR units: 5225 = 52.25).",
	"Write 1-3 short plain-English sentences: what happened, the exact numbers,",
	"and what the merchant should do next (nothing if none is needed).",
	"No markdown, no headings, no JSON in the reply. Be concrete, never speculate.",
].join("\n");

export interface ReconciliationInput {
	payment: IncomingPayment;
	invoice: OpenInvoice | null;
	outcome: {
		status: "MATCHED" | "REVIEW" | "UNMATCHED";
		matchMethod?: string | null;
		varianceMinor: number;
		reason?: string | null;
	};
}

/** Generate a merchant-facing explanation; falls back to the rule reason. */
export async function explainReconciliation(
	input: ReconciliationInput,
	fallbackReason: string,
): Promise<{ text: string; via: "llm" | "fallback" }> {
	try {
		const r = await chat(EXPLAIN_SYSTEM, JSON.stringify(input), {
			temperature: 0,
			maxTokens: 160,
		});
		const text = r.text
			.replace(/^```(?:json)?/m, "")
			.replace(/```$/m, "")
			.trim();
		if (text.length < 20 || /[{}]/.test(text.slice(0, 10))) {
			return { text: fallbackReason, via: "fallback" };
		}
		return { text, via: "llm" };
	} catch {
		return { text: fallbackReason, via: "fallback" };
	}
}

// --- Action #3 (stage 64): decide whether to send a reminder -----------------

const REMIND_SYSTEM = [
	"You decide ONE thing: should a payment reminder be sent for an invoice?",
	"Input JSON: {invoice_number, status, amount, currency, days_outstanding,",
	"reminders_last_24h, reminders_lifetime}",
	"Rules: WAIT if the invoice is already paid/cancelled, or if a reminder was",
	"already sent in the last 24h, or if 3+ reminders were already sent.",
	"REMIND if the invoice is unpaid AND days_outstanding > 0 — ANY positive",
	"number of days means it is overdue already (there is no grace period).",
	"Zero or negative days_outstanding => WAIT.",
	'Reply with STRICT JSON only: {"decision":"REMIND|WAIT","reason":"one short sentence"}',
	"No markdown, no extra keys.",
].join("\n");

export interface ReminderInput {
	invoice_number: string;
	status: string;
	amount: string;
	currency: string;
	days_outstanding: number;
	reminders_last_24h: number;
	reminders_lifetime: number;
}

export async function decideReminder(
	input: ReminderInput,
): Promise<{ decision: "REMIND" | "WAIT"; reason: string }> {
	const r = await chat(REMIND_SYSTEM, JSON.stringify(input), {
		temperature: 0,
		maxTokens: 80,
	});
	const parsed = parseJsonLoose(r.text);
	const d = (parsed.decision ?? "").toUpperCase();
	if (d !== "REMIND" && d !== "WAIT") {
		throw new Error(`reminder decision invalid: ${r.text.slice(0, 160)}`);
	}
	return { decision: d, reason: (parsed.reason ?? "").trim() };
}
