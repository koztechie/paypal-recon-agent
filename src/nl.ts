/**
 * Natural-language -> ledger filter (stage 84 ★).
 * One entry point: parseLedgerQuery(query). Primary source is the LLM (ADR-004 layer),
 * with a deterministic rule-based fallback — same anti-fragile pattern as the agent's
 * actions.ts + fallback.ts. The output is a small, explicit filter object the grid maps
 * onto AG Grid's filter model; the model never touches the grid or the database.
 */
import { chat } from "./llm.ts";

export interface LedgerFilter {
	kind?: "PAYMENT" | "INVOICE" | "EVENT";
	recon?: "MATCHED" | "REVIEW" | "UNMATCHED" | "PENDING";
	status?: string;
	currency?: string;
	amountMin?: number;
	amountMax?: number;
	/** YYYY-MM-DD; compared lexicographically against the ISO `at` column. */
	dateFrom?: string;
	dateTo?: string;
	/** Free-text (matches any column) — only for concrete refs/types. */
	quick?: string;
}

export interface NlResult {
	filter: LedgerFilter;
	source: "llm" | "fallback";
	ms: number;
}

const SYSTEM = `You translate a user's question about a payments/invoices ledger into ONE JSON filter object.
Allowed keys and values:
- kind: "PAYMENT" | "INVOICE" | "EVENT" (payments, invoices, webhook events)
- recon: "MATCHED" | "REVIEW" | "UNMATCHED" | "PENDING" (reconciliation status)
- status: string, e.g. "COMPLETED", "SENT", "PAID", "DRAFT" (record status)
- currency: 3-letter code, e.g. "USD", "EUR"
- amountMin: number ("over/above/more than/at least X" -> amountMin=X)
- amountMax: number ("under/below/less than/at most X" -> amountMax=X)
- dateFrom: "YYYY-MM-DD" ("since/from <date>")
- dateTo: "YYYY-MM-DD" ("until/before <date>")
- quick: short free-text fragment (ONLY when the user names a concrete id/ref/event type,
  e.g. invoice number or "invoice paid"; otherwise null)
Rules: output STRICT JSON only, no prose, no markdown, null for every unused key.
Convert words/symbols to numbers ($50, fifty -> 50). Uppercase enum values.
If the question carries no filterable condition, output {} (all nulls).`;

function stripFences(text: string): string {
	const t = text.trim();
	const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
	return (m ? m[1] : t).trim();
}

const KINDS = new Set(["PAYMENT", "INVOICE", "EVENT"]);
const RECONS = new Set(["MATCHED", "REVIEW", "UNMATCHED", "PENDING"]);

/** Validate + normalize whatever the model returned. Throws on unusable input. */
export function normalizeFilter(raw: unknown): LedgerFilter {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error("not an object");
	}
	const o = raw as Record<string, unknown>;
	const f: LedgerFilter = {};
	const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
	const num = (v: unknown) =>
		typeof v === "number" && Number.isFinite(v)
			? v
			: typeof v === "string" && v.trim() && !Number.isNaN(Number(v))
				? Number(v)
				: undefined;

	const kind = str(o.kind)?.toUpperCase();
	if (kind && KINDS.has(kind)) f.kind = kind as LedgerFilter["kind"];
	const recon = str(o.recon)?.toUpperCase();
	if (recon && RECONS.has(recon)) f.recon = recon as LedgerFilter["recon"];
	const status = str(o.status)?.toUpperCase();
	if (status) f.status = status;
	const currency = str(o.currency)?.toUpperCase();
	if (currency && /^[A-Z]{3}$/.test(currency)) f.currency = currency;
	const amountMin = num(o.amountMin);
	if (amountMin !== undefined) f.amountMin = amountMin;
	const amountMax = num(o.amountMax);
	if (amountMax !== undefined) f.amountMax = amountMax;
	const dateFrom = str(o.dateFrom);
	if (dateFrom && /^\d{4}-\d{2}-\d{2}/.test(dateFrom)) f.dateFrom = dateFrom.slice(0, 10);
	const dateTo = str(o.dateTo);
	if (dateTo && /^\d{4}-\d{2}-\d{2}/.test(dateTo)) f.dateTo = dateTo.slice(0, 10);
	const quick = str(o.quick);
	if (quick) f.quick = quick.slice(0, 80);
	return f;
}

/** Deterministic parser for common phrasings (also the LLM timeout/error fallback). */
export function fallbackParse(query: string): LedgerFilter {
	const q = query.toLowerCase();
	const f: LedgerFilter = {};
	if (/\bunmatched\b/.test(q)) f.recon = "UNMATCHED";
	else if (/\bmatched\b/.test(q)) f.recon = "MATCHED";
	else if (/\breview\b/.test(q) || /\bneeds review\b/.test(q)) f.recon = "REVIEW";
	else if (/\bpending\b/.test(q)) f.recon = "PENDING";

	if (/\binvoices?\b/.test(q)) f.kind = "INVOICE";
	else if (/\bevents?\b/.test(q) || /\bwebhooks?\b/.test(q)) f.kind = "EVENT";
	else if (/\bpayments?\b/.test(q) || /\btransactions?\b/.test(q)) f.kind = "PAYMENT";

	const over = q.match(/(?:over|above|more than|at least|>=?)\s*\$?\s*([\d.,]+)/);
	if (over) f.amountMin = Number(over[1].replace(/,/g, ""));
	const under = q.match(/(?:under|below|less than|at most|<=?)\s*\$?\s*([\d.,]+)/);
	if (under) f.amountMax = Number(under[1].replace(/,/g, ""));

	const cur = q.match(/\b(usd|eur|gbp|uah|cad|aud|chf|jpy)\b/);
	if (cur) f.currency = cur[1].toUpperCase();

	if (/\bsent\b/.test(q)) f.status = "SENT";
	else if (/\bpaid\b/.test(q)) f.status = "PAID";
	else if (/\bcompleted\b/.test(q)) f.status = "COMPLETED";
	else if (/\bdrafts?\b/.test(q)) f.status = "DRAFT";

	return f;
}

function hasCondition(f: LedgerFilter): boolean {
	return Object.keys(f).length > 0;
}

/** LLM attempt bounded by deadlineMs; falls back to rules on error/timeout/empty. */
export async function parseLedgerQuery(
	query: string,
	deadlineMs = 14_000,
): Promise<NlResult> {
	const t0 = Date.now();
	const llm = chat(SYSTEM, query, { temperature: 0, maxTokens: 256, timeoutMs: deadlineMs })
		.then((r) => {
			const parsed = JSON.parse(stripFences(r.text)) as unknown;
			const filter = normalizeFilter(parsed);
			return hasCondition(filter) ? { filter, source: "llm" as const } : null;
		})
		.catch(() => null);

	const winner = await Promise.race([
		llm,
		new Promise<null>((resolve) => setTimeout(() => resolve(null), deadlineMs + 500)),
	]);

	if (winner) return { ...winner, ms: Date.now() - t0 };
	// Deterministic fallback (covers the timeout case too — the LLM call finishes in
	// the background but never blocks the user).
	return { filter: fallbackParse(query), source: "fallback", ms: Date.now() - t0 };
}
