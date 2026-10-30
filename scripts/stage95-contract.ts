/**
 * Stage 95: settled agreement -> contract JSON. Runs the real negotiation (stage 94),
 * builds the contract, validates it, and PROVES the validator rejects corruption.
 * Run: npm run stage95
 */
import { buildContract, validateContract } from "../src/contract.ts";
import { negotiate } from "../src/negotiation.ts";

const cfg = {
	item: "cross-border reconciliation report",
	quantity: 10,
	buyerTargetMinor: 40_000,
	buyerMaxMinor: 46_000,
	sellerFloorMinor: 45_000,
	maxRounds: 3,
	currency: "USD",
	paymentDays: 7,
};

const result = await negotiate(cfg);
if (!result.settled || result.agreedMinor === undefined) {
	console.log(
		`MARKER_CONTRACT_VALID: FAIL (negotiation not settled: ${result.reason})`,
	);
	process.exit(1);
}
console.log(
	`Negotiation: SETTLED at ${(result.agreedMinor / 100).toFixed(2)} in ${result.rounds.length} rounds\n`,
);

const transcript = result.rounds.map(
	(r) => `${r.agent.toUpperCase()}: ${r.message}`,
);
const contract = await buildContract(result, cfg, transcript);

console.log("=== contract.json ===");
console.log(JSON.stringify(contract, null, 2));

const good = validateContract(contract);
// Negative test: corrupt the total — the validator must refuse it.
const tampered = JSON.parse(JSON.stringify(contract)) as Record<
	string,
	unknown
>;
(tampered.price as { total_minor: number }).total_minor = 1;
const bad = validateContract(tampered);
// Negative test: no contract without agreement is enforced by buildContract itself.
const noDeal = await negotiate({ ...cfg, maxRounds: 1 }); // buyer opens, nobody settles
let refused = false;
try {
	await buildContract(noDeal, cfg, []);
} catch {
	refused = true;
}

const pass = good.ok && !bad.ok && refused && contract.status === "settled";
console.log(
	`\nvalidation: contract=${good.ok ? "VALID" : `INVALID(${good.errors.join(",")})`}, tampered=${bad.ok ? "ACCEPTED (BAD)" : "rejected (good)"}, unsettled-refused=${refused}`,
);
console.log(`MARKER_CONTRACT_VALID: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
