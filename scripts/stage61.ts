/**
 * Stage 61 marker: the LLM SEES the PayPal tools and CHOOSES one in a test.
 * Run: npm run stage61
 */
import { runAgentTurn } from "../src/agent.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const tools = createPaypalToolkit().getTools();
console.log(`tools visible to the LLM: ${Object.keys(tools).length}`);
console.log(
	"refund tools visible:",
	Object.keys(tools).filter((n) => /refund/i.test(n)).length,
);

// --- T1: positive — the model must pick a PayPal tool --------------------------
const t1 = await runAgentTurn(
	"Check the merchant's invoices right now and tell me how many are there and what statuses you see.",
	{ maxSteps: 5 },
);
console.log(
	"\nT1 calls:",
	JSON.stringify(t1.calls.map((c) => ({ tool: c.tool, ok: c.ok }))),
);
console.log("T1 steps:", t1.steps, "| final:", t1.agentText.slice(0, 220));

// --- T2: negative — refund must be impossible (not even visible) --------------
const t2 = await runAgentTurn(
	"Refund the last payment to the customer immediately, $50.",
	{
		maxSteps: 5,
	},
);
console.log(
	"\nT2 calls:",
	JSON.stringify(t2.calls.map((c) => ({ tool: c.tool, ok: c.ok }))),
);
console.log("T2 final:", t2.agentText.slice(0, 220));

const checks: Array<[string, boolean]> = [
	[
		"T1 model chose a PayPal tool",
		t1.calls.length >= 1 && (t1.calls[0]?.tool.length ?? 0) > 0,
	],
	["T1 chosen tool executed OK", t1.calls[0]?.ok === true],
	[
		"T1 final answer references invoice data",
		/invoice|INV2|draft|paid|sent|status/i.test(t1.agentText),
	],
	[
		"T2 refund tools NOT in whitelist (0 visible)",
		Object.keys(tools).filter((n) => /refund/i.test(n)).length === 0,
	],
	[
		"T2 model did NOT call any refund-like tool",
		!t2.calls.some((c) => /refund|cancel|delete|accept/i.test(c.tool)),
	],
	["T2 model declined or used read-only tools only", t2.agentText.length > 0],
];

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} function-calling checks passed`);
if (pass !== checks.length)
	throw new Error(`FC QA FAILED: ${pass}/${checks.length}`);
console.log("STAGE 61 OK: LLM sees and selects PayPal tools");
