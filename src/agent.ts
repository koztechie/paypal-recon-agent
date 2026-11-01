/**
 * Agentic function-calling loop (stage 61): the LLM sees the PayPal tools from
 * the Agent Toolkit (whitelist-filtered), CHOOSES one, we validate args against
 * the tool's own zod schema, execute via the toolkit, feed the result back,
 * and the model produces the final natural-language answer.
 *
 * Gemini native functionDeclarations + multi-turn content parts (including the
 * thoughtSignature returned with a functionCall part, per Gemini docs).
 */
import { toJSONSchema } from "zod";
import { logAgentAction, markAgentActionExecutedById } from "./auditlog.ts";
import { enforceActionPolicy } from "./guards.ts";
import { checkReminderAllowed } from "./invoicing.ts";
import { chatRaw } from "./llm.ts";
import { createPaypalToolkit, type ToolkitTools } from "./paypal.ts";
import { AGENT_SYSTEM_PROMPT } from "./prompts.ts";

export interface AgentToolResult {
	agentText: string;
	calls: Array<{ tool: string; args: unknown; ok: boolean }>;
	steps: number;
}

type Part = Record<string, unknown>;

/** Gemini Schema accepts only a subset of JSON-Schema keywords — strip the rest. */
const GEMINI_ALLOWED = new Set([
	"type",
	"format",
	"description",
	"enum",
	"items",
	"properties",
	"required",
	"nullable",
	"default",
	"minimum",
	"maximum",
	"minLength",
	"maxLength",
	"minItems",
	"maxItems",
]);

function sanitizeForGemini(node: unknown): unknown {
	if (Array.isArray(node)) return node.map(sanitizeForGemini);
	if (node && typeof node === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
			if (k.startsWith("$")) continue; // $schema/$defs/$ref unsupported
			if (
				k === "properties" &&
				v &&
				typeof v === "object" &&
				!Array.isArray(v)
			) {
				// Inside `properties` the KEYS are property names — sanitize VALUES only.
				const props: Record<string, unknown> = {};
				for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
					props[pk] = sanitizeForGemini(pv);
				}
				out.properties = props;
				continue;
			}
			if (k === "type" && Array.isArray(v)) {
				// zod4 native nullable encodes `["string","null"]`; Gemini's proto rejects a
				// repeated `type`, so normalize to the OpenAPI-ish shape the old converter
				// produced: plain type + nullable:true (nullable is in GEMINI_ALLOWED).
				const types = v.filter((x): x is string => typeof x === "string");
				if (types.includes("null")) out.nullable = true;
				out.type = types.find((x) => x !== "null") ?? types[0] ?? "string";
				continue;
			}
			if (!GEMINI_ALLOWED.has(k)) continue;
			out[k] = sanitizeForGemini(v);
		}
		return out;
	}
	return node;
}

function toolDeclarations(tools: ToolkitTools) {
	return Object.entries(tools).map(([name, tool]) => {
		const t = tool as unknown as { description?: string; parameters?: unknown };
		// zod4 native converter: the C-4 zod override made zod-to-json-schema@3 emit
		// EMPTY parameter schemas (regression caught by re-running the stage-73 caller),
		// which silently made the model send {} args. Native output keeps
		// properties/required; sanitizeForGemini() drops $schema/additionalProperties.
		const schema = toJSONSchema(t.parameters as never) as Record<
			string,
			unknown
		>;
		return {
			name,
			description: (t.description ?? name).slice(0, 900),
			parameters: sanitizeForGemini(schema),
		};
	});
}

/** Amount in minor units for money-carrying tools;0 otherwise; NaN = unparseable (fail-closed below). */
function moneyMinorOf(toolName: string, args: Record<string, unknown>): number {
	if (toolName === "record_payment_for_invoice") {
		const v = Number(args.amount);
		return Number.isFinite(v) ? Math.round(v * 100) : Number.NaN;
	}
	if (toolName === "create_invoice") {
		const items = Array.isArray(args.items) ? args.items : [];
		if (items.length === 0) return Number.NaN;
		let total = 0;
		for (const it of items) {
			const o = it as { unit_amount?: { value?: unknown }; quantity?: unknown };
			const v = Number(o?.unit_amount?.value);
			const q = Number(o?.quantity ?? 1);
			if (!Number.isFinite(v) || !Number.isFinite(q)) return Number.NaN;
			total += Math.round(v * 100) * q;
		}
		return total;
	}
	return 0;
}

function targetRefOf(args: Record<string, unknown>): string | undefined {
	for (const key of ["invoice_id", "item_name", "itemName", "id"]) {
		const v = args[key];
		if (typeof v === "string" && v) return v.slice(0, 120);
	}
	return undefined;
}

/**
 * H-1: the loop executes tools ONLY through the same guardrails the README claims —
 * reminder rate-limit, then enforceActionPolicy (money + red list), fail-closed on an
 * unparseable amount. Every decision is audited; a refusal reason goes back to the
 * model. Returns null when the call may proceed.
 */
function guardAgentTool(
	toolName: string,
	args: Record<string, unknown>,
): { refusal: string | null; logId?: number } {
	const ref = targetRefOf(args);
	if (toolName === "send_invoice_reminder") {
		const rate = checkReminderAllowed(String(args.invoice_id ?? ""));
		if (!rate.allowed) {
			logAgentAction({
				action: toolName,
				limitCheck: "BLOCKED",
				targetRef: ref,
				executed: false,
				llmDecision: `system-policy -> BLOCKED: ${rate.reason}`,
			});
			return { refusal: rate.reason };
		}
	}
	const minor = moneyMinorOf(toolName, args);
	if (Number.isNaN(minor)) {
		logAgentAction({
			action: toolName,
			limitCheck: "BLOCKED",
			targetRef: ref,
			executed: false,
			llmDecision: "system-policy -> BLOCKED: unparseable amount (fail-closed)",
		});
		return {
			refusal: "BLOCKED: unparseable amount for a money action (fail-closed)",
		};
	}
	const decision = enforceActionPolicy(toolName, minor, {
		targetRef: ref,
		currency:
			typeof args.currency_code === "string"
				? args.currency_code
				: typeof args.currency === "string"
					? args.currency
					: "USD",
	});
	return decision.allowed
		? { refusal: null, logId: decision.logId }
		: { refusal: decision.reason };
}

export async function runAgentTurn(
	userPrompt: string,
	opts: { maxSteps?: number; tools?: ToolkitTools; chat?: typeof chatRaw } = {},
): Promise<AgentToolResult> {
	const tools = opts.tools ?? createPaypalToolkit().getTools();
	const chat = opts.chat ?? chatRaw;
	const declarations = toolDeclarations(tools);
	const maxSteps = opts.maxSteps ?? 6;
	const contents: Part[] = [{ role: "user", parts: [{ text: userPrompt }] }];
	const calls: AgentToolResult["calls"] = [];
	let finalText = "";

	for (let step = 1; step <= maxSteps; step++) {
		const res = await chat(userPrompt, {
			contents,
			functionDeclarations: declarations,
			system: AGENT_SYSTEM_PROMPT,
		});
		const candidate = res.candidates?.[0];
		const parts = (candidate?.content?.parts ?? []) as Part[];
		const fnCall = parts.find((p) => p.functionCall) as
			| { functionCall: { name: string; args: Record<string, unknown> } }
			| undefined;

		if (!fnCall) {
			finalText = parts
				.map((p) => (p.text as string) ?? "")
				.join("")
				.trim();
			return { agentText: finalText, calls, steps: step };
		}

		// Echo the full part (incl. thoughtSignature) back for context continuity.
		contents.push({ role: "model", parts });
		const { name, args } = fnCall.functionCall;
		let response: unknown;
		let ok = true;
		try {
			const tool = tools[name] as unknown as
				| {
						parameters?: { parse?: (a: unknown) => unknown };
						execute?: (a: unknown, o: unknown) => Promise<unknown>;
				  }
				| undefined;
			if (!tool?.execute)
				throw new Error(`tool ${name} not available in whitelist`);
			const validated = tool.parameters?.parse
				? tool.parameters.parse(args)
				: args;
			// H-1 choke point: guardrails BEFORE execution, exactly as README claims.
			const guard = guardAgentTool(
				name,
				(validated ?? {}) as Record<string, unknown>,
			);
			if (guard.refusal) {
				response = { blocked: true, error: guard.refusal };
				ok = false;
			} else {
				response = await tool.execute(validated, {
					toolCallId: `agent-${step}`,
					messages: [],
				});
				// Toolkit returns JSON strings; keep the shape predictable for the model.
				if (typeof response === "string") {
					try {
						response = JSON.parse(response);
					} catch {
						/* keep raw string */
					}
				}
				markAgentActionExecutedById(guard.logId ?? 0);
			}
		} catch (e) {
			ok = false;
			response = { error: e instanceof Error ? e.message : String(e) };
		}
		if (response == null) response = { success: true };
		calls.push({ tool: name, args, ok });
		contents.push({
			role: "user",
			parts: [
				{
					functionResponse: {
						name,
						response: response as Record<string, unknown>,
					},
				},
			],
		});
	}

	return {
		agentText: finalText || "(max steps reached)",
		calls,
		steps: maxSteps,
	};
}
