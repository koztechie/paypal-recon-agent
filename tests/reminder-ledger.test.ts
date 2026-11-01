// H-8: the reminder limit must be an ATOMIC reserve in the database, not a
// read-the-file -> call-PayPal -> writeFileSync sequence (TOCTOU: two parallel
// requests both passed the check and sent2 reminders/24h). The DB (with a
// UNIQUE(invoice_id, sent_date) backstop) is also the only store that survives
// deploys and works beyond one instance; logs/reminders.json stays as a legacy
// projection for the stage-64/50/52 QA scripts that read it.
//
// Reminder state lives in the dev book; test rows use unique ids (append-only,
// harmless — the same convention as the other audit-adjacent suites).

import assert from "node:assert/strict";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, test } from "node:test";
import { getDb } from "../src/db.ts";
import { sendInvoiceReminder } from "../src/invoicing.ts";
import type { ToolkitTools } from "../src/paypal.ts";
import {
	checkReminderAllowed,
	migrateReminderLedger,
	releaseReminderSlot,
	reserveReminderSlot,
	withReminderLedger,
} from "../src/reminder-ledger.ts";

const dir = mkdtempSync(join(tmpdir(), "h8-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const stamp = () => `H8-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function slowTool(opts: { fail?: boolean } = {}) {
	let calls = 0;
	const tools = {
		send_invoice_reminder: {
			execute: async () => {
				calls++;
				await new Promise((r) => setTimeout(r, 150));
				if (opts.fail) throw new Error("PayPal down");
				return JSON.stringify({ ok: true });
			},
		},
	} as unknown as ToolkitTools;
	return { tools: withReminderLedger(tools), callsOf: () => calls };
}

test("H-8a: TOCTOU — two CONCURRENT reminders -> PayPal called EXACTLY ONCE (was: twice)", async () => {
	const inv = stamp();
	const { tools, callsOf } = slowTool();
	const results = await Promise.allSettled([
		sendInvoiceReminder(tools, inv, "r1"),
		sendInvoiceReminder(tools, inv, "r2"),
	]);
	assert.equal(
		callsOf(),
		1,
		`atomic reserve allows only one send, got ${callsOf()}`,
	);
	assert.equal(
		results.filter((r) => r.status === "fulfilled").length,
		1,
		"exactly one caller wins",
	);
	const rejection = results.find(
		(r) => r.status === "rejected",
	) as PromiseRejectedResult;
	assert.match(
		String(rejection.reason),
		/BLOCKED: 24h limit reached/,
		"the loser gets the rate-limit reason",
	);
});

test("H-8b: same-day second send is denied with the EXACT legacy reason string", async () => {
	const inv = stamp();
	const { tools } = slowTool();
	await sendInvoiceReminder(tools, inv, "first");
	const gate = checkReminderAllowed(inv);
	assert.equal(gate.allowed, false);
	assert.equal(
		gate.reason,
		"BLOCKED: 24h limit reached (1/day)",
		"stage-64-era wording preserved",
	);
});

test("H-8c: lifetime cap after three DIFFERENT-day stamps -> exact 'lifetime limit reached (3)'", () => {
	const inv = stamp();
	const db = getDb();
	const ins = db.prepare(
		"INSERT INTO reminder_ledger (invoice_id, sent_at, sent_date) VALUES (?, ?, ?)",
	);
	ins.run(inv, "2026-10-29T10:00:00.000Z", "2026-10-29");
	ins.run(inv, "2026-10-30T10:00:00.000Z", "2026-10-30");
	ins.run(inv, "2026-10-31T10:00:00.000Z", "2026-10-31");
	const gate = checkReminderAllowed(inv);
	assert.equal(gate.allowed, false);
	assert.equal(gate.reason, "BLOCKED: lifetime limit reached (3)");
});

test("H-8d: a FAILED PayPal attempt releases its slot (does not burn the day)", async () => {
	const inv = stamp();
	const { tools } = slowTool({ fail: true });
	await assert.rejects(
		() => sendInvoiceReminder(tools, inv, "boom"),
		/PayPal down/,
	);
	assert.equal(
		checkReminderAllowed(inv).allowed,
		true,
		"failed attempt must not consume the24h slot",
	);
});

test("H-8e: sync double-reserve denied; release frees the exact row", () => {
	const inv = stamp();
	const first = reserveReminderSlot(inv);
	assert.equal(first.allowed, true);
	assert.ok(first.id);
	const second = reserveReminderSlot(inv); // same tick: no await in between
	assert.equal(
		second.allowed,
		false,
		"atomic critical section denies the twin",
	);
	assert.ok(first.id);
	releaseReminderSlot(first.id);
	assert.equal(
		checkReminderAllowed(inv).allowed,
		true,
		"released -> slot free again",
	);
});

test("H-8f: migrate imports existing JSON stamps once (idempotent)", () => {
	const jsonPath = join(dir, "reminders.json");
	writeFileSync(
		jsonPath,
		JSON.stringify({
			"INV2-LEGACY-1": ["2026-10-28T07:05:41.821Z", "2026-10-27T09:55:00.000Z"],
		}),
	);
	const db = new DatabaseSync(join(dir, "reminders.db"));
	db.exec(readFileSync("schema.sql", "utf8"));
	assert.equal(migrateReminderLedger(db, jsonPath), "imported:2");
	assert.equal(migrateReminderLedger(db, jsonPath), "already", "idempotent");
	const n = (
		db
			.prepare(
				"SELECT count(*) c FROM reminder_ledger WHERE invoice_id = 'INV2-LEGACY-1'",
			)
			.get() as { c: number }
	).c;
	assert.equal(n, 2, "both legacy stamps live in the DB");
});
