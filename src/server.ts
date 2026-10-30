/**
 * Minimal HTTP server skeleton (stage 32).
 * Zero runtime dependencies: node:http only.
 * Routes: GET /health -> 200 (marker for stage 32), GET / -> app stub.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { buildContract } from "./contract.ts";
import {
	getDb,
	insertPaymentFromEvent,
	insertPaymentFromInvoiceEvent,
	insertWebhookEvent,
} from "./db.ts";
import { explainLedgerRow } from "./explain.ts";
import { negotiate } from "./negotiation.ts";
import { parseLedgerQuery } from "./nl.ts";
import { createPaypalToolkit } from "./paypal.ts";
import { reconcilePending } from "./reconcile.ts";
import {
	markRowMatched,
	type RowActionResult,
	sendRowReminder,
} from "./row-actions.ts";

mkdirSync("logs", { recursive: true });

const PORT = Number(process.env.PORT ?? 3000);

const MINI_DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cross-Border Reconciliation Agent — live demo</title>
<style>
:root{--navy:#001c64;--blue:#0070e0;--canvas:#f5f7fa;--border:#dbe1e8;--ink:#001435;--muted:#545d68;--ok:#00875a;--bad:#c4122f}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--ink);font-family:"PayPal Open","Helvetica Neue",Helvetica,Arial,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 20px}
h1{color:var(--navy);font-size:28px;margin:8px 0 4px}
.sub{color:var(--muted);font-size:15px;line-height:1.5}
.kicker{color:var(--muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.chip{border:1px solid var(--border);background:#fff;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:600;color:var(--navy)}
form{display:flex;gap:8px;margin:18px 0;flex-wrap:wrap}
input{flex:1;min-width:240px;height:40px;border:1px solid var(--border);border-radius:4px;padding:0 12px;font-size:14px;background:#fff;color:var(--ink)}
input:focus{outline:2px solid var(--blue);outline-offset:1px;border-color:var(--blue)}
button{height:40px;border:0;border-radius:4px;background:var(--blue);color:#fff;font-weight:600;padding:0 20px;cursor:pointer}
button:disabled{opacity:.6;cursor:not-allowed}
#out{background:#fff;border:1px solid var(--border);border-radius:6px;padding:14px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;white-space:pre-wrap;min-height:70px}
.muted{color:var(--muted);font-size:13px;line-height:1.5}
footer{margin-top:22px;font-size:13px;color:var(--muted)}
a{color:var(--blue)}
</style>
</head>
<body><main>
<p class="kicker">Hosted demo · no install required</p>
<h1>Cross-Border Reconciliation Agent</h1>
<p class="sub">Ask the agent about the ledger in plain English — the same AI layer (Gemini) the product uses, running on this service.</p>
<div class="chips"><span class="chip" id="health">checking /health…</span><span class="chip" id="count">checking data…</span></div>
<form id="f"><input id="q" aria-label="Question" placeholder="e.g. &quot;matched payments over $40&quot;"><button id="b" type="submit">Ask</button></form>
<div id="out">Results (filter + source + latency) appear here.</div>
<p class="muted">For the full local demo (web UI + console cycle): see the README — 3 commands.</p>
<footer>API: <a href="/health">/health</a> · <a href="/api/app-config">/api/app-config</a> · <a href="/api/recon/rows?count=1">/rows?count=1</a></footer>
<script>
(function(){
 var out=document.getElementById('out');
 fetch('/health').then(function(r){return r.json();}).then(function(){var e=document.getElementById('health');e.textContent='● health: OK';e.style.color='var(--ok)';}).catch(function(){var e=document.getElementById('health');e.textContent='● health: FAIL';e.style.color='var(--bad)';});
 fetch('/api/recon/rows?count=1').then(function(r){return r.json();}).then(function(d){document.getElementById('count').textContent='ledger rows: '+d.count;}).catch(function(){document.getElementById('count').textContent='ledger: n/a';});
 document.getElementById('f').addEventListener('submit',function(ev){
   ev.preventDefault();
   var q=document.getElementById('q').value.trim();
   var b=document.getElementById('b');
   if(!q){out.textContent='Type a question first — e.g. "matched payments over $40".';return;}
   b.disabled=true;b.textContent='Thinking…';out.textContent='…';
   fetch('/api/nl-filter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})})
    .then(function(r){return r.json();})
    .then(function(d){
      b.disabled=false;b.textContent='Ask';
      if(!d.ok){out.textContent='Error: '+(d.error||'unknown');return;}
      out.textContent='filter: '+JSON.stringify(d.filter)+' | source: '+d.source+' · '+(d.ms/1000).toFixed(1)+'s';
    })
    .catch(function(err){b.disabled=false;b.textContent='Ask';out.textContent='Request failed: '+err;});
});
})();
</script>
</body>
</html>
`;

const server = createServer((req, res) => {
	const url = req.url ?? "/";

	// Diagnostic access log (stage 122): API traffic becomes visible in the service
	// logs (Render Logs tab / npm run dev output). /health is excluded on purpose —
	// Render's health checks would flood it.
	if (url.startsWith("/api/")) {
		console.log(`[req] ${req.method} ${url.split("?")[0]}`);
	}

	if (url.startsWith("/health")) {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({ status: "ok", service: "paypal-reconciliation-agent" }),
		);
		return;
	}

	// Stage 125: the hosted-URL demo path — a self-contained page where a judge can
	// run the AI layer (plain-English ledger query) straight from the public URL,
	// with live health + row-count chips. No external assets, no install.
	if (req.method === "GET" && url.split("?")[0] === "/") {
		res.writeHead(200, {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
		});
		res.end(MINI_DEMO_HTML);
		return;
	}

	// PayPal webhook listener (stages 37-38, DB wiring stage 44). Always 200 on
	// parseable receipt: PayPal retries non-2xx. Raw payload -> NDJSON log;
	// every event -> webhook_events; PAYMENT.* -> payments row.
	if (req.method === "POST" && url.split("?")[0] === "/webhook") {
		let raw = "";
		req.on("data", (chunk: Buffer) => {
			raw += chunk.toString("utf8");
			if (raw.length > 1_000_000) req.destroy(); // payload guard
		});
		req.on("end", () => {
			try {
				const parsed = JSON.parse(raw) as { id?: string; event_type?: string };
				appendFileSync(
					"logs/webhooks.ndjson",
					`${JSON.stringify({ received_at: new Date().toISOString(), ...parsed, raw_len: raw.length })}\n`,
				);
				console.log(
					`[webhook] ${parsed.event_type ?? "unknown"} (${parsed.id ?? "no-id"})`,
				);
				try {
					const full = JSON.parse(raw) as Parameters<
						typeof insertWebhookEvent
					>[0];
					const dedupe = insertWebhookEvent(full, raw.length);
					if (full.event_type?.startsWith("PAYMENT.")) {
						const paymentId = insertPaymentFromEvent(full);
						console.log(
							`[webhook] payment row: ${paymentId ?? "none"} (${dedupe})`,
						);
					} else if (full.event_type === "INVOICING.INVOICE.PAID") {
						const paymentId = insertPaymentFromInvoiceEvent(full);
						console.log(
							`[webhook] invoice-paid row: ${paymentId ?? "none"} (${dedupe})`,
						);
					}
				} catch (dbErr) {
					console.error("[webhook] db error:", dbErr);
				}
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ received: true }));
			} catch {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "invalid JSON" }));
			}
		});
		return;
	}

	// Unified ledger for the AG Grid dashboard (stage 80): payments + invoices + events.
	// `?bench=N` (1..5000) returns N deterministic synthetic rows instead — the
	// performance fixture for stage 89 (1000 rows without freezes). Synthetic refs are
	// prefixed BENCH- so they can never be mistaken for real records.
	// `?count=1` returns only the row count (cheap, for the landing page chip).
	if (req.method === "GET" && url.split("?")[0] === "/api/recon/rows") {
		try {
			const rows: Array<Record<string, unknown>> = [];
			const benchMatch = /[?&]bench=(\d+)/.exec(url);
			if (benchMatch) {
				const n = Math.min(Math.max(Number(benchMatch[1]), 1), 5000);
				const recons = ["MATCHED", "REVIEW", "UNMATCHED", "PENDING"];
				const currencies = ["USD", "EUR", "GBP", "UAH"];
				const statuses = ["COMPLETED", "PENDING", "FAILED", "REFUNDED"];
				// Deterministic LCG — the same n always yields the same rows.
				let seed = 42;
				const rnd = () => {
					seed = (seed * 1664525 + 1013904223) % 4294967296;
					return seed / 4294967296;
				};
				for (let i = 0; i < n; i++) {
					const amount = Math.round((10 + rnd() * 990) * 100) / 100;
					const fee = Math.round(amount * 0.034 * 100) / 100;
					const day = 1 + Math.floor(rnd() * 28);
					const hour = Math.floor(rnd() * 24);
					rows.push({
						kind: "PAYMENT",
						ref: `BENCH-PAY-${String(i + 1).padStart(5, "0")}`,
						status: statuses[Math.floor(rnd() * statuses.length)],
						recon: recons[Math.floor(rnd() * recons.length)],
						amount: amount.toFixed(2),
						fee: fee.toFixed(2),
						variance:
							Math.floor(rnd() * 3) - 1 === 0
								? (rnd() * 10).toFixed(2)
								: "0.00",
						currency: currencies[Math.floor(rnd() * currencies.length)],
						at: `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}:00Z`,
						note: `Synthetic benchmark row ${i + 1} (stage 89 fixture) — amount ${amount} reconciled against the seeded ledger generator.`,
					});
				}
				res.writeHead(200, {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				});
				res.end(JSON.stringify({ rows, bench: n }));
				return;
			}
			if (/[?&]count=1/.test(url)) {
				const db = getDb();
				const c = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
				const count =
					c("SELECT COUNT(*) c FROM payments") +
					c("SELECT COUNT(*) c FROM invoices") +
					c("SELECT COUNT(*) c FROM webhook_events");
				res.writeHead(200, {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				});
				res.end(JSON.stringify({ count }));
				return;
			}
			const pay = getDb()
				.prepare(
					`SELECT p.paypal_payment_id ref, p.currency, p.amount_minor, p.fee_minor, p.net_minor,
              p.status, p.received_at at, r.status recon, r.variance_minor variance, r.ai_explanation note
       FROM payments p LEFT JOIN reconciliation_records r ON r.payment_id = p.id
       ORDER BY p.received_at`,
				)
				.all() as Array<Record<string, unknown>>;
			for (const p of pay) {
				rows.push({
					kind: "PAYMENT",
					ref: p.ref,
					status: p.status,
					recon: p.recon ?? "PENDING",
					amount: (Number(p.amount_minor) / 100).toFixed(2),
					fee: (Number(p.fee_minor) / 100).toFixed(2),
					net:
						p.net_minor != null ? (Number(p.net_minor) / 100).toFixed(2) : "",
					variance:
						p.variance != null ? (Number(p.variance) / 100).toFixed(2) : "",
					currency: p.currency,
					at: p.at,
					note: typeof p.note === "string" ? p.note : "",
				});
			}
			const inv = getDb()
				.prepare(
					`SELECT paypal_invoice_id ref, currency, total_minor, status, created_at at, source
       FROM invoices ORDER BY created_at`,
				)
				.all() as Array<Record<string, unknown>>;
			for (const i of inv) {
				rows.push({
					kind: "INVOICE",
					ref: i.ref,
					status: i.status,
					recon: "",
					amount: (Number(i.total_minor) / 100).toFixed(2),
					fee: "",
					variance: "",
					currency: i.currency,
					at: i.at,
					note: `local:${i.source}`,
				});
			}
			const ev = getDb()
				.prepare(
					`SELECT event_type, paypal_event_id ref, received_at at, payload_json payload
       FROM webhook_events
       ORDER BY received_at`,
				)
				.all() as Array<Record<string, unknown>>;
			for (const e of ev) {
				rows.push({
					kind: "EVENT",
					ref: e.event_type,
					status: "",
					recon: "",
					amount: "",
					fee: "",
					variance: "",
					currency: "USD",
					at: e.at,
					note: e.ref,
					payload: typeof e.payload === "string" ? e.payload : "",
				});
			}
			res.writeHead(200, {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			});
			res.end(JSON.stringify({ rows }));
			return;
		} catch (e) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(e) }));
			return;
		}
	}

	// Natural language -> ledger filter (stage 84 ★): LLM first, deterministic
	// fallback on timeout/error. Never throws — always returns a filter object.
	if (req.method === "POST" && url.split("?")[0] === "/api/nl-filter") {
		let raw = "";
		req.on("data", (chunk: Buffer) => {
			raw += chunk.toString("utf8");
			if (raw.length > 10_000) req.destroy();
		});
		req.on("end", async () => {
			const cors = { "Access-Control-Allow-Origin": "*" };
			try {
				const body = JSON.parse(raw || "{}") as { query?: unknown };
				const query = typeof body.query === "string" ? body.query.trim() : "";
				if (!query) {
					res.writeHead(400, {
						"Content-Type": "application/json",
						...cors,
					});
					res.end(JSON.stringify({ ok: false, error: "query required" }));
					return;
				}
				const result = await parseLedgerQuery(query.slice(0, 300));
				res.writeHead(200, { "Content-Type": "application/json", ...cors });
				res.end(JSON.stringify({ ok: true, ...result }));
			} catch (e) {
				res.writeHead(500, { "Content-Type": "application/json", ...cors });
				res.end(JSON.stringify({ ok: false, error: String(e) }));
			}
		});
		return;
	}

	// On-demand AI explanation of one ledger row (stage 85): why this status.
	if (req.method === "POST" && url.split("?")[0] === "/api/explain") {
		let raw = "";
		req.on("data", (chunk: Buffer) => {
			raw += chunk.toString("utf8");
			if (raw.length > 10_000) req.destroy();
		});
		req.on("end", async () => {
			const cors = { "Access-Control-Allow-Origin": "*" };
			try {
				const body = JSON.parse(raw || "{}") as {
					kind?: unknown;
					ref?: unknown;
				};
				const kind = typeof body.kind === "string" ? body.kind.trim() : "";
				const ref = typeof body.ref === "string" ? body.ref.trim() : "";
				if (!kind || !ref || (kind !== "PAYMENT" && kind !== "INVOICE")) {
					res.writeHead(400, {
						"Content-Type": "application/json",
						...cors,
					});
					res.end(
						JSON.stringify({
							ok: false,
							error: "kind (PAYMENT|INVOICE) and ref required",
						}),
					);
					return;
				}
				const result = await explainLedgerRow(kind, ref.slice(0, 120));
				if (!result) {
					res.writeHead(404, { "Content-Type": "application/json", ...cors });
					res.end(JSON.stringify({ ok: false, error: "row not found" }));
					return;
				}
				res.writeHead(200, { "Content-Type": "application/json", ...cors });
				res.end(JSON.stringify({ ok: true, ...result }));
			} catch (e) {
				res.writeHead(500, { "Content-Type": "application/json", ...cors });
				res.end(JSON.stringify({ ok: false, error: String(e) }));
			}
		});
		return;
	}

	// Row actions from the Ledger UI (stage 86): guarded PayPal call / human resolution.
	if (req.method === "POST" && url.split("?")[0] === "/api/action") {
		let raw = "";
		req.on("data", (chunk: Buffer) => {
			raw += chunk.toString("utf8");
			if (raw.length > 10_000) req.destroy();
		});
		req.on("end", async () => {
			const cors = { "Access-Control-Allow-Origin": "*" };
			try {
				const body = JSON.parse(raw || "{}") as {
					action?: unknown;
					kind?: unknown;
					ref?: unknown;
				};
				const action =
					typeof body.action === "string" ? body.action.trim() : "";
				const kind = typeof body.kind === "string" ? body.kind.trim() : "";
				const ref = typeof body.ref === "string" ? body.ref.trim() : "";
				if (!ref || (action !== "send_reminder" && action !== "mark_matched")) {
					res.writeHead(400, {
						"Content-Type": "application/json",
						...cors,
					});
					res.end(
						JSON.stringify({
							ok: false,
							error: "action (send_reminder|mark_matched) and ref required",
						}),
					);
					return;
				}
				let result: RowActionResult;
				if (action === "send_reminder" && kind === "INVOICE") {
					result = await sendRowReminder(ref.slice(0, 120));
				} else if (action === "mark_matched" && kind === "PAYMENT") {
					result = markRowMatched(ref.slice(0, 120));
				} else {
					res.writeHead(400, {
						"Content-Type": "application/json",
						...cors,
					});
					res.end(
						JSON.stringify({
							ok: false,
							error:
								"send_reminder requires kind=INVOICE; mark_matched requires kind=PAYMENT",
						}),
					);
					return;
				}
				// Guardrail refusals are 200 with ok:false (the UI shows `message`);
				// unexpected crashes surface as 500.
				res.writeHead(200, { "Content-Type": "application/json", ...cors });
				res.end(JSON.stringify(result));
			} catch (e) {
				res.writeHead(500, { "Content-Type": "application/json", ...cors });
				res.end(
					JSON.stringify({
						ok: false,
						error: e instanceof Error ? e.message.slice(0, 300) : String(e),
					}),
				);
			}
		});
		return;
	}

	// Module A UI (stage 99): run the two-agent negotiation for the demo config and,
	// when it settles, attach the validated contract JSON (the "settled" button in
	// the negotiation window reveals it).
	if (req.method === "POST" && url.split("?")[0] === "/api/negotiate") {
		const cors = { "Access-Control-Allow-Origin": "*" };
		let raw = "";
		req.on("data", (chunk: Buffer) => {
			raw += chunk.toString("utf8");
			if (raw.length > 10_000) req.destroy();
		});
		req.on("end", async () => {
			try {
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
				let contract: unknown = null;
				if (result.settled && result.agreedMinor !== undefined) {
					const transcript = result.rounds.map(
						(r) => `${r.agent.toUpperCase()}: ${r.message}`,
					);
					try {
						contract = await buildContract(result, cfg, transcript, {
							...(process.env.SANDBOX_BUYER_EMAIL
								? { buyerEmail: process.env.SANDBOX_BUYER_EMAIL }
								: {}),
						});
					} catch (e) {
						res.writeHead(200, { "Content-Type": "application/json", ...cors });
						res.end(
							JSON.stringify({
								ok: true,
								rounds: result.rounds,
								settled: false,
								reason: `contract failed: ${e instanceof Error ? e.message : String(e)}`,
							}),
						);
						return;
					}
				}
				res.writeHead(200, { "Content-Type": "application/json", ...cors });
				res.end(
					JSON.stringify({
						ok: true,
						rounds: result.rounds,
						settled: result.settled,
						agreedMinor: result.agreedMinor ?? null,
						reason: result.reason,
						contract,
					}),
				);
			} catch (e) {
				res.writeHead(500, { "Content-Type": "application/json", ...cors });
				res.end(
					JSON.stringify({
						ok: false,
						error: e instanceof Error ? e.message.slice(0, 300) : String(e),
					}),
				);
			}
		});
		return;
	}

	// Stage 104: data for the Agent screen (audit trail + agent runtime facts).
	if (req.method === "GET" && url.split("?")[0] === "/api/agent-summary") {
		try {
			const db = getDb();
			const actions = db
				.prepare(
					`SELECT id, action, limit_check, target_ref, executed, executed_at, llm_decision
           FROM agent_actions ORDER BY id DESC LIMIT 20`,
				)
				.all() as Array<Record<string, unknown>>;
			const totals = db
				.prepare(
					`SELECT COUNT(*) total,
              SUM(CASE WHEN limit_check='BLOCKED' THEN 1 ELSE 0 END) blocked,
              SUM(CASE WHEN executed=1 THEN 1 ELSE 0 END) executed
       FROM agent_actions`,
				)
				.get() as {
				total: number;
				blocked: number | null;
				executed: number | null;
			};
			res.writeHead(200, {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			});
			res.end(
				JSON.stringify({
					ok: true,
					actions,
					totals: {
						total: totals.total,
						blocked: totals.blocked ?? 0,
						executed: totals.executed ?? 0,
					},
					llm: {
						provider: (process.env.LLM_PROVIDER ?? "gemini").toLowerCase(),
						model:
							process.env.LLM_MODEL ||
							((process.env.LLM_PROVIDER ?? "gemini").toLowerCase() === "gemini"
								? "gemini-3.5-flash-lite"
								: "llama-3.3-70b-versatile"),
					},
				}),
			);
			return;
		} catch (e) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: false, error: String(e) }));
			return;
		}
	}

	// Stage 104: configuration view for the Settings screen (facts only, no secrets).
	if (req.method === "GET" && url.split("?")[0] === "/api/app-config") {
		res.writeHead(200, {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		});
		res.end(
			JSON.stringify({
				ok: true,
				mode: "sandbox",
				llm: {
					provider: (process.env.LLM_PROVIDER ?? "gemini").toLowerCase(),
					model: process.env.LLM_MODEL || "gemini-3.5-flash-lite",
					fallback: "deterministic rule-based parser (on timeout/error)",
				},
				limits: {
					create_invoice_usd: 500,
					reminders_per_24h: 1,
					reminders_lifetime: 3,
					negotiation_max_rounds: 10,
					nl_deadline_ms: 14_000,
				},
				defaults: { payment_days: 7 },
				source: "env + code constants (.env.local / SECURITY rules)",
			}),
		);
		return;
	}

	// Stage 119: reconcile whatever the webhooks delivered — INCREMENTAL (only
	// unreconciled COMPLETED payments), so repeated calls are effectively no-ops.
	// This is how "звірити" runs on the public URL of the production service.
	if (req.method === "POST" && url.split("?")[0] === "/api/recon/run") {
		const cors = { "Access-Control-Allow-Origin": "*" };
		req.on("data", () => undefined);
		req.on("end", async () => {
			try {
				const tools = createPaypalToolkit().getTools();
				const outcomes = await reconcilePending(tools, getDb());
				res.writeHead(200, { "Content-Type": "application/json", ...cors });
				res.end(
					JSON.stringify({
						ok: true,
						reconciled: outcomes.length,
						outcomes: outcomes.map((o) => ({
							status: o.status,
							match_method: o.matchMethod ?? null,
							variance_minor: o.varianceMinor,
						})),
					}),
				);
			} catch (e) {
				res.writeHead(500, { "Content-Type": "application/json", ...cors });
				res.end(
					JSON.stringify({
						ok: false,
						error: e instanceof Error ? e.message.slice(0, 300) : String(e),
					}),
				);
			}
		});
		return;
	}

	res.writeHead(200, { "Content-Type": "text/plain" });
	res.end(
		"PayPal Reconciliation Agent — under active development. See README.md\n",
	);
});

server.listen(PORT, () => {
	console.log(`[server] listening on http://localhost:${PORT}`);
});

// Graceful shutdown (Render sends SIGTERM on deploy)
for (const sig of ["SIGTERM", "SIGINT"] as const) {
	process.on(sig, () => {
		console.log(`[server] ${sig} received, closing...`);
		server.close(() => process.exit(0));
	});
}
