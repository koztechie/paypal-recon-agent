/**
 * On-demand AI explanation of one ledger row (stage 85): WHY does this payment/invoice
 * carry its reconciliation status? Same anti-fragile pattern as the agent and the
 * NL filter — the LLM writes the prose, a deterministic template built from the SAME
 * database facts covers timeouts/errors. Nothing is invented: the model may only use
 * the facts we pass it.
 */
import { getDb } from "./db.ts";
import { chat } from "./llm.ts";

export interface ExplainResult {
	explanation: string;
	source: "llm" | "fallback";
	ms: number;
}

const SYMBOLS: Record<string, string> = {
	USD: "$",
	EUR: "€",
	GBP: "£",
	UAH: "₴",
};

function money(minor: number, currency: string): string {
	const sym = SYMBOLS[currency] ?? `${currency} `;
	return `${sym}${(minor / 100).toFixed(2)}`;
}

interface Facts {
	title: string;
	lines: string[];
	fallback: string;
}

function paymentFacts(ref: string): Facts | null {
	const db = getDb();
	const p = db
		.prepare(
			`SELECT id, paypal_payment_id, invoice_id, payer_email, currency, amount_minor,
              fee_minor, net_minor, status, source, received_at
       FROM payments WHERE paypal_payment_id = ?`,
		)
		.get(ref) as Record<string, unknown> | undefined;
	if (!p) return null;

	const rec = db
		.prepare(
			`SELECT status, match_method, variance_minor, currency, reason, ai_explanation, detected_at
       FROM reconciliation_records WHERE payment_id = ?`,
		)
		.get(Number(p.id)) as Record<string, unknown> | undefined;

	const linkedInv = p.invoice_id
		? (db
				.prepare(
					`SELECT paypal_invoice_id, invoice_number, buyer_email, currency, total_minor, status
         FROM invoices WHERE id = ?`,
				)
				.get(Number(p.invoice_id)) as Record<string, unknown> | undefined)
		: undefined;

	// Candidate scan: same currency, amount within +/-3 days (the engine's window).
	const candidates = db
		.prepare(
			`SELECT paypal_invoice_id, invoice_number, buyer_email, total_minor, status, issued_at,
              ABS(total_minor - ?) diff
       FROM invoices
       WHERE currency = ? AND issued_at IS NOT NULL
         AND julianday(issued_at) BETWEEN julianday(?) - 3 AND julianday(?) + 3
       ORDER BY diff LIMIT 3`,
		)
		.all(
			Number(p.amount_minor),
			String(p.currency),
			String(p.received_at),
			String(p.received_at),
		) as Array<Record<string, unknown>>;

	const amount = money(Number(p.amount_minor), String(p.currency));
	const reconStatus = String(rec?.status ?? "PENDING");
	const invDesc = (i: Record<string, unknown>) =>
		`invoice ${i.invoice_number ?? i.paypal_invoice_id} (${money(Number(i.total_minor), String(p.currency))}, ${i.status})`;

	const lines = [
		`payment ${p.paypal_payment_id}: ${amount} ${p.currency}, status ${p.status}, received ${p.received_at}, payer ${p.payer_email ?? "unknown"}`,
		`reconciliation: ${reconStatus}${rec?.match_method ? ` by ${rec.match_method}` : ""}, variance ${money(Number(rec?.variance_minor ?? 0), String(p.currency))}${rec?.reason ? `, reason: ${rec.reason}` : ""}`,
		linkedInv ? `linked ${invDesc(linkedInv)}` : "no invoice linked",
		candidates.length
			? `candidate invoices within +/-3 days: ${candidates.map(invDesc).join("; ")}`
			: "no candidate invoices in the +/-3-day window",
	];

	const closest = candidates[0] ?? null;

	let fallback: string;
	if (reconStatus === "MATCHED") {
		fallback = `MATCHED${rec?.match_method ? ` by ${rec.match_method}` : ""}: payment ${p.paypal_payment_id} (${amount}) corresponds to ${
			linkedInv ? invDesc(linkedInv) : "an invoice"
		}; variance ${money(Number(rec?.variance_minor ?? 0), String(p.currency))}.`;
	} else if (reconStatus === "REVIEW") {
		fallback = `REVIEW: payment ${p.paypal_payment_id} (${amount}) needs a human check${
			rec?.reason ? ` — ${rec.reason}` : ""
		}${closest ? `. Closest candidate: ${invDesc(closest)}` : ""}.`;
	} else {
		fallback = `UNMATCHED: payment ${p.paypal_payment_id} (${amount}${
			p.payer_email ? `, payer ${p.payer_email}` : ""
		}) was checked against ${candidates.length} candidate invoice(s) in ${p.currency} within +/-3 days; none matched by amount and reference${
			closest
				? ` (closest: ${invDesc(closest)}, delta ${money(
						Number(closest.diff),
						String(p.currency),
					)})`
				: ""
		}.`;
	}

	return {
		title: `PAYMENT ${p.paypal_payment_id} — ${reconStatus}`,
		lines,
		fallback,
	};
}

function invoiceFacts(ref: string): Facts | null {
	const db = getDb();
	const inv = db
		.prepare(
			`SELECT id, paypal_invoice_id, invoice_number, buyer_email, currency, total_minor, status, issued_at
       FROM invoices WHERE paypal_invoice_id = ?`,
		)
		.get(ref) as Record<string, unknown> | undefined;
	if (!inv) return null;

	const payments = db
		.prepare(
			`SELECT paypal_payment_id, amount_minor, currency, status, received_at
       FROM payments WHERE invoice_id = ?`,
		)
		.all(Number(inv.id)) as Array<Record<string, unknown>>;

	const total = money(Number(inv.total_minor), String(inv.currency));
	const lines = [
		`invoice ${inv.invoice_number ?? inv.paypal_invoice_id}: total ${total}, status ${inv.status}, buyer ${inv.buyer_email ?? "unknown"}, issued ${inv.issued_at ?? "unknown"}`,
		payments.length
			? `linked payments: ${payments
					.map(
						(p) =>
							`${p.paypal_payment_id} (${money(Number(p.amount_minor), String(p.currency))}, ${p.status})`,
					)
					.join("; ")}`
			: "no payments linked yet",
	];

	const fallback =
		inv.status === "PAID" && payments.length
			? `PAID: invoice ${inv.invoice_number ?? inv.paypal_payment_id} (${total}) was covered by payment ${payments[0]?.paypal_payment_id}.`
			: payments.length
				? `Status ${inv.status}: invoice ${inv.invoice_number ?? inv.paypal_payment_id} (${total}) has ${payments.length} linked payment(s); the sum may not cover the total yet.`
				: `Status ${inv.status}: invoice ${inv.invoice_number ?? inv.paypal_payment_id} (${total}) has no linked payments yet.`;

	return {
		title: `INVOICE ${inv.invoice_number ?? inv.paypal_invoice_id} — ${inv.status}`,
		lines,
		fallback,
	};
}

const SYSTEM = `You are the reconciliation analyst of a PayPal payments agent.
Using ONLY the facts provided (no speculation), explain in 2-3 short sentences why this
record carries its reconciliation status. Mention concrete amounts, currencies and
reference ids. If it is UNMATCHED, state what was checked and why nothing matched.
Plain English, no bullet points, no greetings.`;

export async function explainLedgerRow(
	kind: string,
	ref: string,
	deadlineMs = 14_000,
): Promise<ExplainResult | null> {
	const t0 = Date.now();
	const facts =
		kind === "PAYMENT"
			? paymentFacts(ref)
			: kind === "INVOICE"
				? invoiceFacts(ref)
				: null;
	if (!facts) return null;

	const user = `${facts.title}\n${facts.lines.map((l) => `- ${l}`).join("\n")}`;

	const llm = chat(SYSTEM, user, {
		temperature: 0.2,
		maxTokens: 220,
		timeoutMs: deadlineMs,
	})
		.then((r) => (r.text.trim() ? r.text.trim() : null))
		.catch(() => null);

	const winner = await Promise.race([
		llm,
		new Promise<null>((resolve) =>
			setTimeout(() => resolve(null), deadlineMs + 500),
		),
	]);

	if (winner)
		return { explanation: winner, source: "llm", ms: Date.now() - t0 };
	return {
		explanation: facts.fallback,
		source: "fallback",
		ms: Date.now() - t0,
	};
}
