/**
 * Stage 63 marker: LLM explanation generated for EVERY reconciliation case.
 * Deterministic reconcile first (engine), then the LLM narrative replaces the
 * rule-based ai_explanation (fallback keeps the rule text if the LLM fails).
 * Run: npm run stage63
 */

import { explainReconciliation } from "../src/actions.ts";
import { getDb } from "../src/db.ts";
import { createPaypalToolkit } from "../src/paypal.ts";
import { type PaymentRow, reconcilePayment } from "../src/reconcile.ts";

const tools = createPaypalToolkit().getTools();
const db = getDb();

// Idempotent: clear QA-X leftovers.
db.prepare(
	"DELETE FROM reconciliation_records WHERE payment_id IN (SELECT id FROM payments WHERE paypal_payment_id LIKE 'QA-X%')",
).run();
db.prepare("DELETE FROM payments WHERE paypal_payment_id LIKE 'QA-X%'").run();

function addPayment(
	id: string,
	currency: string,
	dollars: string,
	extra: Record<string, unknown>,
) {
	const minor = Math.round(parseFloat(dollars) * 100);
	db.prepare(
		`INSERT INTO payments (paypal_payment_id, currency, amount_minor, fee_minor, net_minor, status, source, received_at, raw_json)
     VALUES (?, ?, ?, 0, ?, 'COMPLETED', 'local_import', datetime('now'), ?)`,
	).run(id, currency, minor, minor, JSON.stringify({ qa_x: id, ...extra }));
}
// Invoices 9001 ($30 USD), 9002 ($40 USD), 9003 (EUR50) were created at stage 47 (SENT).
addPayment("QA-X1", "USD", "30.00", { invoice_number: "9001" }); // MATCHED
addPayment("QA-X2", "USD", "25.00", { invoice_number: "9001" }); // REVIEW partial -500
addPayment("QA-X3", "EUR", "30.00", { invoice_number: "9001" }); // REVIEW currency
addPayment("QA-X4", "USD", "77.00", {}); // UNMATCHED

const rows = db
	.prepare(
		`SELECT id, paypal_payment_id, currency, amount_minor, raw_json FROM payments
     WHERE paypal_payment_id LIKE 'QA-X%' ORDER BY paypal_payment_id`,
	)
	.all() as unknown as PaymentRow[];

let pass = 0;
let llmCount = 0;
for (const p of rows) {
	// 1) deterministic reconcile (stage-47 engine)
	const outcome = await reconcilePayment(tools, p);
	// Local invoice row for FK integrity (same upsert policy as the engine).
	let localInvId: number | null = null;
	if (outcome.invoiceId) {
		db.prepare(
			`INSERT INTO invoices (paypal_invoice_id, currency, subtotal_minor, total_minor, status, source, raw_json)
       VALUES (?, 'USD', 0, 0, 'SENT', 'recon_sync', json_object('paypal_id', ?))
       ON CONFLICT(paypal_invoice_id) DO NOTHING`,
		).run(outcome.invoiceId, outcome.invoiceId);
		localInvId = (
			db
				.prepare("SELECT id FROM invoices WHERE paypal_invoice_id = ?")
				.get(outcome.invoiceId) as {
				id: number;
			}
		).id;
	}
	db.prepare(
		`INSERT INTO reconciliation_records (payment_id, invoice_id, status, match_method, variance_minor, currency, reason, ai_explanation, decided_by, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agent', datetime('now'))`,
	).run(
		p.id,
		localInvId,
		outcome.status,
		outcome.matchMethod ?? null,
		outcome.varianceMinor,
		p.currency,
		outcome.reason ?? null,
		outcome.explanation, // rule-based placeholder until LLM runs
	);

	// 2) LLM narrative for THIS case
	const rawInv = JSON.parse(p.raw_json) as { invoice_number?: string };
	const invRow = rawInv.invoice_number
		? (db
				.prepare(
					"SELECT paypal_invoice_id, currency, total_minor, status FROM invoices WHERE raw_json LIKE ? LIMIT 1",
				)
				.get(`%${rawInv.invoice_number}%`) as
				| Record<string, unknown>
				| undefined)
		: undefined;
	const llm = await explainReconciliation(
		{
			payment: {
				amountMinor: p.amount_minor,
				currency: p.currency,
				invoiceNumber: rawInv.invoice_number,
			},
			invoice: invRow
				? {
						invoiceNumber: rawInv.invoice_number ?? "(unknown)",
						totalMinor: Number(invRow.total_minor ?? 0),
						currency: String(invRow.currency ?? "?"),
						status: String(invRow.status ?? "?"),
					}
				: null,
			outcome: {
				status: outcome.status,
				matchMethod: outcome.matchMethod,
				varianceMinor: outcome.varianceMinor,
				reason: outcome.reason,
			},
		},
		outcome.explanation,
	);
	if (llm.via === "llm") llmCount++;
	db.prepare(
		"UPDATE reconciliation_records SET ai_explanation = ? WHERE payment_id = ?",
	).run(llm.text, p.id);

	const ok = llm.text.length > 20 && llm.text !== outcome.explanation;
	console.log(
		`${ok ? "✓" : "✗"} ${p.paypal_payment_id} [${outcome.status}] via=${llm.via}: ${llm.text.slice(0, 110)}`,
	);
	if (ok) pass++;
}

console.log(
	`\n${pass}/${rows.length} explanations generated (llm=${llmCount})`,
);
if (pass !== rows.length)
	throw new Error(`EXPLANATION QA FAILED: ${pass}/${rows.length}`);
console.log("STAGE 63 OK: LLM explanation for every reconciliation case");
