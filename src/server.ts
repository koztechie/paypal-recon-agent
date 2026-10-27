/**
 * Minimal HTTP server skeleton (stage 32).
 * Zero runtime dependencies: node:http only.
 * Routes: GET /health -> 200 (marker for stage 32), GET / -> app stub.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";

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

	// PayPal webhook listener (stages 37-38). Always 200 on parseable receipt:
	// PayPal retries non-2xx. Raw payload stored as NDJSON (webhook_events
	// table wiring comes at stages 44/49).
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
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ received: true }));
			} catch {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "invalid JSON" }));
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
