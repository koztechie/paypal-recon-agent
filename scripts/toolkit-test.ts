/**
 * Stage 39 marker: toolkit import works + a real sandbox tool call.
 * Run: npm run toolkit:test
 */
import { createPaypalToolkit } from "../src/paypal.ts";

const toolkit = createPaypalToolkit();
const tools = toolkit.getTools();
const names = Object.keys(tools).sort();

console.log(`tools available (${names.length}): ${names.join(", ")}`);

const list = tools.list_invoices as unknown as {
	execute?: (args: unknown, opts: unknown) => Promise<unknown>;
};

if (!list?.execute) {
	throw new Error("list_invoices tool has no execute()");
}

const result = await list.execute(
	{ page: 1, page_size: 3 },
	{ toolCallId: "stage39-test", messages: [] },
);

console.log("list_invoices ->", JSON.stringify(result).slice(0, 300));
console.log("TOOLKIT TEST OK");
