# PayPal Reconciliation Agent

Cross-border reconciliation agent for small merchants and freelancers: an AI
agent that classifies incoming PayPal payments, reconciles them against
invoices, drafts reminders, and reports discrepancies — with hard guardrails
(human approval for irreversible actions, full action logging).

> **Status: under active development** for the
> [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/) (deadline
> Nov 12, 2026). Setup instructions will be completed before submission.

## Stack

- TypeScript + Node.js backend
- [PayPal Agent Toolkit](https://github.com/paypal/agent-toolkit) (sandbox)
- Gemini API (agent LLM layer, provider-agnostic via env vars)
- AG Studio grid frontend (planned)
- SQLite storage

## Security

See [SECURITY.md](./SECURITY.md) — agent guardrails: amount limits,
human approval for irreversible actions, full action logging, rate limits,
secrets isolation.

## License

[MIT](./LICENSE)
