/**
 * Stage 67 marker: agent action #5 (core C variant) — tax/marketplace report
 * generated WITHOUT errors for both audiences.
 * Run: npm run stage67
 */
import { existsSync, readFileSync } from "node:fs";
import { getDb } from "../src/db.ts";
import { generateComplianceReport } from "../src/report.ts";

const db = getDb();
const FROM = "2026-10-27";
const TO = "2026-10-28";

const checks: Array<[string, boolean]> = [];
const reports: Array<{
	audience: string;
	file: string;
	payments: number;
	reviews: number;
}> = [];

for (const audience of ["tax", "marketplace"] as const) {
	const rep = generateComplianceReport(db, { from: FROM, to: TO, audience });
	const text = readFileSync(rep.file, "utf8");
	console.log(
		`${audience}: ${rep.file} | currencies=${rep.perCurrency.length} payments=${rep.perCurrency.reduce((s, c) => s + c.payments, 0)} review=${rep.reviewRows.length} unmatched=${rep.unmatched.length}`,
	);
	reports.push({
		audience,
		file: rep.file,
		payments: rep.perCurrency.reduce((s, c) => s + c.payments, 0),
		reviews: rep.reviewRows.length,
	});

	checks.push([`${audience}: file exists`, existsSync(rep.file)]);
	checks.push([
		`${audience}: period header present`,
		text.includes(`Period: ${FROM} .. ${TO}`),
	]);
	checks.push([
		`${audience}: per-currency table present`,
		/\| Currency \|/.test(text),
	]);
	checks.push([
		`${audience}: purpose line matches audience`,
		text.includes(audience === "tax" ? "ФОП" : "Marketplace seller"),
	]);
	checks.push([
		`${audience}: summary section present`,
		/## Summary/.test(text),
	]);
	// Every REVIEW row of the period must be listed (discrepancy detail).
	const allReviewed = rep.reviewRows.every((r) => text.includes(r.paymentId));
	checks.push([
		`${audience}: all ${rep.reviewRows.length} REVIEW rows listed`,
		allReviewed,
	]);
	// Numbers consistency: total payments in table == SQL sum.
	const tableSum = rep.perCurrency.reduce((s, c) => s + c.payments, 0);
	checks.push([
		`${audience}: summary total matches table (${tableSum})`,
		text.includes(`${tableSum} payments in period`),
	]);
}

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} compliance-report checks passed`);
if (pass !== checks.length)
	throw new Error(`ACTION#5 FAILED: ${pass}/${checks.length}`);
console.log(
	"STAGE 67 OK: action #5 (tax/marketplace report) executed without errors",
);
