# Evidence — stage 35 (local dev server on weak machine)

Date: 2026-10-27 (UTC+3 evening)
Machine: AMD A4 class, 6880 MB RAM total (2619 MB available at test time)

## Marker 1: curl localhost:3000/health
- Response: {"status":"ok","service":"paypal-reconciliation-agent"} -> HTTP 200  PASS

## Marker 2: RAM within limits
- Command: npm run dev (node --watch src/server.ts)
- dev-process RSS: 3 MB (limit <300 MB)  PASS
- System: 2619 of 6880 MB available during test

## Extra: auto-reload (node --watch) verified
- touch src/server.ts -> watcher restarted server (log: "SIGTERM received, closing..."
  followed by "listening on http://localhost:3000")  PASS

## Cleanup
- All dev processes stopped; port 3000 free after test.
- Incident note: pkill -f with patterns appearing literally in the killer's own
  command line caused self-SIGTERM twice; fixed by splitting cleanup/launch into
  separate calls with concatenated patterns. Recorded to avoid re-occurring.
