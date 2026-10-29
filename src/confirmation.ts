/**
 * Payment confirmations for BOTH agents (stage 97): once an invoice is paid, the
 * buyer agent and the seller agent each get THEIR OWN confirmation message, both
 * appended to the shared negotiation log (logs/negotiation-a.jsonl) — which is the
 * state both agents read on their next turn, so both literally "see" the payment.
 *
 * Messages are CODE-built (amounts/status are code-owned); the log is append-only.
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";

export type AgentRole = "buyer" | "seller";

export interface AgentMessage {
	at: string;
	event: "payment_confirmed";
	agent: AgentRole;
	contractId: string;
	invoiceId: string;
	amountMinor: number;
	currency: string;
	invoiceStatus: string;
	message: string;
}

const LOG = "logs/negotiation-a.jsonl";

const fmt = (minor: number, currency: string) =>
	currency === "USD"
		? `$${(minor / 100).toFixed(2)}`
		: `${(minor / 100).toFixed(2)} ${currency}`;

export function confirmPaymentToAgents(input: {
	contractId: string;
	invoiceId: string;
	amountMinor: number;
	currency: string;
	invoiceStatus: string;
	paymentRef?: string;
}): [AgentMessage, AgentMessage] {
	const { contractId, invoiceId, amountMinor, currency, invoiceStatus } = input;
	const money = fmt(amountMinor, currency);
	const ref = input.paymentRef ? ` (payment ${input.paymentRef})` : "";
	const at = new Date().toISOString();

	const buyer: AgentMessage = {
		at,
		event: "payment_confirmed",
		agent: "buyer",
		contractId,
		invoiceId,
		amountMinor,
		currency,
		invoiceStatus,
		message: `You paid ${money} for invoice ${invoiceId} (contract ${contractId})${ref} — the seller's invoice now shows ${invoiceStatus}.`,
	};
	const seller: AgentMessage = {
		at,
		event: "payment_confirmed",
		agent: "seller",
		contractId,
		invoiceId,
		amountMinor,
		currency,
		invoiceStatus,
		message: `Payment of ${money} received for invoice ${invoiceId} (contract ${contractId})${ref} — invoice status ${invoiceStatus}; funds recorded.`,
	};

	mkdirSync("logs", { recursive: true });
	const lines = [buyer, seller].map((m) => JSON.stringify(m)).join("\n") + "\n";
	appendFileSync(LOG, lines);
	return [buyer, seller];
}

/** What one agent can see: its own messages for a contract (from the shared log). */
export function readAgentView(agent: AgentRole, contractId: string): AgentMessage[] {
	try {
		return readFileSync(LOG, "utf8")
			.split("\n")
			.filter((l) => l.trim())
			.map((l) => JSON.parse(l) as AgentMessage)
			.filter((m) => m.agent === agent && m.contractId === contractId);
	} catch {
		return [];
	}
}
