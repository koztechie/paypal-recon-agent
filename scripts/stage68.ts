/**
 * Stage 68 marker: guards — amount limit, refund-like big actions refused without
 * human approval, every LLM/system decision logged.
 * Run: npm run stage68
 */
import { getDb } from "../src/db.ts";
import {
	AGENT_AUTO_LIMIT_MINOR,
	guardedMoneyAction,
	RED_LIST_ACTIONS,
} from "../src/guards.ts";

const checks: Array<[string, boolean]> = [];
const db = getDb();

const before = (
	db.prepare("SELECT count(*) c FROM agent_actions").get() as { c: number }
).c;

// --- T1: BIG money action ($900 > $500) -> refused + logged -------------------
let t1 = "";
try {
	await guardedMoneyAction(
		"create_invoice",
		900_00,
		async () => "SHOULD-NOT-RUN",
		{ llmDecision: "LLM proposed creating a $900 invoice", targetRef: "t1" },
	);
} catch (e) {
	t1 = e instanceof Error ? e.message : String(e);
}
console.log(`T1: ${t1.slice(0, 110)}`);
checks.push(["T1 amount > $500 refused", /exceeds agent auto-limit/.test(t1)]);
checks.push([
	"T1 reason cites human approval",
	/human approval required/.test(t1),
]);

// --- T2: refund (red list, any amount) -> refused + logged --------------------
let t2 = "";
try {
	await guardedMoneyAction(
		"record_refund_for_invoice",
		1_00,
		async () => "SHOULD-NOT-RUN",
		{
			llmDecision: "LLM proposed refunding $1.00",
		},
	);
} catch (e) {
	t2 = e instanceof Error ? e.message : String(e);
}
console.log(`T2: ${t2.slice(0, 110)}`);
checks.push(["T2 refund refused at ANY amount", /red list/.test(t2)]);
checks.push([
	"T2 red list covers all 5 forbidden tools",
	RED_LIST_ACTIONS.size >= 5,
]);

// --- T3: small allowed action -> executes ------------------------------------
let t3 = "";
try {
	t3 = await guardedMoneyAction(
		"create_invoice",
		50_00,
		async () => "EXECUTED",
		{
			llmDecision: "LLM proposed a $50 invoice",
		},
	);
} catch (e) {
	t3 = `FAIL: ${e instanceof Error ? e.message : e}`;
}
checks.push(["T3 small action executes", t3 === "EXECUTED"]);

// --- T4: policy table sanity --------------------------------------------------
checks.push([
	"T4 limit constant = $500 (SECURITY rule 1)",
	AGENT_AUTO_LIMIT_MINOR === 50000,
]);

// --- T5: real wrapper refused a too-big invoice (defense in depth, no API call)
const { createDraftInvoice } = await import("../src/invoicing.ts");
const { createPaypalToolkit } = await import("../src/paypal.ts");
let t5 = "";
try {
	await createDraftInvoice(createPaypalToolkit().getTools(), {
		buyerEmail: "blocked@example.com",
		itemName: "t5-should-be-blocked",
		amount: "999.00",
	});
} catch (e) {
	t5 = e instanceof Error ? e.message : String(e);
}
checks.push([
	"T5 createDraftInvoice refuses $999 at the wrapper level",
	/exceeds agent auto-limit/.test(t5),
]);

// --- T6: decisions logged with reasons ---------------------------------------
const after = db.prepare("SELECT count(*) c FROM agent_actions").get() as {
	c: number;
};
const recent = db
	.prepare(
		"SELECT limit_check, llm_decision FROM agent_actions ORDER BY id DESC LIMIT 6",
	)
	.all() as Array<{ limit_check: string; llm_decision: string }>;
checks.push(["T6 new rows appended (>=3)", after.c - before >= 3]);
checks.push([
	"T6 BLOCKED rows carry the reason",
	recent
		.filter((r) => r.limit_check === "BLOCKED")
		.every((r) => r.llm_decision.length > 20),
]);
checks.push([
	"T6 LLM/system decision text recorded",
	recent.some((r) => /LLM|system-policy/.test(r.llm_decision)),
]);

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} guard checks passed`);
if (pass !== checks.length)
	throw new Error(`GUARD QA FAILED: ${pass}/${checks.length}`);
console.log("STAGE 68 OK: big/deadly actions refused + every decision logged");
