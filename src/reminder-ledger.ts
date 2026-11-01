/**
 * Reminder rate-limit ledger (H-8,2026-11-01): ATOMIC reserve-first limiting in
 * SQLite instead of check-file -> call-PayPal -> writeFileSync (a TOCTOU race let
 * two parallel requests send2 reminders/24h; the file had no transactions and
 * died with the ephemeral disk / could not work beyond one instance).
 *
 * - `reserveReminderSlot()` is a SYNCHRONOUS critical section (no await inside, so
 *   the single-threaded event loop serializes it) PLUS a `UNIQUE(invoice_id,
 *   sent_date)` backstop in the database for any future multi-instance setup.
 * - The reservation happens BEFORE the PayPal call and is RELEASED when the call
 *   fails (a failed attempt never burns the24h slot — the old post-success write
 *   semantics preserved).
 * - `checkReminderAllowed()` stays a read-only pre-check for friendly messages;
 *   its reason strings are byte-identical to the stage-64-era contract.
 * - `logs/reminders.json` is kept as a LEGACY PROJECTION (regenerated from the DB)
 *   because QA scripts stage-64/50/52 read that file directly.
 * - `withReminderLedger()` wraps the toolkit's `send_invoice_reminder` so the ONE
 *   choke point covers every caller: the invoicing wrapper, raw script calls
 *   (stage52), the row-action UI, the reminder agent and the agent loop.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { logAgentAction } from "./auditlog.ts";
import { getDb } from "./db.ts";
import type { ToolkitTools } from "./paypal.ts";

export const REMINDER_MAX_PER_DAY = 1;
export const REMINDER_MAX_LIFETIME = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_LEDGER = "logs/reminders.json"; // legacy projection (stage-64/50/52)

export interface ReminderGate {
	allowed: boolean;
	reason: string;
}
export interface Reservation extends ReminderGate {
	id?: number;
}

function stampCount(inv: string, sinceIso?: string): number {
	const db = getDb();
	const row = (
		sinceIso
			? db
					.prepare(
						"SELECT count(*) c FROM reminder_ledger WHERE invoice_id = ? AND sent_at >= ?",
					)
					.get(inv, sinceIso)
			: db
					.prepare(
						"SELECT count(*) c FROM reminder_ledger WHERE invoice_id = ?",
					)
					.get(inv)
	) as { c: number };
	return row.c;
}

/** Regenerate the legacy JSON projection from the DB (single source of truth). */
function writeMirror(): void {
	try {
		const rows = getDb()
			.prepare(
				"SELECT invoice_id, sent_at FROM reminder_ledger ORDER BY sent_at",
			)
			.all() as Array<{ invoice_id: string; sent_at: string }>;
		const ledger: Record<string, string[]> = {};
		for (const r of rows) {
			const list = ledger[r.invoice_id];
			if (list) list.push(r.sent_at);
			else ledger[r.invoice_id] = [r.sent_at];
		}
		// Destructive-path guard: an EMPTY table must never overwrite a populated
		// legacy file (that is how pre-fix entries could be lost if a first import
		// failed silently).
		if (rows.length === 0 && existsSync(REMINDER_LEDGER)) {
			try {
				const legacy = JSON.parse(
					readFileSync(REMINDER_LEDGER, "utf8"),
				) as Record<string, unknown>;
				if (Object.keys(legacy).length > 0) return; // keep the legacy file as-is
			} catch {
				/* unreadable legacy file -> nothing to protect */
			}
		}
		mkdirSync("logs", { recursive: true });
		writeFileSync(REMINDER_LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
	} catch {
		/* mirror is best-effort; the DB is the authority */
	}
}

/** Read-only pre-check (guards/UI messages). Reasons keep the legacy wording. */
export function checkReminderAllowed(invoiceId: string): ReminderGate {
	ensureMigrated();
	if (stampCount(invoiceId) >= REMINDER_MAX_LIFETIME) {
		return {
			allowed: false,
			reason: `BLOCKED: lifetime limit reached (${REMINDER_MAX_LIFETIME})`,
		};
	}
	if (
		stampCount(invoiceId, new Date(Date.now() - DAY_MS).toISOString()) >=
		REMINDER_MAX_PER_DAY
	) {
		return {
			allowed: false,
			reason: `BLOCKED: 24h limit reached (${REMINDER_MAX_PER_DAY}/day)`,
		};
	}
	return { allowed: true, reason: "PASS" };
}

/**
 * ATOMIC check-and-reserve (the H-8 fix): lifetime + daily checks and the INSERT
 * run in ONE synchronous block — nothing can interleave on the event loop, and
 * UNIQUE(invoice_id, sent_date) rejects a cross-process twin. Caller RELEASES the
 * reservation when the external call fails.
 */
export function reserveReminderSlot(invoiceId: string): Reservation {
	ensureMigrated();
	const gate = checkReminderAllowed(invoiceId);
	if (!gate.allowed) return { allowed: false, reason: gate.reason };
	try {
		const nowIso = new Date().toISOString();
		const res = getDb()
			.prepare(
				"INSERT INTO reminder_ledger (invoice_id, sent_at, sent_date) VALUES (?, ?, date('now'))",
			)
			.run(invoiceId, nowIso);
		writeMirror();
		return { allowed: true, reason: "PASS", id: Number(res.lastInsertRowid) };
	} catch {
		// UNIQUE(invoice_id, sent_date) backstop: a concurrent reserve won the slot.
		return {
			allowed: false,
			reason: `BLOCKED: 24h limit reached (${REMINDER_MAX_PER_DAY}/day)`,
		};
	}
}

export function releaseReminderSlot(id: number | undefined): void {
	if (!id) return;
	try {
		getDb().prepare("DELETE FROM reminder_ledger WHERE id = ?").run(id);
		writeMirror();
	} catch {
		/* best-effort compensation */
	}
}

/**
 * One-time import of the legacy logs/reminders.json into an empty table
 * (idempotent: a non-empty table is never re-imported).
 */
export function migrateReminderLedger(
	db: import("node:sqlite").DatabaseSync,
	jsonPath = REMINDER_LEDGER,
): "already" | "fresh" | `imported:${number}` {
	const existing = (
		db.prepare("SELECT count(*) c FROM reminder_ledger").get() as { c: number }
	).c;
	if (existing > 0) return "already";
	if (!existsSync(jsonPath)) return "fresh";
	let parsed: Record<string, string[]> = {};
	try {
		parsed = JSON.parse(readFileSync(jsonPath, "utf8")) as Record<
			string,
			string[]
		>;
	} catch {
		return "fresh";
	}
	const ins = db.prepare(
		"INSERT INTO reminder_ledger (invoice_id, sent_at, sent_date) VALUES (?, ?, ?)",
	);
	let n = 0;
	for (const [inv, stamps] of Object.entries(parsed)) {
		for (const s of stamps) {
			try {
				ins.run(inv, s, s.slice(0, 10)); // UNIQUE backstop: a concurrent
				n++; // migrator's row is skipped, never aborting the import
			} catch {
				/* already imported by a twin process */
			}
		}
	}
	return `imported:${n}`;
}

let migratedOnce = false;
function ensureMigrated(): void {
	if (migratedOnce) return;
	try {
		const outcome = migrateReminderLedger(getDb());
		if (outcome !== "fresh") writeMirror(); // keep the legacy projection in sync
		migratedOnce = true; // only after a COMPLETE attempt — a failure retries
	} catch {
		/* transient (e.g. schema not yet applied) — retried on the next call */
	}
}

/**
 * The choke point: wrap the toolkit's send_invoice_reminder so EVERY caller
 * (wrapper, raw scripts, UI, agents) reserves a slot atomically BEFORE the
 * external call and releases it when the call fails.
 */
export function withReminderLedger(tools: ToolkitTools): ToolkitTools {
	const bag = tools as unknown as Record<string, unknown>;
	const inner = bag.send_invoice_reminder as
		| {
				execute?: (a: unknown, o: unknown) => Promise<unknown>;
				[k: string]: unknown;
		  }
		| undefined;
	if (!inner?.execute || (inner as { __h8?: boolean }).__h8) return tools;
	const wrapped = {
		...inner,
		__h8: true,
		execute: async (args: unknown, opts: unknown) => {
			const invoiceId = String(
				(args as { invoice_id?: unknown })?.invoice_id ?? "",
			);
			const reservation = reserveReminderSlot(invoiceId);
			if (!reservation.allowed) {
				logAgentAction({
					action: "send_invoice_reminder",
					limitCheck: "BLOCKED",
					targetRef: invoiceId || undefined,
					executed: false,
					llmDecision: `tool-envelope -> BLOCKED: ${reservation.reason}`,
				});
				throw new Error(reservation.reason);
			}
			try {
				return await inner.execute?.(args, opts);
			} catch (e) {
				releaseReminderSlot(reservation.id);
				throw e;
			}
		},
	};
	bag.send_invoice_reminder = wrapped;
	return tools as ToolkitTools;
}
