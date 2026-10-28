/**
 * Daily summary (stage 66, agent action #4): counts from a day of data,
 * rendered as a merchant report. LLM polishes; deterministic template is the
 * fallback (and the numbers ALWAYS come from SQL, never from the model).
 * Usage cadence: once per day (SECURITY stage-19 action table).
 */
import type { DatabaseSync } from "node:sqlite";
import { chat } from "./llm.ts";

export interface DailyStats {
	date: string;
	payments: number;
	matched: number;
	review: number;
	unmatched: number;
	matchedAmountMinor: number;
	varianceAbsMinor: number;
	events: number;
	remindersSent: number;
}

export function collectDailyStats(db: DatabaseSync, date?: string): DailyStats {
	const day = date ?? new Date().toISOString().slice(0, 10);
	const one = <T>(sql: string, ...args: unknown[]): T =>
		db.prepare(sql).get(...(args as never[])) as T;

	const payments = one<{ c: number }>(
		"SELECT count(*) c FROM payments WHERE date(received_at) = date(?)",
		day,
	).c;
	const statuses = db
		.prepare(
			`SELECT r.status, count(*) c, COALESCE(SUM(CASE WHEN r.status='MATCHED' THEN p.amount_minor ELSE 0 END),0) amt,
            COALESCE(SUM(ABS(r.variance_minor)),0) varsum
     FROM reconciliation_records r JOIN payments p ON p.id = r.payment_id
     WHERE date(r.detected_at) = date(?) GROUP BY r.status`,
		)
		.all(day) as Array<{
		status: string;
		c: number;
		amt: number;
		varsum: number;
	}>;
	const by = (s: string) => statuses.find((x) => x.status === s)?.c ?? 0;
	const events = one<{ c: number }>(
		"SELECT count(*) c FROM webhook_events WHERE date(received_at) = date(?)",
		day,
	).c;
	const remindersSent = one<{ c: number }>(
		"SELECT count(*) c FROM agent_actions WHERE action='send_invoice_reminder' AND executed=1 AND date(created_at) = date(?)",
		day,
	).c;

	return {
		date: day,
		payments,
		matched: by("MATCHED"),
		review: by("REVIEW"),
		unmatched: by("UNMATCHED"),
		matchedAmountMinor: statuses.find((x) => x.status === "MATCHED")?.amt ?? 0,
		varianceAbsMinor: statuses.reduce((s, x) => s + x.varsum, 0),
		events,
		remindersSent,
	};
}

const money = (minor: number) => `${(minor / 100).toFixed(2)}`;

const SUMMARY_SYSTEM = [
	"You write a ONE-PARAGRAPH daily merchant report from pre-computed numbers.",
	"Rules: repeat EXACTLY the numbers given (amounts as dollars with 2 decimals),",
	"never invent data, plain English, no markdown headings, start with the date.",
	"Cover: payments received, matched, in review/discrepancies, unmatched,",
	"total matched amount, absolute variance, webhook events, reminders sent.",
].join("\n");

export async function dailySummary(
	db: DatabaseSync,
	date?: string,
): Promise<{ report: string; stats: DailyStats; via: "llm" | "template" }> {
	const stats = collectDailyStats(db, date);
	const template =
		`${stats.date}: ${stats.payments} payments received; ${stats.matched} matched ` +
		`(${money(stats.matchedAmountMinor)} USD), ${stats.review} in discrepancy review, ` +
		`${stats.unmatched} unmatched; |variance| ${money(stats.varianceAbsMinor)} USD; ` +
		`${stats.events} webhook events; ${stats.remindersSent} reminders sent.`;

	try {
		const r = await chat(SUMMARY_SYSTEM, JSON.stringify(stats), {
			temperature: 0,
			maxTokens: 220,
		});
		const text = r.text.trim();
		if (text.length < 40 || !text.includes(String(stats.payments))) {
			return { report: template, stats, via: "template" };
		}
		return { report: text, stats, via: "llm" };
	} catch {
		return { report: template, stats, via: "template" };
	}
}
