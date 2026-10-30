# Evidence — stage 121 (security: no secrets in repo, .env ignored, history scanned)

Date: 2026-10-30 (plan date 09.11 — early)

## Marker: repo grep → 0 key matches — PASS (9/9 checks green)

Method: real values were read from the local `.env.local` **inside the audit
process only** — the script prints counts/locations, never the values themselves.

| # | Check | Method | Result |
|---|---|---|---|
| 1 | No tracked `.env` files | `git ls-files \| grep -iE '(^\|/)\.env($\|\.)'` | only `.env.example` (template) ✓ |
| 2 | `.env` ignored | `git check-ignore -v` | `.gitignore:3: .env.local` (root) and `web/.gitignore:34: .env*` (web) ✓ |
| 3 | Real values in the tracked tree | `git grep -F <value>` for PAYPAL_CLIENT_ID/SECRET, LLM_API_KEY | **0 matches** ✓ |
| 4 | Real values in **full git history** | `git log --all -S <value>` (pickaxe) per secret | **0 matches** ✓ |
| 5 | Generic key shapes (tree + history) | `AIza…` (Gemini), `client_secret=…`, `Bearer eyJ…` via `git grep -E` + `git log -G` | **0 / 0** ✓ |
| 6 | Workspace documents (PLAN/DECISIONS/evidence — outside git but on disk) | `grep -F` of the real values across `/mnt/data/PayPal AI Hackathon` | **0 matches** ✓ |
| 7 | Runtime logs not tracked | `git ls-files \| grep '^logs/'` | none ✓ |
| 8 | Sandbox **passwords** (supplement: they are secrets too) | tree/history/docs grep of SANDBOX_BUSINESS_PASSWORD + SANDBOX_BUYER_PASSWORD | **0 / 0 / 0** ✓ |
| 9 | `.env.example` contains placeholders only | filtered scan for non-placeholder assignments | only harmless defaults (SANDBOX, `sb-...@…` example emails, gemini model, port) ✓ |

## Notes
- Credentials live only in: local `.env.local` (ignored), Render Environment
  (masked dashboard values), and the PayPal/GitHub accounts themselves.
- The audit is repeatable: the script pattern above (values loaded in-process,
  counts printed) can be re-run any time — before each release is a good habit.
