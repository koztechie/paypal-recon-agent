/**
 * Stage 73 marker (phase criterion, R2): the AI is substantively in the loop —
 * the LLM makes a decision, the tool executes, the PayPal STATUS CHANGES.
 * Scenario (terminal-recorded video): invoice created (DRAFT) -> the agent
 * (LLM function-calling loop) decides to deliver it -> send_invoice executes ->
 * status DRAFT -> SENT.
 * Run: npm run stage73
 */
import { runAgentTurn } from "../src/agent.ts";
import { createDraftInvoice } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const tools = createPaypalToolkit().getTools();
const NUM = String((Date.now() % 9000) + 1000);
const exec = (t: unknown) =>
	t as { execute: (a: unknown, o: unknown) => Promise<string> };
const step = (s: string) => console.log(`>> ${s}`);

step("STEP 1: create invoice (PayPal status = DRAFT)");
const rec = await createDraftInvoice(tools, {
	buyerEmail: process.env.SANDBOX_BUYER_EMAIL as string,
	itemName: `Stage 73 AI-in-the-loop demo #${NUM}`,
	amount: "68.00",
	note: "LLM decision demo: deliver this invoice",
	invoiceNumber: NUM,
});
const invoiceId = rec.id as string;
const before = JSON.parse(
	await exec(tools.get_invoice).execute(
		{ invoice_id: invoiceId },
		{ toolCallId: "before", messages: [] },
	),
) as { status?: string };
step(`status BEFORE: ${before.status} | invoice #${NUM} ${invoiceId}`);

step("STEP 2: ask the AGENT (LLM) to act — no manual action");
const decision = await runAgentTurn(
	`Invoice #${NUM} (${invoiceId}) was reviewed and the customer must receive it now. ` +
		`Use your PayPal tools to deliver this invoice to the buyer immediately, then confirm in one line what you did.`,
	{ maxSteps: 4, tools },
);
step(
	`LLM decision -> tool call: [${decision.calls.map((c) => `${c.tool} ok=${c.ok}`).join(", ") || "NONE"}]`,
);
step(`LLM final: ${decision.agentText.slice(0, 160)}`);

step("STEP 3: verify the status in PayPal");
const after = JSON.parse(
	await exec(tools.get_invoice).execute(
		{ invoice_id: invoiceId },
		{ toolCallId: "after", messages: [] },
	),
) as { status?: string };
step(`status AFTER: ${after.status}`);

const checks: Array<[string, boolean]> = [
	["invoice started as DRAFT", before.status === "DRAFT"],
	[
		"LLM chose the send_invoice tool (its decision)",
		decision.calls.some((c) => c.tool === "send_invoice"),
	],
	[
		"the chosen tool executed OK",
		decision.calls.find((c) => c.tool === "send_invoice")?.ok === true,
	],
	["status CHANGED DRAFT -> SENT in PayPal", after.status === "SENT"],
	["LLM gave a confirmation line", decision.agentText.trim().length > 10],
];

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} AI-in-the-loop checks passed`);
if (pass !== checks.length)
	throw new Error(`R2 CRITERION FAILED: ${pass}/${checks.length}`);
console.log(
	`STAGE 73 OK: LLM decided -> PayPal executed -> status ${before.status} -> ${after.status} (zero manual steps)`,
);
