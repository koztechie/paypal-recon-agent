/**
 * Rule-based fallback (stage 72): when the LLM API is unavailable (missing/invalid
 * key, outage), the SAME decisions are made by deterministic local rules —
 * regex/threshold logic mirroring the prompt definitions exactly.
 * Every fallback use is logged (agent_actions: llm_fallback).
 */

import type {
	IncomingPayment,
	OpenInvoice,
	PaymentClass,
	ReminderInput,
} from "./actions.ts";
import { logAgentAction } from "./auditlog.ts";

const OPEN_STATUSES = new Set(["SENT", "PARTIALLY_PAID"]);

/** Mirrors the stage-62 classification prompt with pure logic. */
export function classifyPaymentRules(
	payment: IncomingPayment,
	invoices: OpenInvoice[],
): { class: PaymentClass; reason: string } {
	if (payment.invoiceNumber) {
		const inv = invoices.find((i) => i.invoiceNumber === payment.invoiceNumber);
		if (!inv) {
			return {
				class: "FOREIGN",
				reason: `Invoice ${payment.invoiceNumber} does not exist; payment of ${(payment.amountMinor / 100).toFixed(2)} ${payment.currency} cannot be tied to it.`,
			};
		}
		if (inv.currency !== payment.currency) {
			return {
				class: "MISMATCH",
				reason: `Invoice ${inv.invoiceNumber} is ${inv.currency} but the payment arrived in ${payment.currency} — FX decision required.`,
			};
		}
		if (payment.amountMinor < inv.totalMinor) {
			return {
				class: "PARTIAL",
				reason: `Invoice ${inv.invoiceNumber} total is ${(inv.totalMinor / 100).toFixed(2)} but the payment is ${(payment.amountMinor / 100).toFixed(2)} — underpayment of ${((inv.totalMinor - payment.amountMinor) / 100).toFixed(2)} ${payment.currency}.`,
			};
		}
		if (payment.amountMinor > inv.totalMinor) {
			return {
				class: "MISMATCH",
				reason: `Invoice ${inv.invoiceNumber} total is ${(inv.totalMinor / 100).toFixed(2)} but the payment is ${(payment.amountMinor / 100).toFixed(2)} — overpayment of ${((payment.amountMinor - inv.totalMinor) / 100).toFixed(2)} ${payment.currency}.`,
			};
		}
		return {
			class: "PAID",
			reason: `Invoice ${inv.invoiceNumber} matches exactly: number + amount (${(payment.amountMinor / 100).toFixed(2)}) + currency (${payment.currency}).`,
		};
	}

	// No reference: unique open invoice with same amount+currency -> PAID.
	const matches = invoices.filter(
		(i) =>
			OPEN_STATUSES.has(i.status) &&
			i.currency === payment.currency &&
			i.totalMinor === payment.amountMinor,
	);
	if (matches.length === 1) {
		const inv = matches[0] as OpenInvoice;
		return {
			class: "PAID",
			reason: `No reference, but exactly one open invoice #${inv.invoiceNumber} has the same amount (${(payment.amountMinor / 100).toFixed(2)}) and currency — matched uniquely.`,
		};
	}
	if (matches.length > 1) {
		return {
			class: "FOREIGN",
			reason: `No reference and ${matches.length} open invoices share amount ${(payment.amountMinor / 100).toFixed(2)} ${payment.currency} — ambiguous, human routing needed.`,
		};
	}
	return {
		class: "FOREIGN",
		reason: `No reference and no open invoice matches ${(payment.amountMinor / 100).toFixed(2)} ${payment.currency}.`,
	};
}

/** Mirrors the stage-64 reminder decision rules with pure thresholds. */
export function decideReminderRules(input: ReminderInput): {
	decision: "REMIND" | "WAIT";
	reason: string;
} {
	if (input.status !== "SENT") {
		return {
			decision: "WAIT",
			reason: `invoice status is ${input.status} — nothing to remind`,
		};
	}
	if (input.reminders_last_24h >= 1) {
		return {
			decision: "WAIT",
			reason: "a reminder was already sent in the last 24 hours",
		};
	}
	if (input.reminders_lifetime >= 3) {
		return {
			decision: "WAIT",
			reason: "3+ reminders already sent over the invoice lifetime",
		};
	}
	if (input.days_outstanding <= 0) {
		return {
			decision: "WAIT",
			reason: "not overdue yet (days_outstanding <= 0)",
		};
	}
	return {
		decision: "REMIND",
		reason: `unpaid and overdue by ${input.days_outstanding} day(s) with limits available`,
	};
}

/** Deterministic explanation template (stage-63 fallback path, hardened). */
export function explainRules(input: {
	status: string;
	varianceMinor: number;
	currency: string;
	paymentAmountMinor: number;
	invoiceRef?: string;
}): string {
	const amount = (input.paymentAmountMinor / 100).toFixed(2);
	const variance = (input.varianceMinor / 100).toFixed(2);
	switch (input.status) {
		case "MATCHED":
			return `Payment of ${amount} ${input.currency}${input.invoiceRef ? ` for invoice ${input.invoiceRef}` : ""} matched exactly. No action needed.`;
		case "REVIEW":
			return `Payment of ${amount} ${input.currency} needs review: variance ${variance} ${input.currency}. Please confirm or reject the match.`;
		default:
			return `Payment of ${amount} ${input.currency} could not be matched to any open invoice. Route it to manual handling.`;
	}
}

/** Executes an LLM decision fn; on ANY failure falls back to rules and logs it. */
export async function withFallback<T>(
	label: string,
	llmFn: () => Promise<T>,
	rulesFn: () => T,
): Promise<{ value: T; via: "llm" | "rules"; error?: string }> {
	try {
		return { value: await llmFn(), via: "llm" };
	} catch (e) {
		const error = e instanceof Error ? e.message.slice(0, 200) : String(e);
		console.warn(
			`[fallback] ${label}: LLM unavailable -> rules (${error.slice(0, 90)})`,
		);
		logAgentAction({
			action: `llm_fallback:${label}`,
			limitCheck: "BLOCKED",
			executed: false,
			llmDecision: `LLM failed, rules used: ${error}`,
		});
		return { value: rulesFn(), via: "rules", error };
	}
}
