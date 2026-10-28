/**
 * Stage 60 marker: system prompt in code as a VERSIONED file; it actually works.
 * Run: npm run stage60
 */
import { existsSync, readFileSync } from "node:fs";
import { chat } from "../src/llm.ts";
import { AGENT_PROMPT_VERSION, AGENT_SYSTEM_PROMPT } from "../src/prompts.ts";

const checks: Array<[string, boolean]> = [];
const file = "src/prompts/agent.system.md";

checks.push(["versioned file exists", existsSync(file)]);
checks.push([
	"version is semver-like (v1.x)",
	/^v\d+\.\d+$/.test(AGENT_PROMPT_VERSION),
]);
const raw = readFileSync(file, "utf8");
checks.push(["contains role section", /## Role/.test(raw)]);
checks.push([
	"contains hard limits (red list)",
	/FORBIDDEN for you/.test(raw) && /refunds/.test(raw),
]);
checks.push([
	"contains match policy (exact only)",
	/MATCH only on EXACT agreement/.test(raw),
]);
checks.push([
	"contains response language (English, R12)",
	/English \(product language; all submission materials must be English, R12\)/.test(
		raw,
	),
]);
checks.push(["loaded prompt non-trivial", AGENT_SYSTEM_PROMPT.length > 500]);

// Live: the prompt must steer the model.
const r = await chat(
	AGENT_SYSTEM_PROMPT,
	"What is your role? Answer in one line.",
	{
		maxTokens: 60,
		temperature: 0,
	},
);
console.log(
	`model reply [${r.provider}/${r.model}] ${r.ms}ms: ${r.text.trim().slice(0, 160)}`,
);
checks.push([
	"prompt steers model (mentions reconciliation/invoice)",
	/reconcil|invoice/i.test(r.text),
]);

// Limits must be reflected when asked directly.
const r2 = await chat(
	AGENT_SYSTEM_PROMPT,
	"May you issue a refund? One line.",
	{
		maxTokens: 60,
		temperature: 0,
	},
);
console.log(`limits reply: ${r2.text.trim().slice(0, 160)}`);
checks.push([
	"prompt limit respected in reply (no/refund forbidden)",
	/no|not|never|forbidden|human/i.test(r2.text),
]);

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} prompt checks passed`);
if (pass !== checks.length)
	throw new Error(`PROMPT QA FAILED: ${pass}/${checks.length}`);
console.log(
	`STAGE 60 OK: system prompt ${AGENT_PROMPT_VERSION} in code and effective`,
);
