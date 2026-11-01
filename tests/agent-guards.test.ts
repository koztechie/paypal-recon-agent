// H-1: the agentic loop must run EVERY tool through the same guardrails the README
// claims: enforceActionPolicy (money/red-list) + checkReminderAllowed (rate limit),
// with blocked attempts visible to the model and marked in the audit trail.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { z } from "zod";
import { runAgentTurn } from "../src/agent.ts";
import type { chatRaw } from "../src/llm.ts";
import type { ToolkitTools } from "../src/paypal.ts";

type Chat = typeof chatRaw;
const fnCall = (name: string, args: Record<string, unknown>) => ({
	candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }],
});
const said = (t: string) => ({
	candidates: [{ content: { parts: [{ text: t }] } }],
});

function scripted(queue: Array<ReturnType<typeof fnCall | typeof said>>) {
	const seen: unknown[] = [];
	const chat = (async (_p: string, extra: { contents: unknown[] }) => {
		seen.push(structuredClone(extra.contents));
		return queue.shift() ?? said("(done)");
	}) as unknown as Chat;
	return { chat, seen };
}

function spyKit() {
	const calls: Array<{ tool: string; args: unknown }> = [];
	const mk = (name: string) => ({
		// A real (loose) zod schema: toolDeclarations() prints JSON schemas from _def,
		// and loose parsing keeps every key so the amount extractor sees `items`.
		parameters: z.looseObject({}),
		execute: async (a: unknown) => {
			calls.push({ tool: name, args: a });
			return { ok: true, executed_by: name };
		},
	});
	const tools = {
		create_invoice: mk("create_invoice"),
		send_invoice_reminder: mk("send_invoice_reminder"),
		list_invoices: mk("list_invoices"),
	} as unknown as ToolkitTools;
	return { tools, calls };
}

const FEEDBACK = (seen: unknown[], turn = 1) =>
	JSON.stringify(seen[turn] ?? "");

test("H-1a: create_invoice over $500 -> BLOCKED, never executed, model told why", async () => {
	const { tools, calls } = spyKit();
	const { chat, seen } = scripted([
		fnCall("create_invoice", {
			currency_code: "USD",
			items: [
				{
					name: "x",
					quantity: "1",
					unit_amount: { currency_code: "USD", value: "600.00" },
				},
			],
		}),
		said("cannot proceed"),
	]);
	const out = await runAgentTurn("make a $600 invoice", {
		tools,
		chat,
		maxSteps: 3,
	});
	assert.equal(calls.length, 0, "money tool must NOT execute");
	assert.equal(out.calls[0]?.ok, false);
	assert.match(
		FEEDBACK(seen, 1),
		/exceeds agent auto-limit|BLOCKED/,
		"model receives the refusal",
	);
});

test("H-1b: create_invoice within $500 -> allowed and executed", async () => {
	const { tools, calls } = spyKit();
	const { chat } = scripted([
		fnCall("create_invoice", {
			currency_code: "USD",
			items: [
				{
					name: "x",
					quantity: "2",
					unit_amount: { currency_code: "USD", value: "40.00" },
				},
			],
		}),
		said("done"),
	]);
	const out = await runAgentTurn("make an $80 invoice", {
		tools,
		chat,
		maxSteps: 3,
	});
	assert.equal(calls.length, 1, "policy allows <= $500");
	assert.equal(out.calls[0]?.ok, true);
});

test("H-1c: create_invoice with UNPARSEABLE amount -> fail-closed BLOCKED", async () => {
	const { tools, calls } = spyKit();
	const { chat, seen } = scripted([
		fnCall("create_invoice", { currency_code: "USD" }),
		said("ok"),
	]);
	await runAgentTurn("invoice with no amount", { tools, chat, maxSteps: 3 });
	assert.equal(calls.length, 0, "unparseable money call must not execute");
	assert.match(FEEDBACK(seen, 1), /unparseable|BLOCKED/);
});

test("H-1d: send_invoice_reminder hits the24h ledger -> blocked, never executed", async () => {
	mkdirSync("logs", { recursive: true });
	const LEDGER = "logs/reminders.json";
	const backup = existsSync(LEDGER) ? readFileSync(LEDGER, "utf8") : null;
	try {
		const now = new Date().toISOString();
		writeFileSync(LEDGER, JSON.stringify({ "INV-GUARD-BLOCK": [now] }));
		const { tools, calls } = spyKit();
		const { chat, seen } = scripted([
			fnCall("send_invoice_reminder", { invoice_id: "INV-GUARD-BLOCK" }),
			said("understood"),
		]);
		await runAgentTurn("remind INV-GUARD-BLOCK", { tools, chat, maxSteps: 3 });
		assert.equal(calls.length, 0, "rate-limited reminder must not execute");
		assert.match(FEEDBACK(seen, 1), /24h limit|BLOCKED/);
	} finally {
		if (backup === null) writeFileSync(LEDGER, "{}");
		else writeFileSync(LEDGER, backup);
	}
});

test("H-1e: read-only tool passes untouched", async () => {
	const { tools, calls } = spyKit();
	const { chat } = scripted([
		fnCall("list_invoices", { page: 1 }),
		said("here"),
	]);
	const out = await runAgentTurn("list invoices", { tools, chat, maxSteps: 3 });
	assert.equal(calls.length, 1, "reads are not money actions");
	assert.equal(out.calls[0]?.ok, true);
});
