# PayPal Reconciliation Agent

Cross-border reconciliation agent for small merchants and freelancers: an AI
agent that classifies incoming PayPal payments, reconciles them against
invoices, drafts reminders, explains mismatches, and acts — with hard
guardrails (amount limits, rate limits, human approval for irreversible
actions, full action logging).

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/)
(deadline Nov 12, 2026).

## Quick start — 3 commands on a fresh machine

```bash
git clone https://github.com/koztechie/paypal-recon-agent.git
cd paypal-recon-agent && npm install && cp .env.example .env.local
npm run demo
```

**No keys, no side effects:** the demo runs the full story end-to-end —
two LLM agents negotiate a price → contract JSON → invoice → payment →
confirmations to **both** agents — in **dry-run mode** (~30 s), ending with
`PROVEN (simulated: dry-run mode)`. Money actions are intercepted and logged to
`logs/dryrun.ndjson`; with an unfilled `LLM_API_KEY` the negotiation uses its
built-in deterministic fallback.

**Want the real thing?** Fill `.env.local` (PayPal sandbox credentials from
<https://developer.paypal.com/developer/applications/> + a Gemini `LLM_API_KEY`),
set `DRY_RUN='false'` — the same `npm run demo` then runs the **real sandbox cycle**
(create → send → pay → reconcile), and the web UI becomes fully populated.

**Requirements:** Node ≥ 22.18 (`engines`), npm.

## Run the web UI (optional, for the interactive demo)

```bash
npm run dev          # agent API on :3000
cd web && npm install && npm run start   # UI on http://localhost:3001
```

Open <http://localhost:3001> — homepage → **Open the Ledger** (live grid with
filters, AI explanations, row actions, NL queries), **Negotiation demo** window,
**Agent** audit trail, **Settings**.

## Hosted service (no install)

- Health: <https://paypal-recon-agent.onrender.com/health> → `200`
  (free instance sleeps — the first hit may take ~50 s).
- Public API: `/api/nl-filter` (ask in plain English), `/api/explain` (row
  explanations), `/api/recon/run` (incremental reconciliation), `/api/app-config`
  (runtime config, no secrets).
- Logs: Render dashboard → **Logs** tab; locally `logs/webhooks.ndjson` and friends.

## Troubleshooting — 5 common startup errors

**1. Server won't answer: `curl localhost:3000/health` → `000` / `EADDRINUSE`.**
The dev process died (a `--watch` crash prints the reason above the shell) or
another process holds the port.
*Fix:* look at the `npm run dev` output for the stack trace; then free the port and
restart:
```bash
lsof -ti :3000 | xargs -r kill     # Windows: netstat -ano | findstr :3000
npm run dev                        # expect: [server] listening on http://localhost:3000
```

**2. Local webhook events never arrive; the tunnel page shows `ERR_NGROK_3200
(endpoint is offline)`.**
The ngrok process died — PayPal's sandbox events are lost for local development
(the hosted service is unaffected).
*Fix:* restart the tunnel and verify it answers, then re-trigger your event:
```bash
ngrok start ecwid-dev
curl -s -o /dev/null -w "%{http_code}\n" https://<your-subdomain>.ngrok-free.dev/health   # expect 200
```

**3. Hosted service looks dead on first contact (Render free plan).**
Symptoms: the first request takes up to ~50 s or returns an empty body, and the
Logs tab starts with `.env.local not found. Continuing without it.`
*Fix:* none needed — the instance sleeps with inactivity (warm it with one request:
open `https://paypal-recon-agent.onrender.com/health`), and the `.env.local` line is
**benign by design** — on Render the secrets come from Environment variables, and the
start script deliberately skips a missing local file.

**4. `PAYPAL_CLIENT_ID is missing (see .env.example)` (or PayPal auth fails silently).**
The `.env.local` file is absent, still has `REPLACE…` placeholders, or values were
copied **together with the surrounding single quotes** (quotes belong to the file
syntax only — pasted into Render/other tools they break auth without a clear error).
*Fix:* `cp .env.example .env.local`, paste each value **between** the quotes, restart.
Remember `DRY_RUN='true'` runs everything without credentials at all.

**5. An answer is slow or says `via fallback` instead of `via llm`.**
The Gemini free tier is queued at peak times; the product treats the LLM as optional:
NL queries, explanations and negotiation all fall back to deterministic rules after
~14 s, so nothing ever blocks — the UI labels the source (`via fallback · …`).
*Fix:* retry in a quieter minute, or probe current latency in one command:
```bash
node scripts/stage71-probe.mjs     # prints per-action ms + median (needs LLM_API_KEY)
```

## Stack

- TypeScript + Node.js backend (zero runtime deps beyond the PayPal toolkit)
- [PayPal Agent Toolkit](https://github.com/paypal/agent-toolkit) (sandbox)
- Gemini API (agent LLM layer, provider-agnostic via env vars; deterministic
  fallbacks everywhere — a slow/absent LLM never blocks the product)
- React + AG Grid / AG Studio frontend (`web/`)
- SQLite storage (`node:sqlite`), Render hosting

## Security

See [SECURITY.md](./SECURITY.md) — agent guardrails: amount limits,
human approval for irreversible actions, full action logging, rate limits,
secrets isolation (`.env.local` is git-ignored; never committed — verified
against the full git history).

## License

[MIT](./LICENSE)
