/**
 * Minimal HTTP server skeleton (stage 32).
 * Zero runtime dependencies: node:http only.
 * Routes: GET /health -> 200 (marker for stage 32), GET / -> app stub.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  const url = req.url ?? "/";

  if (url.startsWith("/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "paypal-reconciliation-agent" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("PayPal Reconciliation Agent — under active development. See README.md\n");
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
