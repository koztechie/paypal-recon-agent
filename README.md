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
