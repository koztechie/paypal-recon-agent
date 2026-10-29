/**
 * Contract builder (stage 95): a settled negotiation becomes ONE structured contract
 * JSON — the input for stage 96 (`invoices.create` through the core shell).
 *
 * Design (anti-fragile, mirrors the whole project):
 * - the LLM drafts the human-facing fields (summary, payment terms extraction),
 * - but every MONEY value and identity comes from the structured agreement/code —
 *   the model can never change the agreed total (stage 98: no action without a
 *   recorded agreement; numbers are never parsed from prose).
 * - validateContract() is the marker gate: nothing downstream runs on invalid JSON.
 *
 * Zero runtime dependencies: hand-rolled validation (no schema library).
 */
import { chat } from "./llm.ts";
import { logAgentAction } from "./auditlog.ts";
import { createDraftInvoice, type InvoiceResult } from "./invoicing.ts";
import type { ToolkitTools } from "./paypal.ts";
import type { NegotiationConfig, NegotiationResult } from "./negotiation.ts";

export interface Contract {
	id: string;
	status: "settled";
	parties: { buyer: string; seller: string; buyer_email?: string };
	subject: { item: string; quantity: number; currency: string };
	price: { total_minor: number; unit_minor: number };
	terms: { type: "net_days"; days: number };
	negotiation: { rounds: number; opened_minor: number };
	summary: string;
	agreed_at: string;
	source: "llm" | "template";
}

export type ValidationResult =
	| { ok: true; contract: Contract }
	| { ok: false; errors: string[] };

const ISO_CURRENCY = /^[A-Z]{3}$/;

/** Pure validation — the stage-95 marker gate. */
export function validateContract(input: unknown): ValidationResult {
	const errors: string[] = [];
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		return { ok: false, errors: ["not an object"] };
	}
	// Must survive a JSON round-trip (it IS a JSON structure).
	let json: Record<string, unknown>;
	try {
		json = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
	} catch {
		return { ok: false, errors: ["not JSON-serializable"] };
	}

	const str = (v: unknown) => (typeof v === "string" ? v : null);
	const idStr = str(json.id);
	if (!idStr || !/^CNT-\d{8}-[a-f0-9]{6}$/.test(idStr)) errors.push("id");
	if (json.status !== "settled") errors.push("status");

	const parties = json.parties as Record<string, unknown> | undefined;
	if (!parties || !str(parties.buyer) || !str(parties.seller)) errors.push("parties");
	const buyerEmail = parties ? str(parties.buyer_email) : null;
	if (parties && parties.buyer_email !== undefined && (!buyerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail))) {
		errors.push("parties.buyer_email");
	}

	const subject = json.subject as Record<string, unknown> | undefined;
	if (!subject || !str(subject.item) || !String(subject.item).trim()) errors.push("subject.item");
	if (!subject || !Number.isInteger(subject.quantity) || Number(subject.quantity) < 1) {
		errors.push("subject.quantity");
	}
	if (!subject || !str(subject.currency) || !ISO_CURRENCY.test(String(subject.currency))) {
		errors.push("subject.currency");
	}

	const price = json.price as Record<string, unknown> | undefined;
	const total = price ? price.total_minor : undefined;
	const unit = price ? price.unit_minor : undefined;
	if (!Number.isInteger(total) || Number(total) < 1) errors.push("price.total_minor");
	if (!Number.isInteger(unit) || Number(unit) < 1) errors.push("price.unit_minor");
	if (
		typeof total === "number" &&
		typeof unit === "number" &&
		subject &&
		Number.isInteger(subject.quantity)
	) {
		// unit × quantity must reconstruct the total (integer-rounding tolerance only —
		// catches swapped/wrong numbers, allows e.g. 44999/10 -> unit 4500).
		const qty = Number(subject.quantity);
		if (Math.abs(unit * qty - total) > qty - 1) {
			errors.push("price consistency (unit×qty≠total)");
		}
	}

	const terms = json.terms as Record<string, unknown> | undefined;
	if (!terms || terms.type !== "net_days") errors.push("terms.type");
	if (!terms || !Number.isInteger(terms.days) || Number(terms.days) < 1 || Number(terms.days) > 365) {
		errors.push("terms.days");
	}

	const neg = json.negotiation as Record<string, unknown> | undefined;
	if (!neg || !Number.isInteger(neg.rounds) || Number(neg.rounds) < 1) errors.push("negotiation.rounds");
	if (!neg || !Number.isInteger(neg.opened_minor) || Number(neg.opened_minor) < 1) {
		errors.push("negotiation.opened_minor");
	}
	if (!str(json.summary) || !String(json.summary).trim()) errors.push("summary");
	if (!str(json.agreed_at) || Number.isNaN(Date.parse(String(json.agreed_at)))) errors.push("agreed_at");
	if (json.source !== "llm" && json.source !== "template") errors.push("source");

	return errors.length ? { ok: false, errors } : { ok: true, contract: input as Contract };
}

const SYSTEM = `You write a one-sentence summary of a SETTLED negotiation (what was bought,
for how much). STRICT JSON only, no prose: {"summary": string}. Never invent payment terms
or numbers that are not in the negotiation.`;

export async function buildContract(
	result: NegotiationResult,
	cfg: NegotiationConfig,
	transcript: string[],
	opts: { buyerEmail?: string } = {},
): Promise<Contract> {
	if (!result.settled || result.agreedMinor === undefined) {
		// Stage 98 rule: no contract without a recorded agreement.
		throw new Error(`no contract without a settled agreement (${result.reason})`);
	}
	const agreed = result.agreedMinor;
	const quantity = cfg.quantity;
	const unitMinor = Math.round(agreed / quantity);
	const id = `CNT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
		.toString(16)
		.slice(2, 8)
		.padEnd(6, "0")}`;

	// LLM drafts the narrative; code owns every number AND the payment terms
	// (an earlier run showed the model inventing net-30 from nothing — not anymore).
	let summary = `Agreed ${quantity} × "${cfg.item}" at ${(agreed / 100).toFixed(2)} ${cfg.currency}, net ${cfg.paymentDays ?? 7} days.`;
	let source: Contract["source"] = "template";
	try {
		const r = await chat(SYSTEM, transcript.join("\n"), {
			temperature: 0,
			maxTokens: 160,
			timeoutMs: 14_000,
		});
		const start = r.text.indexOf("{");
		const end = r.text.lastIndexOf("}");
		const parsed = JSON.parse(r.text.slice(start, end + 1)) as { summary?: unknown };
		if (typeof parsed.summary === "string" && parsed.summary.trim()) {
			summary = parsed.summary.trim().slice(0, 300);
			source = "llm";
		}
	} catch {
		// template summary stays (deterministic fallback)
	}

	const contract: Contract = {
		id,
		status: "settled",
		parties: {
			buyer: "Procurement agent (finance team)",
			seller: "Merchant agent (PayPal reconciliation agent)",
			...(opts.buyerEmail ? { buyer_email: opts.buyerEmail } : {}),
		},
		subject: { item: cfg.item, quantity, currency: cfg.currency ?? "USD" },
		price: { total_minor: agreed, unit_minor: unitMinor },
		terms: { type: "net_days", days: cfg.paymentDays ?? 7 },
		negotiation: { rounds: result.rounds.length, opened_minor: cfg.buyerTargetMinor },
		summary,
		agreed_at: new Date().toISOString(),
		source,
	};

	const check = validateContract(contract);
	if (!check.ok) {
		throw new Error(`contract failed validation: ${check.errors.join(", ")}`);
	}
	return contract;
}

// --- stage 96 ★: the contract drives a REAL invoice through the core shell -----

export interface ContractInvoice {
	invoiceId: string;
	invoiceNumber: string; // === contract.id (the audit link between them)
	amount: string;
	currency: string;
	buyerEmail: string;
	termsNote: string;
}

/**
 * Creates the PayPal invoice for a settled contract via createDraftInvoice() —
 * the SAME guarded core shell as the agent (audit-logged, $500 auto-limit enforced
 * inside). The invoice carries the agreement's terms: total, currency, subject,
 * the contract id as invoice_number, and the net terms in the note.
 * Refuses invalid contracts or contracts without a buyer_email (stage-98 rule:
 * no action without a recorded, valid agreement).
 */
export async function createInvoiceFromContract(
	tools: ToolkitTools,
	contract: Contract,
): Promise<ContractInvoice> {
	const refuse: (reason: string) => never = (reason) => {
		// Stage 98: refused attempts are logged too (SECURITY rule 3).
		logAgentAction({
			action: "create_invoice",
			limitCheck: "BLOCKED",
			targetRef: typeof contract?.id === "string" ? contract.id : "(no contract)",
			executed: false,
			llmDecision: `blocked: ${reason}`,
		});
		throw new Error(`refused: ${reason}`);
	};

	const check = validateContract(contract);
	if (!check.ok) {
		refuse(`invalid contract (${check.errors.join(", ")})`);
	}
	const buyerEmail = contract.parties.buyer_email;
	if (!buyerEmail) {
		refuse("contract has no parties.buyer_email");
	}
	const amount = (contract.price.total_minor / 100).toFixed(2);
	const termsNote = `net ${contract.terms.days} days`;

	const created: InvoiceResult = await createDraftInvoice(tools, {
		buyerEmail,
		itemName: `${contract.subject.quantity} × ${contract.subject.item} (contract ${contract.id})`,
		amount,
		currency: contract.subject.currency,
		note: `${contract.summary} Contract ${contract.id}: ${termsNote}.`,
		invoiceNumber: contract.id,
	});
	if (!created.id) {
		throw new Error(`invoice created without id: ${JSON.stringify(created).slice(0, 200)}`);
	}
	return {
		invoiceId: created.id,
		invoiceNumber: contract.id,
		amount,
		currency: contract.subject.currency,
		buyerEmail,
		termsNote,
	};
}
