/**
 * Stage 94: two LLM agents with roles (buyer budget / seller floor) — console
 * simulation of the demo-scenario negotiation (DEMO-SCENARIO.md replicas 1-3).
 * Run: node --env-file-if-exists=.env.local scripts/stage94-negotiate.ts
 */
import { negotiate } from "../src/negotiation.ts";

const cfg = {
	item: "cross-border reconciliation report",
	quantity: 10,
	buyerTargetMinor: 40_000, // $400 opening (scenario replica 1)
	buyerMaxMinor: 46_000, // authorization ceiling (never shown as a number in dialogue)
	sellerFloorMinor: 45_000, // $450 floor (scenario replica 2)
	maxRounds: 3,
	currency: "USD",
};

console.log(
	`=== Negotiation: ${cfg.quantity} × "${cfg.item}" (USD) ===\n` +
		`buyer: open ${(cfg.buyerTargetMinor / 100).toFixed(0)}$, max ${(cfg.buyerMaxMinor / 100).toFixed(0)}$ | ` +
		`seller: floor ${(cfg.sellerFloorMinor / 100).toFixed(0)}$\n`,
);

const result = await negotiate(cfg);

for (const r of result.rounds) {
	console.log(`Round ${r.round} — ${r.agent.toUpperCase()}: "${r.message}"  [${(r.priceMinor / 100).toFixed(2)}]`);
}

console.log(
	result.settled
		? `\nResult: SETTLED at ${(result.agreedMinor! / 100).toFixed(2)} ${cfg.currency} after ${result.rounds.length} rounds (${result.reason})`
		: `\nResult: NOT SETTLED — ${result.reason}`,
);

// Machine-checkable marker: exactly 3 rounds AND settled.
const ok = result.settled && result.rounds.length === 3;
console.log(`MARKER_3_ROUNDS: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
