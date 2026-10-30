# Evidence — stage 125 ★ (phase criterion: demo via TWO paths — URL + locally)

Date: 2026-10-30 (plan date 09.11 — early)

## Marker: both paths pass cleanly — PASS

### Path A — hosted URL (judge opens `https://paypal-recon-agent.onrender.com/`)
Playwright judge-simulation (`stage125-url.js`), screenshot
`2026-10-30-stage125-url-path.png`:

| Check | Result |
|---|---|
| hosted URL serves the demo page | OK |
| health chip shows OK (live `/health` probe from the page) | OK |
| row-count chip resolves (live `?count=1`) | OK (`ledger rows: 0` — see re-seed note) |
| AI answer: plain-English question → filter JSON | OK — `{"kind":"PAYMENT","recon":"MATCHED","amountMin":40}` |
| source + latency shown | OK — `source: llm · 1.2s` |
| **MARKER_URL_PATH** | **PASS (5/5)** |

What the page is: a self-contained mini demo on the service root (`GET /`), no
external assets — health + ledger chips, an "Ask in plain English" form hitting the
same `/api/nl-filter` AI layer the product uses, links to `/health`,
`/api/app-config`, `?count=1`.

### Path B — locally (README, stage 123 evidence)
Both fresh-clone runs of the 3-command quick start passed and are already recorded in
`2026-10-30-stage123-readme.md`:
- local clone, zero keys → `npm run demo` → **exit 0, 29.1 s, PROVEN (simulated)**;
- clone from the **public GitHub URL** (commit `f0833d3`) → same → **exit 0, 29.0 s**.

### Defects found while proving path A (fixed at root, honest log)
1. The embedded page script initially contained a **real newline** inside a JS string:
   the TS *template literal* interprets `\n` (raw-Python quoting protected the source
   from Python, not from TypeScript) → `Invalid or unexpected token`, form dead.
   Fixed with a single-line separator; verified with `node --check` on the SERVED
   script before pushing.
2. `ledger rows: 0` on the chip — the prod ledger is empty because every push
   re-deploys the instance on a fresh ephemeral DB (documented in stage 119).
   **Operational rule:** run one E2E re-seed cycle at the end of the hosting phase
   and before any judge-facing moment (the inline cycle from stages 119/120 takes
   ~3 min); pushes after that wipe it again.
