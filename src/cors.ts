/**
 * CORS as an explicit allowlist — security finding C-3 (fixed 2026-11-01).
 * The wildcard is gone: a response carries CORS headers only for the service's own
 * origin (same-origin mini-demo) or an origin listed in `CORS_ORIGINS` (comma
 * separated, e.g. the local UI `http://localhost:3001`). Every foreign origin gets
 * NOTHING: browsers then refuse to read the response and preflights fail, so a
 * malicious page can neither read the ledger nor drive state-changing calls
 * (those additionally require the C-2 `ACTION_TOKEN`).
 */

export function corsHeadersFor(
	origin: string | undefined,
	hostHeader: string,
	allowlist: string[],
): Record<string, string> | null {
	if (!origin) return null; // curl / same-origin GET / server-to-server
	if (!/^https?:\/\//.test(origin)) return null; // "null", opaque or malformed
	const originHost = origin.replace(/^https?:\/\//, "").split("/")[0] ?? "";
	const hostOnly = hostHeader.split(":")[0] ?? "";
	const sameOrigin = originHost === hostHeader || originHost === hostOnly;
	if (sameOrigin || allowlist.includes(origin)) {
		return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
	}
	return null;
}
