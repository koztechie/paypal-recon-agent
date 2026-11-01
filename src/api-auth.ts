/**
 * Gate for state-changing endpoints — security finding C-2 (fixed 2026-11-01).
 *
 * `/api/action` (a REAL reminder email to a customer, or a REVIEW→MATCHED book
 * change), `/api/recon/run` (writes reconciliation records) and `/api/negotiate`
 * (burns LLM quota) were reachable by anyone on the internet. Enforcement =
 * presence of `ACTION_TOKEN` (same deploy-safe pattern as C-1):
 *   - set     -> only `Authorization: Bearer <token>` or `X-Action-Token: <token>`
 *                passes; everything else is 401 (length-safe constant-time compare);
 *   - unset   -> allowed, but every call logs a LOUD warning (never silently).
 * The read-only demo surfaces (`/`, `/health`, `/api/app-config`,
 * `/api/recon/rows`, `/api/nl-filter`, `/api/explain`) stay public on purpose:
 * the hosted keyless demo is an explicit hackathon requirement (R6).
 */

export interface ActionAuth {
	allowed: boolean;
	warnUnprotected: boolean;
}

/** Length-safe XOR compare (no early exit on length or content). */
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export function checkActionAuth(
	authHeader: string | undefined,
	actionTokenHeader: string | undefined,
	configuredToken: string | undefined,
): ActionAuth {
	if (!configuredToken) return { allowed: true, warnUnprotected: true };
	const bearer =
		authHeader?.startsWith("Bearer ") === true
			? authHeader.slice(7)
			: undefined;
	const ok =
		(bearer !== undefined && safeEqual(bearer, configuredToken)) ||
		(actionTokenHeader !== undefined &&
			safeEqual(actionTokenHeader, configuredToken));
	return { allowed: ok, warnUnprotected: false };
}
