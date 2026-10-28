/**
 * Stage 66 marker: the daily report IS generated from a real day of data.
 * Run: npm run stage66
 */
import { getDb } from "../src/db.ts";
import { collectDailyStats, dailySummary } from "../src/report.ts";

const db = getDb();

// Stats for YESTERDAY (27.10 — the first webhook day) and TODAY.
for (const day of ["2026-10-27", "2026-10-28"]) {
	const s = collectDailyStats(db, day);
	console.log(
		`${day}: payments=${s.payments} matched=${s.matched} review=${s.review} unmatched=${s.unmatched} events=${s.events} reminders=${s.remindersSent}`,
	);
}

const { report, stats, via } = await dailySummary(db, "2026-10-28");
console.log(
	`\n--- DAILY REPORT (${via}) ---\n${report}\n-----------------------------`,
);

// Consistency: the report must carry the real SQL numbers.
const checks: Array<[string, boolean]> = [
	["day has real data (payments > 0)", stats.payments > 0],
	["report generated", report.length > 40],
	[
		"report contains payment count from SQL",
		report.includes(String(stats.payments)),
	],
	[
		"report contains matched count from SQL",
		report.includes(String(stats.matched)),
	],
	[
		"report mentions discrepancy/review concept",
		/review|discrepan/i.test(report),
	],
	["no markdown headings (plain paragraph)", !/^#\s|\n#\s/m.test(report)],
	[
		"yesterday stats computable (date attr present)",
		collectDailyStats(db, "2026-10-27").date === "2026-10-27",
	],
];

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} daily-report checks passed`);
if (pass !== checks.length)
	throw new Error(`REPORT QA FAILED: ${pass}/${checks.length}`);
console.log("STAGE 66 OK: daily summary generated from a day of data");
