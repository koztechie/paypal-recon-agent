# Evidence — stage 124 (Troubleshooting section: 5 common startup errors)

Date: 2026-10-30 (plan date 09.11 — early)

## Marker: 5 typical errors in the README — PASS (programmatic count = 5)

README section `## Troubleshooting — 5 common startup errors`, each entry =
exact symptom text → why → exact fix commands:

| # | Error (as it appears) | Root cause in OUR history | Fix given |
|---|---|---|---|
| 1 | `curl localhost:3000/health → 000` / `EADDRINUSE` | dead `--watch` process (stage-103 incident: :3000 silently gone) or port held | read the crash output, `lsof -ti :3000 \| xargs -r kill`, `npm run dev`, expect `[server] listening` |
| 2 | `ERR_NGROK_3200 (endpoint is offline)`, local webhook events lost | ngrok died TWICE (stage-97 discovery + repeat mid-session) | `ngrok start ecwid-dev` + verify `/health` → 200 |
| 3 | Hosted service empty/slow on first hit + `.env.local not found. Continuing without it.` | Render free cold start ~50 s (stage-119 poll returned EMPTY) + benign line from `--env-file-if-exists` (stage-122) | warm via `/health`; the line is by-design (secrets live in Environment) |
| 4 | `PAYPAL_CLIENT_ID is missing (see .env.example)` / silent PayPal auth failure | missing/placeholder env; **the quote trap** (values in `.env.local` are single-quoted — pasting quotes into another tool breaks auth silently; the stage-116 deploy-screen lesson) | copy between the quotes; `DRY_RUN='true'` runs keyless |
| 5 | Slow answers / status shows `via fallback` instead of `via llm` | free-tier LLM queue (stage-71:17.6 s median at peak) — product designed to fall back after ~14 s | retry later, or `node scripts/stage71-probe.mjs` to measure |

## Verification
```python
re.match(r'^\*\*[1-5]\. ', line) over README.md -> count: 5   # PASS
```
Section placement: after «Hosted service», before «Stack» (judges hit it right after
the run instructions).

All entries are drawn from REAL incidents recorded in evidence (stages 71, 97, 103,
119, 122) — no invented symptoms.
