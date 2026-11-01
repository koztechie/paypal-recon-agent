/**
 * Money-action guardrails (stage 68; SECURITY.md rules 1-2):
 *  - AGENT_AUTO_LIMIT: agent-initiated money effects <= $500 (minor units).
 *  - Red list (human-only, never allowed even below the limit):
 *    refunds, invoice cancel/delete, dispute acceptance, payouts.
 *  - EVERY decision (allow or refuse) is logged to agent_actions with the reason
 *    ("LLM/system decision log" requirement of stage 19/68).
 */
import { logAgentAction } from "./auditlog.ts";
import { usdMinorFrom } from "./fx.ts";

export const AGENT_AUTO_LIMIT_MINOR = 500_00; // $500.00 in cents

export const RED_LIST_ACTIONS = new Set([
	"create_refund",
	"record_refund_for_invoice",
	"cancel_sent_invoice",
	"delete_invoice",
	"accept_dispute_claim",
	"payouts",
]);

export interface PolicyDecision {
	allowed: boolean;
	limitCheck: "PASS" | "BLOCKED";
	reason: string;
	/** H-7: id of THIS decision's audit row (flip it after real execution). */
	logId?: number;
}

export function enforceActionPolicy(
	action: string,
	amountMinor: number,
	opts: {
		llmDecision?: string;
		targetRef?: string;
		autoLimitMinor?: number;
		currency?: string; // Rule-1 conversion source (H-9); default USD
	} = {},
): PolicyDecision {
	const limit =
		opts.llmDecision === undefined && opts.autoLimitMinor === undefined
			? AGENT_AUTO_LIMIT_MINOR
			: (opts.autoLimitMinor ?? AGENT_AUTO_LIMIT_MINOR);

	// H-9 / Rule 1: compare USD EQUIVALENTS (ECB reference rate of the day).
	// Conversion failure (not primed / unknown currency / ECB outage) -> BLOCK.
	const currency = opts.currency ?? "USD";
	const converted = usdMinorFrom(amountMinor, currency);
	if (converted === null) {
		return {
			allowed: false,
			limitCheck: "BLOCKED",
			reason: `FX rate (ECB) unavailable for ${currency} — blocked fail-closed (Rule 1)`,
		};
	}
	const show = (minor: number) =>
		currency === "USD"
			? `$${(minor / 100).toFixed(2)}`
			: `${(amountMinor / 100).toFixed(2)} ${currency} (≈ $${(converted / 100).toFixed(2)})`;

	let decision: PolicyDecision;
	if (RED_LIST_ACTIONS.has(action)) {
		decision = {
			allowed: false,
			limitCheck: "BLOCKED",
			reason: `human-only action "${action}" is on the red list (SECURITY rule 2)`,
		};
	} else if (converted > limit) {
		decision = {
			allowed: false,
			limitCheck: "BLOCKED",
			reason: `amount ${show(amountMinor)} exceeds agent auto-limit ${(limit / 100).toFixed(2)} — human approval required (SECURITY rule 1)`,
		};
	} else {
		decision = {
			allowed: true,
			limitCheck: "PASS",
			reason: `amount ${show(amountMinor)} within auto-limit ${(limit / 100).toFixed(2)}`,
		};
	}

	const logId = logAgentAction({
		action,
		limitCheck: decision.limitCheck,
		targetRef: opts.targetRef,
		executed: false, // caller flips THIS row (by id) after real execution (H-7)
		llmDecision: opts.llmDecision
			? `${opts.llmDecision} -> ${decision.limitCheck}: ${decision.reason}`
			: `system-policy -> ${decision.limitCheck}: ${decision.reason}`,
	});
	return { ...decision, logId };
}

/**
 * Runs a money action only when the policy allows it; throws otherwise.
 * On success the caller should call markAgentActionExecutedById(decision.logId).
 */
export async function guardedMoneyAction<T>(
	action: string,
	amountMinor: number,
	fn: () => Promise<T>,
	opts: { llmDecision?: string; targetRef?: string } = {},
): Promise<T> {
	const decision = enforceActionPolicy(action, amountMinor, opts);
	if (!decision.allowed) {
		throw new Error(`BLOCKED by guard: ${decision.reason}`);
	}
	return fn();
}
