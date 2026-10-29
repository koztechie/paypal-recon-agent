/**
 * Two-agent negotiation (Module A, stages 93-100): a buyer agent and a seller agent
 * haggle over ONE batch order. Each side is an LLM with HARD numeric guardrails that
 * the model itself cannot exceed (buyer: authorization ceiling; seller: floor) — the
 * LLM words the offers, the code enforces the limits (stage 98 will formalize this).
 * Anti-fragile: a malformed LLM reply falls back to a scripted concession so the
 * negotiation always produces parseable rounds.
 *
 * The settled result feeds stage 95 (contract JSON) and stage 96 (invoices.create
 * through the core shell).
 */
import { chat } from "./llm.ts";

export interface NegotiationConfig {
	item: string;
	quantity: number;
	/** Everything in minor units (cents) — no float money anywhere. */
	buyerTargetMinor: number;
	buyerMaxMinor: number;
	sellerFloorMinor: number;
	/** Hard cap on rounds (demo scenario: 3; stage 98 limit: 10). */
	maxRounds: number;
	currency?: string;
}

export interface NegotiationRound {
	round: number;
	agent: "buyer" | "seller";
	message: string;
	priceMinor: number;
}

export interface NegotiationResult {
	settled: boolean;
	agreedMinor?: number;
	rounds: NegotiationRound[];
	reason: string;
}

const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

function parseOffer(text: string): { message: string; priceMinor: number } | null {
	try {
		const start = text.indexOf("{");
		const end = text.lastIndexOf("}");
		if (start < 0 || end <= start) return null;
		const obj = JSON.parse(text.slice(start, end + 1)) as {
			message?: unknown;
			offer_usd?: unknown;
		};
		if (typeof obj.message !== "string" || !obj.message.trim()) return null;
		const price = Number(obj.offer_usd);
		if (!Number.isFinite(price) || price <= 0) return null;
		return { message: obj.message.trim(), priceMinor: Math.round(price * 100) };
	} catch {
		return null;
	}
}

const BUYER_SYSTEM = (cfg: NegotiationConfig) =>
	`You are the BUYER agent in a procurement negotiation. You need ${cfg.quantity} × "${cfg.item}".
Your opening target is ${usd(cfg.buyerTargetMinor)} total. You are authorized to spend at most
${usd(cfg.buyerMaxMinor)} total — you may never quote a price above it, and you may never accept
a price above it either. Concede gradually, be brief and professional (one or two sentences).
When the seller's price fits your authorization, reply with your acceptance message and set
offer_usd to the price you accept.
Reply with STRICT JSON only: {"message": string, "offer_usd": number} (offer_usd in dollars, e.g. 450).`;

const SELLER_SYSTEM = (cfg: NegotiationConfig) =>
	`You are the SELLER agent in a negotiation for ${cfg.quantity} × "${cfg.item}".
Your floor is ${usd(cfg.sellerFloorMinor)} total — you may never quote below it and never accept
below it. In your single counter-offer state your floor price as your final price (weekly delivery
included). Be brief and professional (one or two sentences).
Reply with STRICT JSON only: {"message": string, "offer_usd": number} (offer_usd in dollars).`;

async function ask(
	role: "buyer" | "seller",
	system: string,
	transcript: string,
	fallback: { message: string; priceMinor: number },
	/** When set, an LLM reply at ANY other price is discarded in favour of the fallback. */
	mustMatch?: number,
): Promise<{ message: string; priceMinor: number; viaLlm: boolean }> {
	try {
		const r = await chat(system, transcript || "Start the negotiation.", {
			temperature: 0.4,
			maxTokens: 160,
			timeoutMs: 14_000,
		});
		const parsed = parseOffer(r.text);
		if (parsed && (mustMatch === undefined || parsed.priceMinor === mustMatch)) {
			// Enforce the hard limits even if the model oversteps.
			return { ...parsed, viaLlm: true };
		}
	} catch {
		// fall through to the scripted reply
	}
	return { ...fallback, viaLlm: false };
}

/**
 * Runs the negotiation. Each round alternates buyer/seller; the buyer accepts as
 * soon as the seller's counter fits its authorization (settled), or the run stops
 * at maxRounds.
 */
export async function negotiate(cfg: NegotiationConfig): Promise<NegotiationResult> {
	const currency = cfg.currency ?? "USD";
	const rounds: NegotiationRound[] = [];
	const transcript: string[] = [];
	let settled = false;
	let agreedMinor: number | undefined;
	let reason = `round limit (${cfg.maxRounds}) reached`;

	const clampSeller = (p: number) => Math.max(p, cfg.sellerFloorMinor);

	for (let round = 1; round <= cfg.maxRounds && !settled; round++) {
		if (round % 2 === 1) {
			// --- buyer speaks: opening offer, or the acceptance once a counter fits ---
			const agreed = agreedMinor; // snapshot (TS narrowing)
			if (agreed !== undefined) {
				const fallback = {
					message: `Deal — ${usd(agreed)} ${currency}, due in 7 days. Send the invoice.`,
					priceMinor: agreed,
				};
				const reply = await ask(
					"buyer",
					`${BUYER_SYSTEM(cfg)}\nThe seller's current price is ${usd(agreed)} — it fits your
authorization. ACCEPT NOW: write a short acceptance message that echoes their price
(e.g. "Deal — ${usd(agreed)} ..."), set offer_usd to ${agreed / 100}, do NOT counter-offer.`,
					transcript.join("\n"),
					fallback,
					agreed, // deterministic guard: any other price -> scripted acceptance
				);
				rounds.push({ round, agent: "buyer", message: reply.message, priceMinor: agreed });
				transcript.push(`BUYER: ${reply.message} (accepts ${usd(agreed)})`);
				settled = true;
				reason = "buyer accepted the seller's counter";
				break;
			}

			const openFallback = {
				message: `We need ${cfg.quantity} × "${cfg.item}" — our budget is ${usd(cfg.buyerTargetMinor)} total.`,
				priceMinor: cfg.buyerTargetMinor,
			};
			const reply = await ask(
				"buyer",
				BUYER_SYSTEM(cfg),
				transcript.join("\n"),
				openFallback,
			);
			const priceMinor = Math.min(reply.priceMinor, cfg.buyerMaxMinor);
			rounds.push({ round, agent: "buyer", message: reply.message, priceMinor });
			transcript.push(`BUYER: ${reply.message} (offers ${usd(priceMinor)})`);
		} else {
			// --- seller speaks: one counter at (or above) its floor ---
			const offer = await ask("seller", SELLER_SYSTEM(cfg), transcript.join("\n"), {
				message: `Our floor is ${usd(cfg.sellerFloorMinor)} for the batch, delivery included — final price.`,
				priceMinor: cfg.sellerFloorMinor,
			});
			const priceMinor = clampSeller(offer.priceMinor);
			rounds.push({ round, agent: "seller", message: offer.message, priceMinor });
			transcript.push(`SELLER: ${offer.message} (quotes ${usd(priceMinor)})`);

			// A counter within the buyer's authorization sets the agreement candidate;
			// the buyer's NEXT round becomes the acceptance.
			agreedMinor = priceMinor <= cfg.buyerMaxMinor ? priceMinor : undefined;
		}
	}

	return {
		settled,
		...(settled && agreedMinor !== undefined ? { agreedMinor } : {}),
		rounds,
		reason,
	};
}
