/**
 * SQLite storage (stage 17 schema; wired at stage 44).
 * Uses Node's built-in node:sqlite — zero runtime dependencies.
 */

import { mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { logLine } from "./log.ts";

const DB_PATH = process.env.DB_PATH ?? "data/recon.db";

let db: DatabaseSync | undefined;

const INVOICE_STATUSES = new Set([
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
]);

/**
 * H-5: map a live PayPal invoice status into our CHECK vocabulary;
 * anything future/unknown becomes an explicit UNKNOWN instead of a thrown error.
 */
export function normalizeInvoiceStatus(status: string | undefined): string {
	if (typeof status === "string" && INVOICE_STATUSES.has(status)) return status;
	return "UNKNOWN";
}

/**
 * H-5 runtime migration: rebuild invoices in place when its CHECK predates the
 * full PayPal vocabulary (SQLite cannot ALTER a constraint). The child tables
 * (payments/reconciliation_records) reference `invoices` BY NAME and are never
 * touched; ids are preserved, so FK joins keep working; idempotent.
 */
export function migrateInvoiceStatusCheck(
	db: DatabaseSync,
): "rebuilt" | "already" {
	// Crash-safe state machine (an interrupted run must never wedge the boot):
	// 1) invoices gone + scratch present -> died between DROP and RENAME: FINISH it.
	// 2) invoices present + scratch present -> died before DROP: invoices is
	//    authoritative, the scratch copy is stale -> discard and start over.
	const names = new Set(
		(
			db
				.prepare(
					"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('invoices', 'invoices_mig')",
				)
				.all() as Array<{ name: string }>
		).map((r) => r.name),
	);
	if (!names.has("invoices") && names.has("invoices_mig")) {
		db.exec("ALTER TABLE invoices_mig RENAME TO invoices;");
		return "rebuilt";
	}
	if (names.has("invoices") && names.has("invoices_mig")) {
		db.exec("DROP TABLE invoices_mig;");
	}
	const info = db
		.prepare(
			"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'invoices'",
		)
		.get() as { sql?: string } | undefined;
	if (info?.sql?.includes("SCHEDULED") && info.sql.includes("UNKNOWN"))
		return "already";
	const cols = [
		"id",
		"paypal_invoice_id",
		"invoice_number",
		"buyer_email",
		"buyer_name",
		"currency",
		"subtotal_minor",
		"fee_minor",
		"total_minor",
		"status",
		"issued_at",
		"due_at",
		"paid_at",
		"memo",
		"source",
		"raw_json",
		"created_at",
		"updated_at",
	];
	const list = [...INVOICE_STATUSES].map((s) => `'${s}'`).join(", ");
	const statusExpr = `CASE WHEN status IN (${list}) THEN status ELSE 'UNKNOWN' END`;

	db.exec(
		`CREATE TABLE invoices_mig (
			id                  INTEGER PRIMARY KEY AUTOINCREMENT,
			paypal_invoice_id   TEXT NOT NULL UNIQUE,
			invoice_number      TEXT UNIQUE,
			buyer_email         TEXT,
			buyer_name          TEXT,
			currency            TEXT NOT NULL,
			subtotal_minor      INTEGER NOT NULL CHECK (subtotal_minor >= 0),
			fee_minor           INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
			total_minor         INTEGER NOT NULL CHECK (total_minor >= 0),
			status              TEXT NOT NULL
				CHECK (status IN ('DRAFT','SENT','SCHEDULED','UNPAID','PAYMENT_PENDING',
					'PAID','PARTIALLY_PAID','MARKED_AS_PAID','CANCELLED','REFUNDED',
					'PARTIALLY_REFUNDED','MARKED_AS_REFUNDED','UNKNOWN')),
			issued_at           TEXT,
			due_at              TEXT,
			paid_at             TEXT,
			memo                TEXT,
			source              TEXT NOT NULL DEFAULT 'agent',
			raw_json            TEXT NOT NULL,
			created_at          TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
		);`,
	);
	const selectList = cols
		.map((c) => (c === "status" ? statusExpr : c))
		.join(", ");
	db.prepare(
		`INSERT INTO invoices_mig (${cols.join(", ")}) SELECT ${selectList} FROM invoices`,
	).run();
	// Children reference `invoices` BY NAME — briefly drop FK enforcement so the
	// DROP+RENAME is legal when the connection runs with foreign_keys=ON
	// (the original pragma is restored in `finally`).
	const fk = db.prepare("PRAGMA foreign_keys").get() as {
		foreign_keys?: number;
	};
	const fkWasOn = fk?.foreign_keys === 1;
	try {
		if (fkWasOn) db.exec("PRAGMA foreign_keys = OFF;");
		db.exec("DROP TABLE invoices;");
		db.exec("ALTER TABLE invoices_mig RENAME TO invoices;");
	} finally {
		if (fkWasOn) db.exec("PRAGMA foreign_keys = ON;");
	}
	return "rebuilt";
}

export function getDb(): DatabaseSync {
	if (db) return db;
	mkdirSync("data", { recursive: true });
	db = new DatabaseSync(DB_PATH);
	db.exec("PRAGMA journal_mode = WAL;");
	const schema = readFileSync("schema.sql", "utf8");
	db.exec(schema);
	// H-5: widen an old invoices CHECK in place (idempotent); a rebuild drops the
	// invoices indexes, so re-apply the schema afterwards (IF NOT EXISTS recreates).
	const migrated = migrateInvoiceStatusCheck(db);
	if (migrated === "rebuilt") db.exec(schema);
	logLine(`[db] invoice status CHECK: ${migrated}`);
	return db;
}

export interface WebhookPayload {
	id?: string;
	event_type?: string;
	create_time?: string;
	resource?: Record<string, unknown>;
	[key: string]: unknown;
}

/** Append-only insert with dedupe on paypal_event_id. Returns 'inserted' | 'duplicate'. */
export function insertWebhookEvent(
	payload: WebhookPayload,
	rawLen: number,
): "inserted" | "duplicate" {
	const d = getDb();
	try {
		d.prepare(
			`INSERT INTO webhook_events (paypal_event_id, event_type, payload_json, received_at, process_status, processed_at)
       VALUES (?, ?, ?, datetime('now'), 'processed', datetime('now'))`,
		).run(
			payload.id ?? `NO-ID-${Date.now()}`,
			payload.event_type ?? "unknown",
			JSON.stringify({ ...payload, raw_len: rawLen }),
		);
		return "inserted";
	} catch (e) {
		if (String(e).includes("UNIQUE")) return "duplicate";
		throw e;
	}
}

function dollarsToMinor(value: string | undefined): number {
	if (!value) return 0;
	return Math.round(parseFloat(value) * 100);
}

/** Extract a payments row from INVOICING.INVOICE.PAID events (invoice payments). */
export function insertPaymentFromInvoiceEvent(
	payload: WebhookPayload,
): string | undefined {
	const inv = (payload.resource?.invoice ?? {}) as Record<string, unknown>;
	const detail = (inv.detail ?? {}) as Record<string, unknown>;
	const paymentsObj = (inv.payments ?? {}) as Record<string, unknown>;
	const paidAmount = (paymentsObj.paid_amount ?? {}) as {
		value?: string;
		currency_code?: string;
	};
	const txns = (paymentsObj.transactions ?? []) as Array<
		Record<string, unknown>
	>;
	const txn = txns[0] ?? {};
	const paymentId =
		typeof txn.payment_id === "string" ? txn.payment_id : undefined;
	if (!paymentId) return undefined;

	const d = getDb();
	d.prepare(
		`INSERT INTO payments (paypal_payment_id, currency, amount_minor, fee_minor, net_minor, status, source, received_at, raw_json)
     VALUES (?, ?, ?, 0, ?, 'COMPLETED', 'webhook', ?, ?)
     ON CONFLICT(paypal_payment_id) DO NOTHING`,
	).run(
		paymentId,
		paidAmount.currency_code ?? "USD",
		dollarsToMinor(paidAmount.value),
		dollarsToMinor(paidAmount.value),
		typeof txn.payment_date_time === "string"
			? txn.payment_date_time
			: new Date().toISOString(),
		JSON.stringify({
			event_id: payload.id,
			invoice_number: detail.invoice_number ?? null,
			invoice_id: inv.id ?? null,
			...payload,
		}),
	);
	return paymentId;
}

/** Extract a payments row from PAYMENT.* webhook resources (capture/sale shape). */
/**
 * H-2: the TRUE status of a payment capture event — `null` means "we do not know
 * this event well enough to store it" (fail-closed: no row, never a fake COMPLETED).
 * Only the COMPLETED status is a reconciliation candidate (src/reconcile.ts).
 */
const CAPTURE_STATUS: Record<string, string> = {
	"PAYMENT.CAPTURE.COMPLETED": "COMPLETED",
	"PAYMENT.CAPTURE.PENDING": "PENDING",
	// The schema vocabulary is ('PENDING','COMPLETED','FAILED','REFUNDED') — a
	// denied or reversed capture did not stick, so it is FAILED (never COMPLETED).
	"PAYMENT.CAPTURE.DENIED": "FAILED",
	"PAYMENT.CAPTURE.REVERSED": "FAILED",
	"PAYMENT.CAPTURE.REFUNDED": "REFUNDED",
};

export function paymentStatusFromEvent(
	eventType: string | undefined,
): string | null {
	if (!eventType) return null;
	return CAPTURE_STATUS[eventType] ?? null;
}

/** Money-lifecycle precedence for upserts: a later, more final state supersedes. */
const STATUS_RANK_SQL = (col: string) =>
	`CASE ${col} WHEN 'PENDING' THEN 0 WHEN 'FAILED' THEN 1 WHEN 'COMPLETED' THEN 2 WHEN 'REFUNDED' THEN 3 ELSE 0 END`;

export function insertPaymentFromEvent(
	payload: WebhookPayload,
): string | undefined {
	const res = (payload.resource ?? {}) as Record<string, unknown>;
	const amount = (res.amount ?? {}) as {
		value?: string;
		currency_code?: string;
	};
	const breakdown = (res.seller_receivable_breakdown ?? {}) as Record<
		string,
		unknown
	>;
	const fee = (breakdown.paypal_fee ?? {}) as { value?: string };
	const net = (breakdown.net_amount ?? {}) as { value?: string };
	const payer = (res.payer ?? {}) as { email_address?: string };
	const paymentId = typeof res.id === "string" ? res.id : undefined;
	if (!paymentId) return undefined;
	// H-2: store the event's TRUE status; unknown events store nothing at all.
	const status = paymentStatusFromEvent(payload.event_type);
	if (!status) return undefined;

	const d = getDb();
	d.prepare(
		`INSERT INTO payments (paypal_payment_id, currency, amount_minor, fee_minor, net_minor, status, source, received_at, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, 'webhook', ?, ?)
     ON CONFLICT(paypal_payment_id) DO UPDATE SET
       status = CASE WHEN ${STATUS_RANK_SQL("excluded.status")} > ${STATUS_RANK_SQL("status")}
                     THEN excluded.status ELSE status END`,
	).run(
		paymentId,
		amount.currency_code ?? "USD",
		dollarsToMinor(amount.value),
		dollarsToMinor(fee.value),
		dollarsToMinor(net.value ?? amount.value),
		status,
		payload.create_time ?? new Date().toISOString(),
		JSON.stringify({
			event_id: payload.id,
			payer_email: payer.email_address ?? null,
			...payload,
		}),
	);
	return paymentId;
}
