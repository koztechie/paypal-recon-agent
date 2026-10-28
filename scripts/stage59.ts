/**
 * Stage 59 marker: LLM client works — a real chat call from project code,
 * provider/model resolved from env (the abstraction requirement).
 * Run: npm run stage59
 */
import { chat } from "../src/llm.ts";

console.log(
	`provider=${process.env.LLM_PROVIDER} model=${process.env.LLM_MODEL}`,
);

// Call 1: plain instruction — proves connectivity + instruction following.
const r1 = await chat(
	"You are a concise QA bot.",
	"Reply with exactly: LLM-OK-59",
	{ maxTokens: 20, temperature: 0 },
);
console.log(
	`call1 [${r1.provider}/${r1.model}] ${r1.ms}ms -> ${JSON.stringify(r1.text.trim().slice(0, 80))}`,
);
const ok1 = r1.text.includes("LLM-OK-59");

// Call 2: different provider via the SAME abstraction (model override param path
// is env-driven; here we prove system+user structure works for the agent layer).
const r2 = await chat(
	"You are a payments assistant. Answer in ONE short line.",
	"What does a DRAFT invoice status mean in one sentence?",
	{ maxTokens: 80, temperature: 0 },
);
console.log(
	`call2 [${r2.provider}/${r2.model}] ${r2.ms}ms -> ${JSON.stringify(r2.text.trim().slice(0, 160))}`,
);
const ok2 = r2.text.trim().length > 10 && r2.text.trim().length < 400;

if (!ok1 || !ok2) throw new Error(`LLM test failed: ok1=${ok1} ok2=${ok2}`);
console.log(
	`STAGE 59 OK: chat works via ${r1.provider} (${r1.model}), ${r1.ms}ms + ${r2.ms}ms`,
);
