/**
 * Minimal HTTP server skeleton (stage 32).
 * Zero runtime dependencies: node:http only.
 * Routes: GET /health -> 200 (marker for stage 32), GET / -> app stub.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import {
	getDb,
	insertPaymentFromEvent,
	insertPaymentFromInvoiceEvent,
	insertWebhookEvent,
} from "./db.ts";
import { parseLedgerQuery } from "./nl.ts";

mkdirSync("logs", { recursive: true });

const PORT = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
	const url = req.url ?? "/";

	if (url.startsWith("/health")) {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({ status: "ok", service: "paypal-reconciliation-agent" }),
		);
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
	if (req.method === "GET" && url.split("?")[0] === "/api/recon/rows") {
		try {
			const rows: Array<Record<string, unknown>> = [];
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
						p.net_minor != null
							? (Number(p.net_minor) / 100).toFixed(2)
							: "",
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
				const query =
					typeof body.query === "string" ? body.query.trim() : "";
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
