/**
 * Row actions from the Ledger UI (stage 86): "send reminder" and "mark matched".
 * Both go through the SAME guarded paths as the autonomous agent — there is no
 * privileged shortcut from the UI:
 * - sendInvoiceReminder: <=1 reminder / 24h, <=3 per invoice lifetime, audit-logged,
 *   protected invoices (stage-42 subjects) refused by design.
 * - resolveReconciliation: REVIEW -> MATCHED with decided_by='human' (the one place
 *   a human decision is expected; SECURITY.md red list stays intact).
 */

import { PROTECTED_INVOICES } from "./agent-actions.ts";
import { logAgentAction } from "./auditlog.ts";
import { getDb } from "./db.ts";
import { checkReminderAllowed, sendInvoiceReminder } from "./invoicing.ts";
import { createPaypalToolkit } from "./paypal.ts";
import { resolveReconciliation } from "./reconcile.ts";

export interface RowActionResult {
	ok: boolean;
	action: string;
	message: string;
}

const fail = (action: string, message: string): RowActionResult => ({
	ok: false,
	action,
	message,
});

/** Guarded PayPal call: send an invoice reminder (real sandbox transmission). */
export async function sendRowReminder(ref: string): Promise<RowActionResult> {
	const action = "send_reminder";
	const db = getDb();
	const inv = db
		.prepare(
			`SELECT id, status, invoice_number FROM invoices WHERE paypal_invoice_id = ?`,
		)
		.get(ref) as
		| { id: number; status: string; invoice_number: string | null }
		| undefined;
	if (!inv) return fail(action, "Invoice not found locally.");
	if (PROTECTED_INVOICES.has(ref)) {
		return fail(
			action,
			"Protected invoice (auto-reminder test subject) — refused.",
		);
	}
	if (inv.status !== "SENT") {
		return fail(
			action,
			`Invoice status is ${inv.status} — reminders only for SENT invoices.`,
		);
	}
	// Pre-check for a friendly message; sendInvoiceReminder enforces the same gate.
	const gate = checkReminderAllowed(ref);
	if (!gate.allowed) {
		logAgentAction({
			action: "send_invoice_reminder",
			limitCheck: "BLOCKED",
			targetRef: ref,
			executed: false,
			llmDecision: `ui-request blocked: ${gate.reason}`,
		});
		return fail(action, gate.reason);
	}

	const tools = createPaypalToolkit().getTools();
	await sendInvoiceReminder(
		tools,
		ref,
		`Manual reminder from the Ledger UI (invoice ${inv.invoice_number ?? ref})`,
	);
	return {
		ok: true,
		action,
		message: `Reminder sent for ${inv.invoice_number ?? ref} — PayPal accepted; rate limits (1/24h, 3 lifetime) and audit trail applied.`,
	};
}

/** Human decision: resolve a REVIEW payment to MATCHED (decided_by='human'). */
export function markRowMatched(ref: string): RowActionResult {
	const action = "mark_matched";
	const db = getDb();
	const rec = db
		.prepare(
			`SELECT r.id, r.status FROM reconciliation_records r
       JOIN payments p ON p.id = r.payment_id
       WHERE p.paypal_payment_id = ?`,
		)
		.get(ref) as { id: number; status: string } | undefined;
	if (!rec) return fail(action, "No reconciliation record for this payment.");
	if (rec.status !== "REVIEW") {
		return fail(
			action,
			`Only REVIEW rows can be marked matched (this one is ${rec.status}); UNMATCHED needs an invoice link first.`,
		);
	}
	resolveReconciliation(
		db,
		rec.id,
		"marked matched from the Ledger UI (human decision)",
	);
	logAgentAction({
		action: "mark_matched",
		limitCheck: "PASS",
		targetRef: ref,
		executed: true,
		llmDecision: "human:ledger-ui",
	});
	return {
		ok: true,
		action,
		message:
			"Marked MATCHED — decided_by=human, match_method=manual, audit trail updated.",
	};
}
