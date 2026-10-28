/**
 * Money-action guardrails (stage 68; SECURITY.md rules 1-2):
 *  - AGENT_AUTO_LIMIT: agent-initiated money effects <= $500 (minor units).
 *  - Red list (human-only, never allowed even below the limit):
 *    refunds, invoice cancel/delete, dispute acceptance, payouts.
 *  - EVERY decision (allow or refuse) is logged to agent_actions with the reason
 *    ("LLM/system decision log" requirement of stage 19/68).
 */
import { logAgentAction } from "./auditlog.ts";

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
}

export function enforceActionPolicy(
	action: string,
	amountMinor: number,
	opts: {
		llmDecision?: string;
		targetRef?: string;
		autoLimitMinor?: number;
	} = {},
): PolicyDecision {
	const limit =
		opts.llmDecision === undefined && opts.autoLimitMinor === undefined
			? AGENT_AUTO_LIMIT_MINOR
			: (opts.autoLimitMinor ?? AGENT_AUTO_LIMIT_MINOR);

	let decision: PolicyDecision;
	if (RED_LIST_ACTIONS.has(action)) {
		decision = {
			allowed: false,
			limitCheck: "BLOCKED",
			reason: `human-only action "${action}" is on the red list (SECURITY rule 2)`,
		};
	} else if (amountMinor > limit) {
		decision = {
			allowed: false,
			limitCheck: "BLOCKED",
			reason: `amount ${(amountMinor / 100).toFixed(2)} exceeds agent auto-limit ${(limit / 100).toFixed(2)} — human approval required (SECURITY rule 1)`,
		};
	} else {
		decision = {
			allowed: true,
			limitCheck: "PASS",
			reason: `amount ${(amountMinor / 100).toFixed(2)} within auto-limit ${(limit / 100).toFixed(2)}`,
		};
	}

	logAgentAction({
		action,
		limitCheck: decision.limitCheck,
		targetRef: opts.targetRef,
		executed: false, // caller flips it via markAgentActionExecuted after real execution
		llmDecision: opts.llmDecision
			? `${opts.llmDecision} -> ${decision.limitCheck}: ${decision.reason}`
			: `system-policy -> ${decision.limitCheck}: ${decision.reason}`,
	});
	return decision;
}

/**
 * Runs a money action only when the policy allows it; throws otherwise.
 * On success the caller should call markAgentActionExecuted(action).
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
