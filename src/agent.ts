/**
 * Agentic function-calling loop (stage 61): the LLM sees the PayPal tools from
 * the Agent Toolkit (whitelist-filtered), CHOOSES one, we validate args against
 * the tool's own zod schema, execute via the toolkit, feed the result back,
 * and the model produces the final natural-language answer.
 *
 * Gemini native functionDeclarations + multi-turn content parts (including the
 * thoughtSignature returned with a functionCall part, per Gemini docs).
 */
import { zodToJsonSchema } from "zod-to-json-schema";
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
		const schema = zodToJsonSchema(t.parameters as never, {
			target: "openApi3",
		}) as Record<string, unknown>;
		return {
			name,
			description: (t.description ?? name).slice(0, 900),
			parameters: sanitizeForGemini(schema),
		};
	});
}

export async function runAgentTurn(
	userPrompt: string,
	opts: { maxSteps?: number; tools?: ToolkitTools } = {},
): Promise<AgentToolResult> {
	const tools = opts.tools ?? createPaypalToolkit().getTools();
	const declarations = toolDeclarations(tools);
	const maxSteps = opts.maxSteps ?? 6;
	const contents: Part[] = [{ role: "user", parts: [{ text: userPrompt }] }];
	const calls: AgentToolResult["calls"] = [];
	let finalText = "";

	for (let step = 1; step <= maxSteps; step++) {
		const res = await chatRaw(userPrompt, {
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
