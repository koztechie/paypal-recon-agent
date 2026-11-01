// C-5: bounds for the AG Studio AI proxy (`/api/ai/responses`).
// The route forwards to OpenAI with the server key, so the edge must be hard:
//   * guardStudioAi  — LOCAL ONLY. The Studio UI runs on localhost; an evil page in
//     the user's browser carries its own Origin (and text/plain POSTs skip the
//     preflight), so the Origin/Host pair is the check that stops credit-burn.
//     A non-local Host means web/ got deployed somewhere — refuse instead of
//     exposing a key-backed proxy.
//   * validateAiBody — a single request must be bounded: ≤64 KB raw (this is also
//     the total input bound), `messages` must be an array of ≤50 entries, JSON must
//     parse. Output was already capped by max_output_tokens in the route.

export type GuardResult = { ok: true } | { ok: false; status: number; message: string };
export type BodyResult =
	| { ok: true; body: Record<string, unknown> }
	| { ok: false; status: number; message: string };

const MAX_BODY_CHARS = 64 * 1024;
const MAX_MESSAGES = 50;

function isLocalHost(host: string | undefined): boolean {
	if (!host) return false;
	const bare = (host.split(":")[0] ?? "").replace(/^\[|\]$/g, "");
	return bare === "localhost" || bare === "127.0.0.1" || bare === "::1";
}

export function guardStudioAi(origin: string | undefined, host: string | undefined): GuardResult {
	if (!isLocalHost(host)) {
		return { ok: false, status: 503, message: "The AI assistant is local-demo only." };
	}
	if (origin === undefined) return { ok: true }; // curl / server-side tooling
	if (origin === "null") {
		return { ok: false, status: 503, message: "The AI assistant is local-demo only." };
	}
	const originHost = origin.replace(/^https?:\/\//, "").split("/")[0];
	if (!isLocalHost(originHost)) {
		return { ok: false, status: 503, message: "The AI assistant is local-demo only." };
	}
	return { ok: true };
}

export function validateAiBody(text: string): BodyResult {
	if (text.length > MAX_BODY_CHARS) {
		return { ok: false, status: 413, message: `Request body exceeds ${MAX_BODY_CHARS} bytes.` };
	}
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return { ok: false, status: 400, message: "Request body must be JSON." };
	}
	if (typeof body !== "object" || body === null) {
		return { ok: false, status: 400, message: "Request body must be a JSON object." };
	}
	const messages = (body as Record<string, unknown>).messages;
	if (messages !== undefined) {
		if (!Array.isArray(messages)) {
			return { ok: false, status: 400, message: "`messages` must be an array." };
		}
		if (messages.length > MAX_MESSAGES) {
			return { ok: false, status: 400, message: `At most ${MAX_MESSAGES} messages per request.` };
		}
	}
	return { ok: true, body: body as Record<string, unknown> };
}
