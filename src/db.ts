/**
 * SQLite storage (stage 17 schema; wired at stage 44).
 * Uses Node's built-in node:sqlite — zero runtime dependencies.
 */

import { mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.DB_PATH ?? "data/recon.db";

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
	if (db) return db;
	mkdirSync("data", { recursive: true });
	db = new DatabaseSync(DB_PATH);
	db.exec("PRAGMA journal_mode = WAL;");
	db.exec(readFileSync("schema.sql", "utf8"));
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

	const d = getDb();
	d.prepare(
		`INSERT INTO payments (paypal_payment_id, currency, amount_minor, fee_minor, net_minor, status, source, received_at, raw_json)
     VALUES (?, ?, ?, ?, ?, 'COMPLETED', 'webhook', ?, ?)
     ON CONFLICT(paypal_payment_id) DO NOTHING`,
	).run(
		paymentId,
		amount.currency_code ?? "USD",
		dollarsToMinor(amount.value),
		dollarsToMinor(fee.value),
		dollarsToMinor(net.value ?? amount.value),
		payload.create_time ?? new Date().toISOString(),
		JSON.stringify({
			event_id: payload.id,
			payer_email: payer.email_address ?? null,
			...payload,
		}),
	);
	return paymentId;
}
