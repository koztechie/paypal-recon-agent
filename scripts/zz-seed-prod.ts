/** One-off: prod re-seed after the C-2 deploy (also re-proves the C-1 signed path).
 * Run: node --env-file-if-exists=.env.local scripts/zz-seed-prod.ts (deleted after). */
import {
	createDraftInvoice,
	recordExternalPayment,
	sendInvoice,
} from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const PROD = "https://paypal-recon-agent.onrender.com";
const NUM = `SEED-C2-${Date.now() % 100000}`;
const buyerEmail = process.env.SANDBOX_BUYER_EMAIL;
if (!buyerEmail) {
	console.error("SANDBOX_BUYER_EMAIL missing");
	process.exit(1);
}
const tools = createPaypalToolkit().getTools();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const inv = await createDraftInvoice(tools, {
	buyerEmail,
	itemName: "cross-border reconciliation report",
	amount: "45.00",
	currency: "USD",
	invoiceNumber: NUM,
	note: `C-2 re-seed ${NUM}`,
});
if (!inv.id) {
	console.error("CREATE failed:", inv);
	process.exit(1);
}
console.log("1 create:", inv.id, NUM);
await sendInvoice(tools, inv.id, NUM);
console.log("2 sent");
await sleep(4000);
await recordExternalPayment(tools, inv.id, "45.00", "USD", NUM);
console.log("3 paid (real signed INVOICE.PAID fires at PayPal)");

let matched = false;
let last = "";
for (let i = 1; i <= 10 && !matched; i++) {
	await sleep(8000);
	const run = await fetch(`${PROD}/api/recon/run`, {
		method: "POST",
		headers: { "X-Action-Token": process.env.ACTION_TOKEN ?? "" },
	});
	last = JSON.stringify(await run.json());
	console.log(`4 recon poll ${i}:`, last.slice(0, 160));
	matched = last.includes("MATCHED");
}
const rows = (await (await fetch(`${PROD}/api/recon/rows`)).json()) as {
	rows?: unknown[];
};
console.log("5 prod rows:", rows.rows?.length ?? 0);
console.log(`SEED ${matched ? "OK" : "CHECK"}: ${NUM}`);
