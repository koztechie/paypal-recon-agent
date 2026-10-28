/**
 * LLM abstraction layer (stage 59, ADR-004): ONE entry point, provider/model
 * selected by env vars (LLM_PROVIDER / LLM_MODEL / LLM_API_KEY).
 * Supported providers: gemini (default), openrouter, groq, openai.
 * All calls wrapped in withRetry (stage 55): transient errors get backoff.
 */
import { withRetry } from "./retry.ts";

export interface ChatResult {
	text: string;
	provider: string;
	model: string;
	ms: number;
}

export interface ChatOptions {
	system?: string;
	temperature?: number;
	maxTokens?: number;
	timeoutMs?: number;
}

function config(): { provider: string; model: string; key: string } {
	const provider = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase();
	const key = process.env.LLM_API_KEY ?? "";
	if (!key || key.startsWith("REPLACE")) {
		throw new Error("LLM_API_KEY is missing (see .env.example)");
	}
	let model = process.env.LLM_MODEL ?? "";
	if (!model) {
		model =
			provider === "gemini"
				? "gemini-3.5-flash-lite"
				: "llama-3.3-70b-versatile";
	}
	return { provider, model, key };
}

async function postJson(
	url: string,
	headers: Record<string, string>,
	body: unknown,
	timeoutMs: number,
): Promise<unknown> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...headers },
			body: JSON.stringify(body),
			signal: ctrl.signal,
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
		}
		return JSON.parse(text) as unknown;
	} finally {
		clearTimeout(timer);
	}
}

/** Single chat turn. Returns the model's plain text. */
export async function chat(
	system: string,
	user: string,
	opts: ChatOptions = {},
): Promise<ChatResult> {
	const { provider, model, key } = config();
	const t0 = Date.now();
	const timeout = opts.timeoutMs ?? 30_000;

	const text = await withRetry(
		async () => {
			if (provider === "gemini") {
				const data = (await postJson(
					`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
					{ "x-goog-api-key": key },
					{
						systemInstruction: system
							? { parts: [{ text: system }] }
							: undefined,
						contents: [{ role: "user", parts: [{ text: user }] }],
						generationConfig: {
							temperature: opts.temperature ?? 0,
							maxOutputTokens: opts.maxTokens ?? 512,
						},
					},
					timeout,
				)) as {
					candidates?: Array<{
						content?: { parts?: Array<{ text?: string }> };
					}>;
				};
				const out =
					data.candidates?.[0]?.content?.parts
						?.map((p) => p.text ?? "")
						.join("") ?? "";
				if (!out)
					throw new Error(
						"HTTP 422 empty response: no candidates/text from gemini",
					);
				return out;
			}
			// OpenAI-compatible: openrouter | groq | openai
			const base =
				provider === "groq"
					? "https://api.groq.com/openai/v1"
					: provider === "openrouter"
						? "https://openrouter.ai/api/v1"
						: "https://api.openai.com/v1";
			const data = (await postJson(
				`${base}/chat/completions`,
				{ Authorization: `Bearer ${key}` },
				{
					model,
					temperature: opts.temperature ?? 0,
					max_tokens: opts.maxTokens ?? 512,
					messages: [
						...(system ? [{ role: "system", content: system }] : []),
						{ role: "user", content: user },
					],
				},
				timeout,
			)) as { choices?: Array<{ message?: { content?: string } }> };
			const out = data.choices?.[0]?.message?.content ?? "";
			if (!out)
				throw new Error(`HTTP 422 empty response: no content from ${provider}`);
			return out;
		},
		{ retries: 2, baseMs: 500, action: "llm_chat" },
	);

	return { text, provider, model, ms: Date.now() - t0 };
}

export interface RawChatResponse {
	candidates?: Array<{
		content?: { parts?: Array<Record<string, unknown>> };
		finishReason?: string;
	}>;
}

/**
 * Low-level multi-turn call WITH native functionDeclarations (stage 61).
 * Gemini only — other providers need an adapter (kept out of scope on purpose:
 * ADR-004 primary provider is gemini).
 */
export async function chatRaw(
	_user: string,
	extra: { contents: unknown[]; functionDeclarations: unknown[] },
): Promise<RawChatResponse> {
	const { provider, model, key } = config();
	if (provider !== "gemini") {
		throw new Error(
			`chatRaw: function calling implemented for gemini only (got ${provider})`,
		);
	}
	return withRetry(
		async () =>
			(await postJson(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
				{ "x-goog-api-key": key },
				{
					contents: extra.contents,
					tools: [{ functionDeclarations: extra.functionDeclarations }],
					generationConfig: { temperature: 0, maxOutputTokens: 1024 },
				},
				45_000,
			)) as RawChatResponse,
		{ retries: 2, baseMs: 500, action: "llm_chat_raw" },
	);
}
