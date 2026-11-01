// H-6: a BLOCKED action must NEVER be marked executed — executed=1 means "the
// tool really ran" (guards.ts: "caller flips it after real execution"). The
// recordExternalPayment blocked branch used to flip its own BLOCKED row before
// throwing: direct falsification of the audit log (SECURITY.md Rule 3).

import assert from "node:assert/strict";
import { test } from "node:test";
import { getDb } from "../src/db.ts";
import { recordExternalPayment } from "../src/invoicing.ts";
import type { ToolkitTools } from "../src/paypal.ts";

function mockTools() {
	const calls: unknown[] = [];
	const tools = {
		record_payment_for_invoice: {
			execute: async (a: unknown) => {
				calls.push(a);
				return JSON.stringify({ payment_id: "EXT-H6-TEST" });
			},
		},
	} as unknown as ToolkitTools;
	return { tools, calls };
}

const rowFor = (ref: string) =>
	getDb()
		.prepare(
			"SELECT limit_check, executed FROM agent_actions WHERE action = 'record_payment_for_invoice' AND target_ref = ? ORDER BY id",
		)
		.all(ref) as Array<{ limit_check: string; executed: number }>;

test("H-6a: BLOCKED (>$500) -> throws, tool NOT called, NO row marked executed", async () => {
	const ref = `H6-BLOCK-${Date.now()}`;
	const { tools, calls } = mockTools();
	await assert.rejects(
		() =>
			recordExternalPayment(tools, ref, "600.00", "USD", "over the auto limit"),
		/BLOCKED by guard/,
	);
	assert.equal(calls.length, 0, "the tool must never run");
	const rows = rowFor(ref);
	assert.ok(rows.length >= 1, "the BLOCKED decision is logged");
	assert.ok(
		rows.every((r) => r.executed === 0),
		`no row may be executed=1 after a block, got ${JSON.stringify(rows)}`,
	);
	assert.ok(
		rows.some((r) => r.limit_check === "BLOCKED"),
		"the BLOCKED decision exists",
	);
});

test("H-6b: allowed (<= $500) -> executes and the attempt is marked executed", async () => {
	const ref = `H6-OK-${Date.now()}`;
	const { tools, calls } = mockTools();
	const out = await recordExternalPayment(
		tools,
		ref,
		"40.00",
		"USD",
		"within limits",
	);
	assert.equal(calls.length, 1, "the tool ran");
	assert.equal(out.payment_id, "EXT-H6-TEST");
	const executed = rowFor(ref).filter((r) => r.executed === 1);
	assert.ok(executed.length >= 1, "the successful attempt is marked executed");
});
