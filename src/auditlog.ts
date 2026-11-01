/**
 * Agent action log (SECURITY.md rule 3): every action attempt is a row in
 * agent_actions BEFORE/independent of execution; blocked attempts are logged too.
 */
import { getDb } from "./db.ts";
import { logError } from "./log.ts";

export interface AgentActionEntry {
	action: string;
	limitCheck: "PASS" | "BLOCKED";
	targetRef?: string;
	executed: boolean;
	llmDecision?: string;
}

/** Returns the new row id (0 on failure) so callers can flip THAT exact record. */
export function logAgentAction(entry: AgentActionEntry): number {
	try {
		const res = getDb()
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
		return Number(res.lastInsertRowid);
	} catch (e) {
		logError("[agent-actions] log failed:", e);
		return 0;
	}
}

/**
 * H-7: identity-based flip — executed=1 for THE EXACT record that was logged.
 * The old "newest not-executed row for this action" selection raced under
 * concurrency (and matched ANY pending row when target_ref was undefined).
 */
export function markAgentActionExecutedById(id: number): void {
	if (!id) return; // log failed -> nothing to flip
	try {
		getDb()
			.prepare(
				`UPDATE agent_actions SET executed = 1, executed_at = datetime('now')
       WHERE id = ? AND executed = 0`,
			)
			.run(id);
	} catch (e) {
		logError("[agent-actions] mark failed:", e);
	}
}
