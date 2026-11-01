// H-5: the invoices.status CHECK must cover PayPal's full status vocabulary —
// upsertLocalInvoice feeds LIVE PayPal statuses into reconcile, and an out-of-set
// status (SCHEDULED/UNPAID/PAYMENT_PENDING/PARTIALLY_REFUNDED/MARKED_AS_REFUNDED)
// threw a CHECK constraint error that killed the reconciliation-record write.
// Covers: fresh schema accepts all statuses, the RUNTIME MIGRATION rebuilds an
// old-schema table in place (ids + child FKs intact, idempotent), and the boundary
// normalizer maps future surprises to an explicit UNKNOWN bucket.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, test } from "node:test";
import {
	migrateInvoiceStatusCheck,
	normalizeInvoiceStatus,
} from "../src/db.ts";

const dir = mkdtempSync(join(tmpdir(), "h5-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const PAYPAL_STATUSES = [
	"DRAFT",
	"SENT",
	"SCHEDULED",
	"UNPAID",
	"PAYMENT_PENDING",
	"PAID",
	"PARTIALLY_PAID",
	"MARKED_AS_PAID",
	"CANCELLED",
	"REFUNDED",
	"PARTIALLY_REFUNDED",
	"MARKED_AS_REFUNDED",
];

const OLD_SCHEMA = `
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paypal_invoice_id TEXT NOT NULL UNIQUE,
  invoice_number TEXT UNIQUE,
  buyer_email TEXT,
  buyer_name TEXT,
  currency TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL,
  fee_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('DRAFT','SENT','PARTIALLY_PAID','PAID','CANCELLED','REFUNDED','MARKED_AS_PAID')),
  issued_at TEXT, due_at TEXT, paid_at TEXT, memo TEXT,
  source TEXT NOT NULL DEFAULT 'agent',
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paypal_payment_id TEXT UNIQUE,
  invoice_id INTEGER REFERENCES invoices(id),
  currency TEXT NOT NULL, amount_minor INTEGER NOT NULL, net_minor INTEGER NOT NULL,
  status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'webhook',
  received_at TEXT NOT NULL, stored_at TEXT NOT NULL DEFAULT (datetime('now')),
  raw_json TEXT NOT NULL
);`;

let n = 0;
function freshDb(): DatabaseSync {
	const db = new DatabaseSync(join(dir, `fresh${n++}.db`));
	db.exec(readFileSync("schema.sql", "utf8"));
	return db;
}
function oldDb(): DatabaseSync {
	const db = new DatabaseSync(join(dir, `old${n++}.db`));
	db.exec(OLD_SCHEMA);
	return db;
}

test("H-5a: normalize — all12 PayPal statuses pass through, surprises become UNKNOWN", () => {
	for (const s of PAYPAL_STATUSES) assert.equal(normalizeInvoiceStatus(s), s);
	assert.equal(normalizeInvoiceStatus("FUTURE_PAYPAL_STATUS"), "UNKNOWN");
	assert.equal(normalizeInvoiceStatus(""), "UNKNOWN");
	assert.equal(normalizeInvoiceStatus(undefined), "UNKNOWN");
});

test("H-5b: fresh schema accepts every real status (incl. the five the finding named)", () => {
	const db = freshDb();
	const ins = db.prepare(
		"INSERT INTO invoices (paypal_invoice_id, currency, subtotal_minor, total_minor, status, raw_json) VALUES (?, 'USD', 0, 0, ?, '{}')",
	);
	for (const s of PAYPAL_STATUSES) ins.run(`INV-${s}`, s);
	ins.run("INV-UNKNOWN", normalizeInvoiceStatus("WHATEVER_NEX"));
	assert.equal(
		(db.prepare("SELECT count(*) c FROM invoices").get() as { c: number }).c,
		13,
	);
});

test("H-5c: migration rebuilds an OLD-schema table in place: new statuses work, ids + child FKs survive, idempotent", () => {
	const db = oldDb();
	// legacy data + a child row that must keep resolving after the rebuild
	db.prepare(
		"INSERT INTO invoices (id, paypal_invoice_id, invoice_number, currency, subtotal_minor, total_minor, status, raw_json) VALUES (7, 'INV2-OLD', 'MERCH-777', 'USD', 4500, 4500, 'SENT', '{}')",
	).run();
	db.prepare(
		"INSERT INTO payments (id, paypal_payment_id, invoice_id, currency, amount_minor, net_minor, status, received_at, raw_json) VALUES (9, 'PAY-OLD', 7, 'USD', 4500, 4500, 'COMPLETED', '2026-11-01T12:00:00Z', '{}')",
	).run();

	assert.equal(migrateInvoiceStatusCheck(db), "rebuilt");

	// the five formerly-fatal statuses now insert
	for (const s of [
		"SCHEDULED",
		"UNPAID",
		"PAYMENT_PENDING",
		"PARTIALLY_REFUNDED",
		"MARKED_AS_REFUNDED",
	]) {
		db.prepare(
			"INSERT INTO invoices (paypal_invoice_id, currency, subtotal_minor, total_minor, status, raw_json) VALUES (?, 'USD', 0, 0, ?, '{}')",
		).run(`INV-${s}`, s);
	}
	// legacy row intact (same id) and the child join still resolves
	const legacy = db
		.prepare(
			"SELECT id, status FROM invoices WHERE paypal_invoice_id = 'INV2-OLD'",
		)
		.get() as { id: number; status: string };
	assert.deepEqual({ ...legacy }, { id: 7, status: "SENT" });
	const joined = db
		.prepare(
			"SELECT i.invoice_number FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.id = 9",
		)
		.get() as { invoice_number: string } | undefined;
	assert.equal(
		joined?.invoice_number,
		"MERCH-777",
		"FK by id survives the rebuild",
	);

	// idempotent: second run is a no-op and does not duplicate anything
	assert.equal(migrateInvoiceStatusCheck(db), "already");
	const c = (
		db.prepare("SELECT count(*) c FROM invoices").get() as { c: number }
	).c;
	assert.equal(c, 6, "5 new +1 legacy, no duplicates after re-run");
});

test("H-5d: interrupted BEFORE the DROP (stale scratch) -> scratch discarded, rebuild proceeds", () => {
	const db = oldDb();
	db.exec(
		"CREATE TABLE invoices_mig (id INTEGER PRIMARY KEY, note TEXT); INSERT INTO invoices_mig (note) VALUES ('stale');",
	);
	assert.equal(migrateInvoiceStatusCheck(db), "rebuilt");
	assert.equal(
		(
			db
				.prepare(
					"SELECT count(*) c FROM sqlite_master WHERE name = 'invoices_mig'",
				)
				.get() as { c: number }
		).c,
		0,
		"scratch is gone",
	);
	db.prepare(
		"INSERT INTO invoices (paypal_invoice_id, currency, subtotal_minor, total_minor, status, raw_json) VALUES (?, 'USD', 0, 0, 'UNPAID', '{}')",
	).run("INV-S2");
});

test("H-5e: interrupted BETWEEN drop and rename (invoices missing) -> rename finishes the job", () => {
	const db = new DatabaseSync(join(dir, `mid${n++}.db`));
	db.exec(`
		CREATE TABLE invoices_mig (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			paypal_invoice_id TEXT NOT NULL UNIQUE,
			invoice_number TEXT UNIQUE,
			buyer_email TEXT, buyer_name TEXT,
			currency TEXT NOT NULL,
			subtotal_minor INTEGER NOT NULL,
			fee_minor INTEGER NOT NULL DEFAULT 0,
			total_minor INTEGER NOT NULL,
			status TEXT NOT NULL CHECK (status IN ('SCHEDULED','UNKNOWN')),
			issued_at TEXT, due_at TEXT, paid_at TEXT, memo TEXT,
			source TEXT NOT NULL DEFAULT 'agent',
			raw_json TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		INSERT INTO invoices_mig (id, paypal_invoice_id, currency, subtotal_minor, total_minor, status, raw_json)
		VALUES (3, 'INV2-MID', 'USD', 100, 100, 'SCHEDULED', '{}');
	`);
	// invoices table is ABSENT here (the crash window): the machine must finish with RENAME
	assert.equal(migrateInvoiceStatusCheck(db), "rebuilt");
	const row = db
		.prepare("SELECT id, status FROM invoices WHERE id = 3")
		.get() as { id: number; status: string };
	assert.deepEqual(
		{ ...row },
		{ id: 3, status: "SCHEDULED" },
		"the in-flight copy became the real table",
	);
});
