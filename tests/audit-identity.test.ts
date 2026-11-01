// H-7: the audit log must be (a) ONE row per decision+attempt (enforceActionPolicy
// and the wrapper used to log the same PASS twice) and (b) identity-based when
// flipping executed=1 — "flip the newest not-executed row for this action" raced
// under concurrency and could flip a DIFFERENT record (especially with an
// undefined target_ref, where it matched ANY pending row of that action).

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	logAgentAction,
	markAgentActionExecutedById,
} from "../src/auditlog.ts";
import { getDb } from "../src/db.ts";
import { createDraftInvoice, recordExternalPayment } from "../src/invoicing.ts";
import type { ToolkitTools } from "../src/paypal.ts";

const db = () => getDb();
const rowsFor = (action: string, ref: string) =>
	db()
		.prepare(
			"SELECT id, executed FROM agent_actions WHERE action = ? AND target_ref = ? ORDER BY id",
		)
		.all(action, ref) as Array<{ id: number; executed: number }>;

test("H-7a: identity flip — marking row A NEVER touches row B (the old newest-wins race)", () => {
	const stamp = Date.now();
	const a = logAgentAction({
		action: "h7_race",
		limitCheck: "PASS",
		targetRef: `A-${stamp}`,
		executed: false,
		llmDecision: "t",
	});
	const b = logAgentAction({
		action: "h7_race",
		limitCheck: "PASS",
		targetRef: `B-${stamp}`,
		executed: false,
		llmDecision: "t",
	});
	assert.ok(a > 0 && b > 0 && a !== b, "logAgentAction returns distinct ids");
	markAgentActionExecutedById(a);
	const after = db()
		.prepare(
			"SELECT id, executed FROM agent_actions WHERE id IN (?, ?) ORDER BY id",
		)
		.all(a, b) as Array<{ id: number; executed: number }>;
	assert.equal(after.find((r) => r.id === a)?.executed, 1, "A flipped");
	assert.equal(
		after.find((r) => r.id === b)?.executed,
		0,
		"B untouched — the old race would have flipped the newest row",
	);
});

test("H-7b: recordExternalPayment logs EXACTLY ONE row for the attempt (was: policy + direct = duplicates)", async () => {
	const ref = `H7-REC-${Date.now()}`;
	const tools = {
		record_payment_for_invoice: {
			execute: async () => JSON.stringify({ payment_id: "EXT-H7" }),
		},
	} as unknown as ToolkitTools;
	await recordExternalPayment(tools, ref, "40.00", "USD", "h7");
	const rows = rowsFor("record_payment_for_invoice", ref);
	assert.equal(
		rows.length,
		1,
		`exactly one row per attempt, got ${rows.length}`,
	);
	assert.equal(rows[0]?.executed, 1, "and it is the executed one");
});

test("H-7c: createDraftInvoice logs EXACTLY ONE row (was: policy + own log = duplicates)", async () => {
	const ref = `H7-CREATE-${Date.now()}`;
	const tools = {
		create_invoice: {
			execute: async () =>
				JSON.stringify({
					href: "https://api-m.sandbox.paypal.com/invoice/INV2-H7-OK",
				}),
		},
		get_invoice: { execute: async () => JSON.stringify({ status: "DRAFT" }) },
	} as unknown as ToolkitTools;
	await createDraftInvoice(tools, {
		buyerEmail: "sb-h7@example.com",
		itemName: ref,
		amount: "40.00",
		currency: "USD",
	});
	const rows = rowsFor("create_invoice", ref);
	assert.equal(
		rows.length,
		1,
		`exactly one row per decision+attempt, got ${rows.length}`,
	);
	assert.equal(rows[0]?.executed, 1, "flipped by its own log id");
});
