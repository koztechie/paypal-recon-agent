/**
 * Book snapshot & self-healing restore — finding H-4 (2026-11-01).
 *
 * Render free's disk is ephemeral: `data/recon.db` dies on every deploy/restart.
 * The demo book must survive that WITHOUT a manual re-seed:
 *   - exportBook():    sanitized snapshot of the five book tables (emails masked
 *                      via maskEmails — the same minimization the public API uses),
 *                      committed under `seed/` (data/ is gitignored).
 *   - restoreBookIfEmpty(): at boot, ONLY on an empty book, INSERT OR IGNORE with
 *                      the ORIGINAL ids so FKs (reconciliation_records → payments)
 *                      stay intact; idempotent, never clobbers live data.
 * A paid persistent disk remains the true-persistence upgrade path (documented in
 * render.yaml / ADR-020); this makes the demo loss self-healing either way.
 */
import type { DatabaseSync } from "node:sqlite";
import { maskEmails } from "./public-rows.ts";

type Row = Record<string, unknown>;

export interface BookSnapshot {
	version: 1;
	exportedAt: string;
	counts: Record<string, number>;
	rows: Record<string, Row[]>;
}

const COLUMNS: Record<string, string[]> = {
	invoices: [
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
	],
	payments: [
		"id",
		"paypal_payment_id",
		"invoice_id",
		"payer_email",
		"currency",
		"amount_minor",
		"fee_minor",
		"net_minor",
		"status",
		"source",
		"received_at",
		"stored_at",
		"raw_json",
	],
	reconciliation_records: [
		"id",
		"payment_id",
		"invoice_id",
		"status",
		"match_method",
		"variance_minor",
		"currency",
		"reason",
		"ai_explanation",
		"decided_by",
		"resolution",
		"detected_at",
		"resolved_at",
	],
	webhook_events: [
		"id",
		"paypal_event_id",
		"event_type",
		"payload_json",
		"received_at",
		"process_status",
		"processed_at",
		"error",
	],
	agent_actions: [
		"id",
		"action",
		"llm_decision",
		"limit_check",
		"target_ref",
		"executed",
		"executed_at",
		"created_at",
	],
};

/** FK-safe insert order: parents before children. */
const RESTORE_ORDER = [
	"invoices",
	"payments",
	"reconciliation_records",
	"webhook_events",
	"agent_actions",
] as const;

/** Columns that can carry an email address -> masked on export. */
const MASK: Record<string, string[]> = {
	invoices: ["buyer_email", "buyer_name", "raw_json"],
	payments: ["payer_email", "raw_json"],
	webhook_events: ["payload_json"],
	reconciliation_records: ["reason", "ai_explanation"],
	agent_actions: ["llm_decision"],
};

export function exportBook(db: DatabaseSync): BookSnapshot {
	const rows: Record<string, Row[]> = {};
	const counts: Record<string, number> = {};
	for (const table of Object.keys(COLUMNS)) {
		const cols = COLUMNS[table] ?? [];
		const maskCols = new Set(MASK[table] ?? []);
		const raw = db
			.prepare(`SELECT ${cols.join(", ")} FROM ${table} ORDER BY id`)
			.all() as Row[];
		rows[table] = raw.map((r) => {
			const out: Row = { ...r };
			for (const c of maskCols) {
				if (typeof out[c] === "string") out[c] = maskEmails(out[c] as string);
			}
			return out;
		});
		counts[table] = rows[table].length;
	}
	return { version: 1, exportedAt: new Date().toISOString(), counts, rows };
}

export type RestoreOutcome = "restored" | "skipped" | "skipped-empty-snapshot";

export function restoreBookIfEmpty(
	db: DatabaseSync,
	snap: BookSnapshot,
): RestoreOutcome {
	const existing =
		((db.prepare("SELECT count(*) c FROM payments").get() as { c: number }).c ??
			0) +
		((db.prepare("SELECT count(*) c FROM invoices").get() as { c: number }).c ??
			0);
	if (existing > 0) return "skipped"; // live book — never clobber
	if ((snap.counts?.payments ?? 0) + (snap.counts?.invoices ?? 0) === 0) {
		return "skipped-empty-snapshot";
	}
	for (const table of RESTORE_ORDER) {
		const cols = COLUMNS[table] ?? [];
		const rows = snap.rows?.[table] ?? [];
		if (rows.length === 0) continue;
		const stmt = db.prepare(
			`INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
		);
		for (const row of rows) {
			stmt.run(...cols.map((c) => (row[c] ?? null) as never));
		}
	}
	return "restored";
}
