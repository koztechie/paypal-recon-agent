/**
 * Stage 71 probe: agent action latency (demo criterion < 10 s per action).
 * 10 real LLM-backed actions through POST /api/nl-filter (the same Gemini path the
 * agent uses), each with a correctness expectation. Prints JSON with per-action
 * latency + correctness + median.
 */
const URL_ = "http://localhost:3000/api/nl-filter";

const cases = [
	{
		q: "show unmatched payments over $50",
		expect: { recon: "UNMATCHED", kind: "PAYMENT", amountMin: 50 },
	},
	{ q: "review payments", expect: { recon: "REVIEW", kind: "PAYMENT" } },
	{
		q: "invoices with status SENT",
		expect: { kind: "INVOICE", status: "SENT" },
	},
	{ q: "payments in EUR", expect: { kind: "PAYMENT", currency: "EUR" } },
	{ q: "matched payments", expect: { recon: "MATCHED", kind: "PAYMENT" } },
	{ q: "payments under $40", expect: { kind: "PAYMENT", amountMax: 40 } },
	{ q: "all invoices", expect: { kind: "INVOICE" } },
	{ q: "pending reconciliation", expect: { recon: "PENDING" } },
	{ q: "completed payments", expect: { kind: "PAYMENT", status: "COMPLETED" } },
	{ q: "unmatched invoices", expect: { kind: "INVOICE", recon: "UNMATCHED" } },
];

const median = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

(async () => {
	const results = [];
	for (const c of cases) {
		const t0 = Date.now();
		let ok = false;
		let source = "error";
		let filter = null;
		let err = null;
		try {
			const res = await fetch(URL_, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: c.q }),
				signal: AbortSignal.timeout(45000),
			});
			const data = await res.json();
			const ms = Date.now() - t0;
			source = data.source ?? "unknown";
			filter = data.filter ?? null;
			ok =
				!!data.ok &&
				Object.entries(c.expect).every(
					([k, v]) => filter && String(filter[k]) === String(v),
				);
			results.push({ q: c.q, ms, source, ok, filter });
		} catch (e) {
			err = String(e).slice(0, 80);
			results.push({ q: c.q, ms: Date.now() - t0, source, ok: false, err });
		}
		const last = results[results.length - 1];
		console.log(
			`${last.ok ? "OK " : "FAIL"} ${last.ms}ms [${last.source}] ${c.q}`,
		);
	}
	const lat = results.map((r) => r.ms);
	const correct = results.filter((r) => r.ok).length;
	const viaLlm = results.filter((r) => r.source === "llm").length;
	const out = {
		at: new Date().toISOString(),
		n: results.length,
		correct,
		viaLlm,
		medianMs: median(lat),
		minMs: Math.min(...lat),
		maxMs: Math.max(...lat),
		medianUnder10s: median(lat) < 10000,
		results,
	};
	console.log(`SUMMARY ${JSON.stringify({ ...out, results: undefined })}`);
	process.exit(0);
})().catch((e) => {
	console.error("PROBE CRASH:", e);
	process.exit(1);
});
