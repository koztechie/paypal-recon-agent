/**
 * API error handling (stage 55): classified errors, exponential backoff for
 * TRANSIENT failures only, clear messages, state-safe (log-before-execute means
 * a failed attempt never flips executed=1; retries are idempotent from the log's
 * perspective).
 */
import { logAgentAction } from "./auditlog.ts";

export type ErrorKind = "transient" | "validation" | "auth" | "unknown";

export class ApiError extends Error {
	kind: ErrorKind;
	status?: number;
	attempts: number;
	constructor(kind: ErrorKind, message: string, status?: number, attempts = 1) {
		super(message);
		this.kind = kind;
		this.status = status;
		this.attempts = attempts;
	}
}

const TRANSIENT_PATTERNS = [
	/ECONNREFUSED/i,
	/ENOTFOUND/i,
	/ECONNRESET/i,
	/ETIMEDOUT/i,
	/EAI_AGAIN/i,
	/fetch failed/i,
	/network/i,
	/socket hang up/i,
	/429/,
	/50[0-9]/,
	/TIMEOUT/i,
];

const AUTH_PATTERNS = [/401/, /403/, /invalid_client/i, /token/i];

export function classifyError(err: unknown): {
	kind: ErrorKind;
	message: string;
} {
	const raw = err instanceof Error ? err.message : String(err);
	// Order matters: transient FIRST (ports like :443 must not match 4xx patterns),
	// then auth (401/403), then generic validation (400/422...), else unknown.
	if (TRANSIENT_PATTERNS.some((p) => p.test(raw))) {
		return { kind: "transient", message: clearMessage(raw) };
	}
	if (AUTH_PATTERNS.some((p) => p.test(raw))) {
		return { kind: "auth", message: clearMessage(raw) };
	}
	if (
		/\b4\d\d\b/.test(raw) ||
		/\bVALIDATION_ERROR\b/.test(raw) ||
		/Cannot construct instance/i.test(raw)
	) {
		return { kind: "validation", message: clearMessage(raw) };
	}
	return { kind: "unknown", message: clearMessage(raw) };
}

function clearMessage(raw: string): string {
	// Strip noisy internals; keep actionable text.
	return raw.replace(/\s+/g, " ").slice(0, 300);
}

export interface RetryOptions {
	retries?: number; // additional attempts after the first (default 3)
	baseMs?: number; // backoff base (default 400)
	action?: string; // for agent_actions audit on failure
}

/** Retry TRANSIENT errors with exponential backoff; never retry validation/auth. */
export async function withRetry<T>(
	fn: () => Promise<T>,
	opts: RetryOptions = {},
): Promise<T> {
	const retries = opts.retries ?? 3;
	const base = opts.baseMs ?? 400;
	let lastErr: unknown;
	for (let attempt = 1; attempt <= retries + 1; attempt++) {
		try {
			return await fn();
		} catch (e) {
			lastErr = e;
			const { kind, message } = classifyError(e);
			if (kind !== "transient" || attempt === retries + 1) {
				if (opts.action) {
					logAgentAction({
						action: opts.action,
						limitCheck: "BLOCKED",
						executed: false,
						llmDecision: `${kind}: ${message} (attempts=${attempt})`,
					});
				}
				throw new ApiError(kind, message, undefined, attempt);
			}
			const delay = base * 2 ** (attempt - 1);
			console.log(
				`[retry] ${kind} (attempt ${attempt}/${retries + 1}) -> ${delay}ms: ${message.slice(0, 80)}`,
			);
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	throw lastErr;
}
