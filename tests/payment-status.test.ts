// H-2: a capture event must land with its TRUE status — only a real
// PAYMENT.CAPTURE.COMPLETED may be COMPLETED (the only status reconcile accepts,
// src/reconcile.ts `p.status = 'COMPLETED'`). PENDING/DENIED/REFUNDED/REVERSED
// used to be stored as COMPLETED -> false MATCHED rows -> false tax-report matches.
// Also: later events for the same capture must upgrade the row (the old
// ON CONFLICT DO NOTHING left stale statuses forever).
//
// DB_PATH is read at module load, so the temp path is set BEFORE the import;
// each test file runs in its own process, so this cannot leak into other tests.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "h2-"));
process.env.DB_PATH = join(dir, "test.db");

const { paymentStatusFromEvent, insertPaymentFromEvent, getDb } = await import(
	"../src/db.ts"
);

after(() => rmSync(dir, { recursive: true, force: true }));

// ---------- pure mapper ----------
test("H-2a: the five observed capture events map to their true statuses", () => {
	assert.equal(
		paymentStatusFromEvent("PAYMENT.CAPTURE.COMPLETED"),
		"COMPLETED",
	);
	assert.equal(paymentStatusFromEvent("PAYMENT.CAPTURE.PENDING"), "PENDING");
	// schema vocabulary: denied/reversed = FAILED (the table CHECK allows only
	// PENDING/COMPLETED/FAILED/REFUNDED — the DB itself rejected invented values)
	assert.equal(paymentStatusFromEvent("PAYMENT.CAPTURE.DENIED"), "FAILED");
	assert.equal(paymentStatusFromEvent("PAYMENT.CAPTURE.REVERSED"), "FAILED");
	assert.equal(paymentStatusFromEvent("PAYMENT.CAPTURE.REFUNDED"), "REFUNDED");
});

test("H-2b: unknown or non-payment events map to null (never COMPLETED by default)", () => {
	assert.equal(paymentStatusFromEvent("PAYMENT.CAPTURE.NONSENSE"), null);
	assert.equal(paymentStatusFromEvent("PAYMENT.SOMETHING.ELSE"), null);
	assert.equal(paymentStatusFromEvent("INVOICING.INVOICE.PAID"), null);
	assert.equal(paymentStatusFromEvent(undefined), null);
	assert.equal(paymentStatusFromEvent(""), null);
});

// ---------- wiring on the temporary database ----------
const payload = (eventType: string, id: string) => ({
	id: "WH-H2",
	event_type: eventType,
	create_time: "2026-11-01T12:00:00Z",
	resource: {
		id,
		amount: { currency_code: "USD", value: "10.00" },
		seller_receivable_breakdown: {
			paypal_fee: { value: "0.60" },
			net_amount: { value: "9.40" },
		},
	},
});

test("H-2c: PENDING capture lands as PENDING (reconcile must never see it)", () => {
	const id = insertPaymentFromEvent(
		payload("PAYMENT.CAPTURE.PENDING", "CAP-H2-P"),
	);
	const row = getDb()
		.prepare("SELECT status FROM payments WHERE paypal_payment_id = ?")
		.get("CAP-H2-P") as { status: string } | undefined;
	assert.ok(id, "row is stored");
	assert.equal(row?.status, "PENDING", "MUST NOT be COMPLETED");
});

test("H-2d: DENIED capture lands as FAILED (schema vocabulary); REFUNDED as REFUNDED", () => {
	insertPaymentFromEvent(payload("PAYMENT.CAPTURE.DENIED", "CAP-H2-D"));
	insertPaymentFromEvent(payload("PAYMENT.CAPTURE.REFUNDED", "CAP-H2-R"));
	const rows = getDb()
		.prepare(
			"SELECT paypal_payment_id, status FROM payments WHERE paypal_payment_id IN ('CAP-H2-D','CAP-H2-R')",
		)
		.all() as Array<{ paypal_payment_id: string; status: string }>;
	assert.deepEqual(rows.map((r) => [r.paypal_payment_id, r.status]).sort(), [
		["CAP-H2-D", "FAILED"],
		["CAP-H2-R", "REFUNDED"],
	]);
});

test("H-2e: lifecycle upgrade — PENDING then COMPLETED -> COMPLETED; later REFUNDED supersedes", () => {
	insertPaymentFromEvent(payload("PAYMENT.CAPTURE.PENDING", "CAP-H2-U"));
	insertPaymentFromEvent(payload("PAYMENT.CAPTURE.COMPLETED", "CAP-H2-U"));
	const mid = getDb()
		.prepare("SELECT status FROM payments WHERE paypal_payment_id = ?")
		.get("CAP-H2-U") as { status: string } | undefined;
	assert.equal(
		mid?.status,
		"COMPLETED",
		"later COMPLETED must upgrade the row",
	);
	insertPaymentFromEvent(payload("PAYMENT.CAPTURE.REFUNDED", "CAP-H2-U"));
	const after = getDb()
		.prepare("SELECT status FROM payments WHERE paypal_payment_id = ?")
		.get("CAP-H2-U") as { status: string } | undefined;
	assert.equal(after?.status, "REFUNDED");
});

test("H-2f: unknown PAYMENT.* event stores NOTHING (fail-closed, not COMPLETED)", () => {
	const out = insertPaymentFromEvent(
		payload("PAYMENT.CAPTURE.NONSENSE", "CAP-H2-X"),
	);
	assert.equal(out, undefined);
	const row = getDb()
		.prepare("SELECT status FROM payments WHERE paypal_payment_id = ?")
		.get("CAP-H2-X") as { status: string } | undefined;
	assert.equal(row, undefined, "no row for an unhandled event");
});
