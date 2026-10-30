/**
 * Stage 98: limits — (a) NO action without a recorded, valid agreement;
 * (b) negotiation NEVER exceeds MAX_ROUNDS (10). A violation must STOP the
 * simulation (no PayPal call, contract refused, refusal audit-logged).
 * Run: npm run stage98
 */

import { buildContract, createInvoiceFromContract } from "../src/contract.ts";
import { getDb } from "../src/db.ts";
import { MAX_ROUNDS, negotiate } from "../src/negotiation.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const db = getDb();
const executedInvoices = () =>
	(
		db
			.prepare(
				`SELECT COUNT(*) c FROM agent_actions WHERE action='create_invoice' AND executed=1`,
			)
			.get() as { c: number }
	).c;

const checks: Record<string, boolean> = {};

// --- (a) impossible deal: buyer max < seller floor -> hits the round cap ------
const impossible = {
	item: "cross-border reconciliation report",
	quantity: 10,
	buyerTargetMinor: 38_000,
	buyerMaxMinor: 40_000, // $400 ceiling
	sellerFloorMinor: 45_000, // $450 floor — can never agree
	maxRounds: MAX_ROUNDS,
	currency: "USD",
};
console.log(`scenario A: impossible deal, maxRounds=${MAX_ROUNDS}`);
const before = executedInvoices();
const result = await negotiate(impossible);
console.log(
	`  rounds=${result.rounds.length} settled=${result.settled} reason="${result.reason}"`,
);
checks["rounds stop exactly at the cap"] = result.rounds.length === MAX_ROUNDS;
checks["cap is hard (config asked for 10)"] = MAX_ROUNDS === 10;
checks["no settlement -> no agreed price"] =
	!result.settled && result.agreedMinor === undefined;

let contractRefused = false;
try {
	await buildContract(result, impossible, []);
} catch (e) {
	contractRefused = true;
	console.log(
		`  buildContract: ${(e instanceof Error ? e.message : String(e)).slice(0, 90)}`,
	);
}
checks["no agreement -> contract refused"] = contractRefused;

// --- (b) invalid agreement recorded -> invoice action refused ---------------
const settled = await negotiate({
	item: "cross-border reconciliation report",
	quantity: 10,
	buyerTargetMinor: 40_000,
	buyerMaxMinor: 46_000,
	sellerFloorMinor: 45_000,
	maxRounds: 3,
	currency: "USD",
	paymentDays: 7,
});
if (!settled.settled || settled.agreedMinor === undefined) {
	console.log("setup failed: valid negotiation did not settle");
	console.log("MARKER_LIMITS_ENFORCE: FAIL");
	process.exit(1);
}
const goodContract = await buildContract(
	settled,
	{
		item: "cross-border reconciliation report",
		quantity: 10,
		buyerTargetMinor: 40_000,
		buyerMaxMinor: 46_000,
		sellerFloorMinor: 45_000,
		maxRounds: 3,
		currency: "USD",
		paymentDays: 7,
	},
	settled.rounds.map((r) => `${r.agent.toUpperCase()}: ${r.message}`),
	{ buyerEmail: process.env.SANDBOX_BUYER_EMAIL ?? "" },
);
// Corrupt the recorded agreement: wrong total (simulates a tampered/absent deal).
const tampered = JSON.parse(
	JSON.stringify(goodContract),
) as typeof goodContract;
tampered.price.total_minor = 1;

const tools = createPaypalToolkit().getTools();
let invoiceRefused = false;
try {
	await createInvoiceFromContract(tools, tampered);
} catch (e) {
	invoiceRefused = true;
	console.log(
		`  createInvoice: ${(e instanceof Error ? e.message : String(e)).slice(0, 90)}`,
	);
}
await sleep(500);
const after = executedInvoices();
const blocked = db
	.prepare(
		`SELECT COUNT(*) c FROM agent_actions WHERE action='create_invoice' AND limit_check='BLOCKED' AND executed=0`,
	)
	.get() as { c: number };

checks["invalid agreement -> invoice refused"] = invoiceRefused;
checks["no executed invoice appeared from the violation"] = after === before;
checks["refusal audit-logged as BLOCKED"] = blocked.c >= 1;

for (const [k, v] of Object.entries(checks))
	console.log(`  ${v ? "OK  " : "FAIL"} ${k}`);
const pass = Object.values(checks).every(Boolean);
console.log(`MARKER_LIMITS_ENFORCE: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
