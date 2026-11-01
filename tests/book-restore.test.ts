// H-4: the demo book must survive ephemeral disks — exportBook() produces a
// sanitized (emails masked) snapshot committed to the repo, and restoreBookIfEmpty()
// brings the book back on an EMPTY database only (never clobbers live data,
// idempotent by INSERT OR IGNORE with original ids so FKs stay intact).

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, test } from "node:test";
import { exportBook, restoreBookIfEmpty } from "../src/book.ts";

const dir = mkdtempSync(join(tmpdir(), "h4-"));
after(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
function makeDb(): DatabaseSync {
	const db = new DatabaseSync(join(dir, `db${n++}.db`));
	db.exec(readFileSync("schema.sql", "utf8"));
	return db;
}

function seedFixture(db: DatabaseSync) {
	db.prepare(
		`INSERT INTO invoices (id, paypal_invoice_id, invoice_number, buyer_email, currency, subtotal_minor, fee_minor, total_minor, status, source, raw_json, created_at)
     VALUES (10, 'INV2-FIXTURE', 'FIX-1', 'sb-test-12345@personal.example.com', 'USD', 4500, 0, 4500, 'SENT', 'agent', '{"buyer":"sb-test-12345@personal.example.com"}', '2026-11-01 10:00:00')`,
	).run();
	db.prepare(
		`INSERT INTO payments (id, paypal_payment_id, invoice_id, payer_email, currency, amount_minor, fee_minor, net_minor, status, source, received_at, raw_json)
     VALUES (20, 'PAY-FIXTURE', 10, 'sb-test-12345@personal.example.com', 'USD', 4500, 0, 4500, 'COMPLETED', 'webhook', '2026-11-01T10:05:00Z', '{"payer":{"email_address":"sb-test-12345@personal.example.com"}}')`,
	).run();
	db.prepare(
		`INSERT INTO reconciliation_records (id, payment_id, invoice_id, status, match_method, variance_minor, currency, ai_explanation)
     VALUES (30, 20, 10, 'MATCHED', 'number_amount', 0, 'USD', 'Paid by sb-test-12345@personal.example.com exactly')`,
	).run();
	db.prepare(
		`INSERT INTO webhook_events (id, paypal_event_id, event_type, payload_json, received_at, process_status)
     VALUES (40, 'WH-FIXTURE', 'INVOICING.INVOICE.PAID', '{"payer":{"email_address":"sb-test-12345@personal.example.com"}}', '2026-11-01 10:05:01', 'processed')`,
	).run();
	db.prepare(
		`INSERT INTO agent_actions (id, action, llm_decision, limit_check, executed)
     VALUES (50, 'send_invoice', 'system-policy -> PASS', 'PASS', 1)`,
	).run();
}

test("H-4a: exportBook counts every table and MASKS every email (raw part never leaks)", () => {
	const db = makeDb();
	seedFixture(db);
	const snap = exportBook(db);
	assert.equal(snap.version, 1);
	assert.deepEqual(snap.counts, {
		invoices: 1,
		payments: 1,
		webhook_events: 1,
		reconciliation_records: 1,
		agent_actions: 1,
	});
	const blob = JSON.stringify(snap);
	assert.ok(
		!blob.includes("sb-test-12345"),
		"raw mailbox local part must NOT be in the snapshot",
	);
	assert.ok(blob.includes("…@personal.example.com"), "masked form present");
	assert.equal(
		(snap.rows.payments?.[0] as Record<string, unknown> | undefined)?.id,
		20,
		"ids preserved for FK restore",
	);
});

test("H-4b: restore into an EMPTY db — counts match and the FK join works", () => {
	const src = makeDb();
	seedFixture(src);
	const snap = exportBook(src);
	const dst = makeDb();
	assert.equal(restoreBookIfEmpty(dst, snap), "restored");
	const joined = dst
		.prepare(
			`SELECT p.paypal_payment_id, r.status FROM reconciliation_records r JOIN payments p ON p.id = r.payment_id`,
		)
		.all() as Array<{ paypal_payment_id: string; status: string }>;
	// value comparison: node:sqlite rows carry a null prototype
	assert.equal(joined.length, 1, "FK by original ids restores the link");
	const row = joined[0];
	assert.ok(row, "row present");
	assert.equal(row.paypal_payment_id, "PAY-FIXTURE");
	assert.equal(row.status, "MATCHED");
	const pay = dst
		.prepare("SELECT payer_email FROM payments WHERE id = 20")
		.get() as { payer_email: string };
	assert.ok(pay.payer_email.includes("…@"), "restored data stays masked");
});

test("H-4c: restoring twice is idempotent (no duplicates)", () => {
	const src = makeDb();
	seedFixture(src);
	const snap = exportBook(src);
	const dst = makeDb();
	assert.equal(restoreBookIfEmpty(dst, snap), "restored");
	assert.equal(restoreBookIfEmpty(dst, snap), "skipped");
	assert.equal(
		(dst.prepare("SELECT count(*) c FROM payments").get() as { c: number }).c,
		1,
	);
});

test("H-4d: a NON-EMPTY db is never clobbered", () => {
	const src = makeDb();
	seedFixture(src);
	const snap = exportBook(src);
	const dst = makeDb();
	dst
		.prepare(
			`INSERT INTO payments (paypal_payment_id, currency, amount_minor, net_minor, status, received_at, raw_json)
     VALUES ('LIVE-ROW', 'USD', 1, 1, 'COMPLETED', '2026-11-01T11:00:00Z', '{}')`,
		)
		.run();
	assert.equal(restoreBookIfEmpty(dst, snap), "skipped");
	assert.equal(
		(dst.prepare("SELECT count(*) c FROM invoices").get() as { c: number }).c,
		0,
		"nothing imported",
	);
});

test("H-4e: an empty snapshot is refused", () => {
	const dst = makeDb();
	const empty = exportBook(makeDb());
	assert.equal(restoreBookIfEmpty(dst, empty), "skipped-empty-snapshot");
});
