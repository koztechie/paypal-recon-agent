/**
 * PayPal webhook signature verification (security finding C-1, fixed 2026-11-01).
 *
 * Every inbound event at POST /webhook must be proven authentic BEFORE it is
 * trusted: the five `PAYPAL-*` headers + event_type are sent to the sandbox/live
 * `/v1/notifications/verify-webhook-signature` endpoint (OAuth client-credentials)
 * and only `verification_status: SUCCESS` events may enter the books.
 * Fail-closed by design: a transport error or non-200 answer = rejection
 * (PayPal retries non-2xx deliveries, so a transient outage self-heals).
 */

const SIGNATURE_HEADERS = [
	"paypal-auth-algo",
	"paypal-cert-url",
	"paypal-transmission-id",
	"paypal-transmission-sig",
	"paypal-transmission-time",
] as const;

export type VerifyReason =
	| "success"
	| "failure-status"
	| "missing-headers"
	| "transport-error";

export interface VerifyOutcome {
	ok: boolean;
	reason: VerifyReason;
}

export interface VerifyDeps {
	/** Injectable for tests; defaults to global fetch. */
	fetchImpl?: typeof fetch;
	timeoutMs?: number;
}

function apiBase(): string {
	return process.env.PAYPAL_ENVIRONMENT === "LIVE"
		? "https://api-m.paypal.com"
		: "https://api-m.sandbox.paypal.com";
}

/** Short-lived OAuth token (client-credentials), cached until expiry. */
let tokenCache: { token: string; expiresAt: number } | undefined;

async function accessToken(
	fetchImpl: typeof fetch,
	timeoutMs: number,
): Promise<string> {
	if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
		return tokenCache.token;
	}
	const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
	const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? "";
	const res = await fetchImpl(`${apiBase()}/v1/oauth2/token`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!res.ok) throw new Error(`token endpoint HTTP ${res.status}`);
	const data = (await res.json()) as {
		access_token: string;
		expires_in?: number;
	};
	tokenCache = {
		token: data.access_token,
		expiresAt: Date.now() + (data.expires_in ?? 32_000) * 1000,
	};
	return tokenCache.token;
}

/**
 * Verify one inbound webhook delivery. Pure boundary check: parses the headers
 * once, delegates the decision to PayPal, never throws.
 */
export async function verifyPaypalWebhook(
	inboundHeaders: Record<string, string | string[] | undefined>,
	body: unknown,
	webhookId: string,
	deps: VerifyDeps = {},
): Promise<VerifyOutcome> {
	const fetchImpl = deps.fetchImpl ?? fetch;
	const timeoutMs = deps.timeoutMs ?? 8000;

	const header = (key: string): string | undefined => {
		const v = inboundHeaders[key];
		return Array.isArray(v) ? v[0] : v;
	};
	const collected = SIGNATURE_HEADERS.map((key) => ({
		key,
		value: header(key),
	}));
	if (collected.some((h) => !h.value))
		return { ok: false, reason: "missing-headers" };

	const eventType = (body as { event_type?: unknown } | null)?.event_type;
	const payload = {
		auth_algo: header("paypal-auth-algo"),
		cert_url: header("paypal-cert-url"),
		headers: collected,
		sig: header("paypal-transmission-sig"),
		webhook_id: webhookId,
		event_type: typeof eventType === "string" ? eventType : "",
	};

	try {
		const token = await accessToken(fetchImpl, timeoutMs);
		const res = await fetchImpl(
			`${apiBase()}/v1/notifications/verify-webhook-signature`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(timeoutMs),
			},
		);
		if (!res.ok) return { ok: false, reason: "failure-status" };
		const data = (await res.json()) as { verification_status?: string };
		return data.verification_status === "SUCCESS"
			? { ok: true, reason: "success" }
			: { ok: false, reason: "failure-status" };
	} catch {
		return { ok: false, reason: "transport-error" };
	}
}
