/**
 * Agent action log (SECURITY.md rule 3): every action attempt is a row in
 * agent_actions BEFORE/independent of execution; blocked attempts are logged too.
 */
import { getDb } from "./db.ts";

export interface AgentActionEntry {
	action: string;
	limitCheck: "PASS" | "BLOCKED";
	targetRef?: string;
	executed: boolean;
	llmDecision?: string;
}

export function logAgentAction(entry: AgentActionEntry): void {
	try {
		getDb()
			.prepare(
				`INSERT INTO agent_actions (action, llm_decision, limit_check, target_ref, executed, executed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.run(
				entry.action,
				entry.llmDecision ?? "deterministic-call",
				entry.limitCheck,
				entry.targetRef ?? null,
				entry.executed ? 1 : 0,
				entry.executed ? new Date().toISOString() : null,
			);
	} catch (e) {
		console.error("[agent-actions] log failed:", e);
	}
}

/** Flip the most recent not-yet-executed row for this action to executed=1. */
export function markAgentActionExecuted(
	action: string,
	targetRef?: string,
): void {
	try {
		getDb()
			.prepare(
				`UPDATE agent_actions SET executed = 1, executed_at = datetime('now')
       WHERE id = (
         SELECT id FROM agent_actions
         WHERE action = ? AND executed = 0 AND (target_ref = ? OR ? IS NULL)
         ORDER BY id DESC LIMIT 1
       )`,
			)
			.run(action, targetRef ?? null, targetRef ?? null);
	} catch (e) {
		console.error("[agent-actions] mark failed:", e);
	}
}
