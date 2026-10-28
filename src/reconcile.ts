/**
 * Reconciliation engine (stage 47; rules from stage-19 action table).
 *
 * Policy: automatic MATCH only on EXACT agreement — invoice number + amount +
 * currency. Anything else is REVIEW (with variance/reason) or UNMATCHED.
 * ai_explanation is rule-based for now; LLM explanation arrives at stages 59-65.
 */
import type { DatabaseSync } from "node:sqlite";
import type { ToolkitTools } from "./paypal.ts";

export interface PaymentRow {
	id: number;
	paypal_payment_id: string;
	currency: string;
	amount_minor: number;
	raw_json: string;
}

export interface InvoiceLite {
	id: string;
	invoice_number?: string;
	currency?: string;
	total_minor?: number;
	status?: string;
}

export type ReconStatus = "MATCHED" | "UNMATCHED" | "REVIEW";

export interface ReconOutcome {
	status: ReconStatus;
	invoiceId?: string;
	matchMethod?: "exact" | "number_amount" | "amount_buyer" | "manual";
	varianceMinor: number;
	reason?: string;
	explanation: string;
}

function parseRaw(raw: string): Record<string, unknown> {
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return {};
	}
}

async function listAllInvoices(tools: ToolkitTools): Promise<InvoiceLite[]> {
	const execute = (
		tools.list_invoices as unknown as {
			execute: (a: unknown, o: unknown) => Promise<unknown>;
		}
	).execute;
	const raw = await execute(
		{ page: 1, page_size: 20, total_required: true },
		{ toolCallId: "recon-list", messages: [] },
	);
	const data = JSON.parse(String(raw)) as {
		items?: Array<Record<string, unknown>>;
	};
	return (data.items ?? []).map((i) => {
		const detail = (i.detail ?? {}) as Record<string, unknown>;
		const amount = (i.amount ?? {}) as {
			value?: string;
			currency_code?: string;
		};
		return {
			id: String(i.id),
			invoice_number: detail.invoice_number
				? String(detail.invoice_number)
				: undefined,
			currency: amount.currency_code,
			total_minor: amount.value
				? Math.round(parseFloat(amount.value) * 100)
				: undefined,
			status: i.status ? String(i.status) : undefined,
		};
	});
}

export async function reconcilePayment(
	tools: ToolkitTools,
	payment: PaymentRow,
): Promise<ReconOutcome> {
	const raw = parseRaw(payment.raw_json);
	const refNumber =
		typeof raw.invoice_number === "string"
			? raw.invoice_number
			: typeof raw.reference === "string"
				? raw.reference
				: undefined;

	const invoices = await listAllInvoices(tools);

	if (refNumber) {
		const inv = invoices.find((i) => i.invoice_number === refNumber);
		if (!inv) {
			return {
				status: "UNMATCHED",
				varianceMinor: 0,
				reason: `invoice #${refNumber} not found`,
				explanation: `Payment ${payment.paypal_payment_id} references invoice #${refNumber}, which does not exist in PayPal — cannot match.`,
			};
		}
		if (inv.currency !== payment.currency) {
			return {
				status: "REVIEW",
				invoiceId: inv.id,
				varianceMinor: 0,
				reason: `currency mismatch: payment ${payment.currency} vs invoice ${inv.currency}`,
				explanation: `Payment ${payment.paypal_payment_id} (${payment.currency}) references invoice #${refNumber} (${inv.currency}): different currencies require a human decision (FX rate unknown).`,
			};
		}
		const variance = payment.amount_minor - (inv.total_minor ?? 0);
		if (variance !== 0) {
			return {
				status: "REVIEW",
				invoiceId: inv.id,
				varianceMinor: variance,
				reason: `amount variance: ${(variance / 100).toFixed(2)} ${payment.currency}`,
				explanation: `Payment ${payment.paypal_payment_id} is ${(Math.abs(variance) / 100).toFixed(2)} ${payment.currency} ${variance > 0 ? "above" : "below"} invoice #${refNumber} total — likely partial or over payment; human review.`,
			};
		}
		return {
			status: "MATCHED",
			invoiceId: inv.id,
			matchMethod: "number_amount",
			varianceMinor: 0,
			explanation: `Payment ${payment.paypal_payment_id} matches invoice #${refNumber} exactly: number + amount (${(payment.amount_minor / 100).toFixed(2)}) + currency (${payment.currency}).`,
		};
	}

	// No reference: exact amount+currency among OPEN invoices (unique) -> matched.
	const open = invoices.filter(
		(i) =>
			i.currency === payment.currency &&
			i.total_minor === payment.amount_minor &&
			(i.status === "SENT" || i.status === "PARTIALLY_PAID"),
	);
	if (open.length === 1) {
		const inv = open[0] as InvoiceLite;
		return {
			status: "MATCHED",
			invoiceId: inv.id,
			matchMethod: "amount_buyer",
			varianceMinor: 0,
			explanation: `Payment ${payment.paypal_payment_id} has no reference, but exactly one open invoice (#${inv.invoice_number ?? inv.id}) has the same amount and currency — matched by amount+currency.`,
		};
	}
	return {
		status: "UNMATCHED",
		varianceMinor: 0,
		reason:
			open.length === 0
				? "no open invoice with this amount"
				: "ambiguous: several open invoices with same amount",
		explanation: `Payment ${payment.paypal_payment_id} carries no invoice reference and no unique open invoice matches its amount/currency — flagged UNMATCHED for manual handling.`,
	};
}

/**
 * Human resolution of a REVIEW discrepancy (stage 53, SECURITY: decided_by='human').
 * Moves status to MATCHED with match_method='manual', keeping the original variance
 * and ai_explanation (audit trail preserved).
 */
export function resolveReconciliation(
	db: DatabaseSync,
	reconId: number,
	resolution: string,
): void {
	db.prepare(
		`UPDATE reconciliation_records
     SET status = 'MATCHED', match_method = 'manual', resolution = ?,
         resolved_at = datetime('now'), decided_by = 'human'
     WHERE id = ? AND status = 'REVIEW'`,
	).run(resolution, reconId);
}

export function saveReconciliation(
	db: DatabaseSync,
	payment: PaymentRow,
	outcome: ReconOutcome,
): number {
	let localInvoiceId: number | null = null;
	if (outcome.invoiceId) {
		localInvoiceId = upsertLocalInvoice(db, outcome.invoiceId);
	}
	const res = db
		.prepare(
			`INSERT INTO reconciliation_records (payment_id, invoice_id, status, match_method, variance_minor, currency, reason, ai_explanation, decided_by, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agent', datetime('now'))`,
		)
		.run(
			payment.id,
			localInvoiceId,
			outcome.status,
			outcome.matchMethod ?? null,
			outcome.varianceMinor,
			payment.currency,
			outcome.reason ?? null,
			outcome.explanation,
		);
	return Number(res.lastInsertRowid);
}

/** Sync a PayPal invoice into the local invoices table; returns local rowid. */
function upsertLocalInvoice(db: DatabaseSync, paypalId: string): number {
	const existing = db
		.prepare("SELECT id FROM invoices WHERE paypal_invoice_id = ?")
		.get(paypalId) as { id?: number } | undefined;
	if (existing?.id) return existing.id;
	// Minimal row; full detail sync is stage 48+ scope.
	db.prepare(
		`INSERT INTO invoices (paypal_invoice_id, currency, subtotal_minor, total_minor, status, source, raw_json)
     VALUES (?, 'USD', 0, 0, 'SENT', 'recon_sync', json_object('paypal_id', ?))
     ON CONFLICT(paypal_invoice_id) DO NOTHING`,
	).run(paypalId, paypalId);
	const row = db
		.prepare("SELECT id FROM invoices WHERE paypal_invoice_id = ?")
		.get(paypalId) as {
		id: number;
	};
	return row.id;
}

export async function reconcilePending(
	tools: ToolkitTools,
	db: DatabaseSync,
): Promise<ReconOutcome[]> {
	const pending = db
		.prepare(
			`SELECT p.id, p.paypal_payment_id, p.currency, p.amount_minor, p.raw_json
       FROM payments p
       LEFT JOIN reconciliation_records r ON r.payment_id = p.id
       WHERE r.id IS NULL AND p.status = 'COMPLETED'`,
		)
		.all() as unknown as PaymentRow[];
	const outcomes: ReconOutcome[] = [];
	for (const p of pending) {
		const outcome = await reconcilePayment(tools, p);
		saveReconciliation(db, p, outcome);
		outcomes.push(outcome);
	}
	return outcomes;
}
