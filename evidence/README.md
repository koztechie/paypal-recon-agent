# evidence/ — audit trail of the submission

Everything a judge may want to verify links back to a file in this directory:
per-stage reports (markers + raw results), screenshots, video artifacts, QA JSON
and the rerunnable montage script. **145 files, ~28 MB.**

**Transparency guarantees (re-checked for this index):**
- **Secrets: 0 matches** — scanned all md/json/py/srt files for token/key
  patterns (GitHub PATs, `sk-`/`AIza` keys, `Bearer` values, filled env secrets).
- Screenshots and video are the *published* artifacts (the video was even re-audited
  from YouTube's own bytes — see stage 135).
- Every claim in the repo README maps to a numbered report below.

## Screenshots (`screenshots/`)
| File | What |
|---|---|
| `screenshots/2026-10-31-readme-01-home.png` | Home — hero, CTA, Explore cards |
| `screenshots/2026-10-31-readme-02-ledger-ai.png` | Ledger + AI insight (`via llm · 0.7s`) |
| `screenshots/2026-10-31-readme-03-negotiation.png` | Negotiation settled + contract |
| `screenshots/2026-10-31-readme-04-agent.png` | Audit trail (executed / blocked) |
| `screenshots/2026-10-31-readme-05-hosted.png` | Hosted demo with live AI answer |
| `screenshots/01-home.png` / `screenshots/02-ledger-ai-detail.png` / `screenshots/03-negotiation-settled.png` | Stage-113 originals (pre-polish, kept as history) |

## Video artifacts
| File | What |
|---|---|
| `2026-10-30-stage132-demo-final.mp4` | **The final demo (1:41, burned EN subs)** — same content as the YouTube upload |
| `2026-10-30-stage132-montage-script.py` | Rerunnable assembly (audio-driven, VO = master clock) |
| `2026-10-30-stage129-1-problem.mp4` | Block A clip 1 — the problem |
| `2026-10-30-stage129-2-product-start.mp4` | Block A clip 2 — hero → ledger → agent → settings |
| `2026-10-30-stage130-e2e-onetake.mp4` | E2E console cycle, one take |
| `2026-10-30-stage131-ai-moment.mp4` | AI moment: negotiation rounds → invoice → PayPal checks |
| `2026-10-30-stage100-module-a-demo.mp4` | Module A demo take |
| `2026-10-28-stage73-ai-loop.mp4` / `2026-10-28-stage56-zero-touch.mp4` | Earlier AI-loop / zero-touch takes |
| `subs/2026-10-30-stage132-demo-final-en.srt` | Standalone subtitles (also burned in) |
| `2026-10-31-vid2-raw/` | Committed raw screen recordings (montage rerunnability): `2026-10-31-vid2-raw/negotiation.webm`, `2026-10-31-vid2-raw/ai-panel.webm`, `2026-10-31-vid2-raw/hosted.webm`, `2026-10-31-vid2-raw/filters.webm`, `2026-10-31-vid2-raw/outro.webm`, `2026-10-31-vid2-raw/clip1-raw.webm`, `2026-10-31-vid2-raw/clip2-raw.webm` |

## Stage reports (97 files, chronological per stage)
| Stage | Report | Title |
|---|---|---|
| 25 | [2026-10-27-stage25-26-sandbox.md](2026-10-27-stage25-26-sandbox.md) | Evidence — stages 25–26 (PayPal sandbox credentials + token test) |
| 28 | [2026-10-27-stage28-llm-test.md](2026-10-27-stage28-llm-test.md) | Evidence — stage 28 (AI API key live test) |
| 29 | [2026-10-27-stage29-repo-draft.md](2026-10-27-stage29-repo-draft.md) | Evidence — stage 29 (repo + Devpost draft) |
| 33 | [2026-10-27-stage33-ci.md](2026-10-27-stage33-ci.md) | Evidence — stage 33 (CI green) |
| 35 | [2026-10-27-stage35-devserver.md](2026-10-27-stage35-devserver.md) | Evidence — stage 35 (local dev server on weak machine) |
| 36 | [2026-10-27-stage36-tunnel.md](2026-10-27-stage36-tunnel.md) | Evidence — stage 36 (webhook tunnel) |
| 37 | [2026-10-27-stage37-ci-fix.md](2026-10-27-stage37-ci-fix.md) | Evidence — stage 37 addendum: CI fix |
| 37 | [2026-10-27-stage37-webhook.md](2026-10-27-stage37-webhook.md) | Evidence — stage 37 (webhook registered in sandbox) |
| 38 | [2026-10-27-stage38-webhook.md](2026-10-27-stage38-webhook.md) | Evidence — stage 38 ★ (first webhook received locally) |
| 39 | [2026-10-28-stage39-toolkit.md](2026-10-28-stage39-toolkit.md) | Evidence — stage 39 ★ (Agent Toolkit + APIMatic plugin) |
| 40 | [2026-10-28-stage40-invoice.md](2026-10-28-stage40-invoice.md) | Evidence — stage 40 (draft invoice via Agent Toolkit) |
| 41 | [2026-10-28-stage41-send.md](2026-10-28-stage41-send.md) | Evidence — stage 41 (send_invoice -> SENT) |
| 42 | [2026-10-28-stage42-77-events-killswitch.md](2026-10-28-stage42-77-events-killswitch.md) | Evidence — stage 42 (auto-reminder event finally arrived) + stage 77 ★ |
| 42 | [2026-10-28-stage42-reminder.md](2026-10-28-stage42-reminder.md) | Evidence — stage 42 (reminders) — PARTIAL: action done, event pending |
| 43 | [2026-10-28-stage43-payment-pending.md](2026-10-28-stage43-payment-pending.md) | Evidence — stage 43 (buyer pays invoice) — IN PROGRESS |
| 44 | [2026-10-28-stage44-payments-db.md](2026-10-28-stage44-payments-db.md) | Evidence — stage 44 (PAYMENT.CAPTURE.COMPLETED -> SQLite payments row) |
| 45 | [2026-10-28-stage45-record.md](2026-10-28-stage45-record.md) | Evidence — stage 45 (recordPayment; refund stays blocked) |
| 46 | [2026-10-28-stage46-datamodel.md](2026-10-28-stage46-datamodel.md) | Evidence — stage 46 (data model: tables + 21/21 QA) |
| 47 | [2026-10-28-stage47-reconciliation.md](2026-10-28-stage47-reconciliation.md) | Evidence — stage 47 ★ (auto-reconciliation 5/5) |
| 48 | [2026-10-28-stage48-edge-cases.md](2026-10-28-stage48-edge-cases.md) | Evidence — stage 48 (discrepancy edge cases: 8/8) |
| 49 | [2026-10-28-stage49-events-journal.md](2026-10-28-stage49-events-journal.md) | Evidence — stage 49 (events journal: raw storage + dedupe) |
| 50 | [2026-10-28-stage50-dryrun.md](2026-10-28-stage50-dryrun.md) | Evidence — stage 50 (dry-run: zero real effects) |
| 51 | [2026-10-28-stage51-e2e1.md](2026-10-28-stage51-e2e1.md) | Evidence — stage 51 ★ (E2E №1: create -> send -> pay -> reconcile) |
| 52 | [2026-10-28-stage52-e2e2.md](2026-10-28-stage52-e2e2.md) | Evidence — stage 52 (E2E №2: remind -> pay -> reconcile) |
| 53 | [2026-10-28-stage53-e2e3.md](2026-10-28-stage53-e2e3.md) | Evidence — stage 53 (E2E №3: partial -> discrepancy -> manual resolution) |
| 54 | [2026-10-28-stage54-logging.md](2026-10-28-stage54-logging.md) | Evidence — stage 54 (logging: timestamped actions + 24h log without gaps) |
| 55 | [2026-10-28-stage55-retries.md](2026-10-28-stage55-retries.md) | Evidence — stage 55 (API errors: retries, clear messages, no state loss) |
| 56 | [2026-10-28-stage56-criterion.md](2026-10-28-stage56-criterion.md) | Evidence — stage 56 ★ (phase criterion: zero-touch PayPal core + video proof) |
| 59 | [2026-10-28-stage59-llm.md](2026-10-28-stage59-llm.md) | Evidence — stage 59 ★ (LLM abstraction layer) |
| 60 | [2026-10-28-stage60-prompt.md](2026-10-28-stage60-prompt.md) | Evidence — stage 60 (agent system prompt: versioned file + effective) |
| 61 | [2026-10-28-stage61-function-calling.md](2026-10-28-stage61-function-calling.md) | Evidence — stage 61 ★ (function calling: LLM sees & selects PayPal tools) |
| 62 | [2026-10-28-stage62-classify.md](2026-10-28-stage62-classify.md) | Evidence — stage 62 (agent action #1: payment classification 10/10) |
| 63 | [2026-10-28-stage63-llm-explain.md](2026-10-28-stage63-llm-explain.md) | Evidence — stage 63 (agent action #2: reconcile + LLM explanation) |
| 64 | [2026-10-28-stage64-reminder-limit.md](2026-10-28-stage64-reminder-limit.md) | Evidence — stage 64 (agent action #3: reminder with frequency limit) |
| 65 | [2026-10-28-stage65-ai-chain.md](2026-10-28-stage65-ai-chain.md) | Evidence — stage 65 ★ (AI -> PayPal real chain: LLM decides, tool executes) |
| 66 | [2026-10-28-stage66-daily-report.md](2026-10-28-stage66-daily-report.md) | Evidence — stage 66 (agent action #4: daily summary from a day of data) |
| 67 | [2026-10-28-stage67-action5.md](2026-10-28-stage67-action5.md) | Evidence — stage 67 (agent action #5 for core C: tax/marketplace report) |
| 68 | [2026-10-28-stage68-guards.md](2026-10-28-stage68-guards.md) | Evidence — stage 68 ★ (guards: amount limit, refund ban, decision log) |
| 69 | [2026-10-28-stage69-prompt-attacks.md](2026-10-28-stage69-prompt-attacks.md) | Evidence — stage 69 (guardrail test: 3 attack prompts repelled) |
| 70 | [2026-10-28-stage70-stability.md](2026-10-28-stage70-stability.md) | Evidence — stage 70 (stability: 10 repeats, identical statuses) |
| 71 | [2026-10-28-stage71-latency.md](2026-10-28-stage71-latency.md) | Evidence — stage 71 (agent action latency) — PENDING official measurement |
| 71 | [2026-10-29-stage71-latency.md](2026-10-29-stage71-latency.md) | Evidence — stage 71 (agent action speed: < 10 s per action for the demo) |
| 72 | [2026-10-28-stage72-fallback.md](2026-10-28-stage72-fallback.md) | Evidence — stage 72 (LLM API down -> local rules, no LLM) |
| 73 | [2026-10-28-stage73-r2-criterion.md](2026-10-28-stage73-r2-criterion.md) | Evidence — stage 73 ★ (phase criterion R2: AI substantively in the loop) |
| 79 | [2026-10-28-stage79-ag-studio.md](2026-10-28-stage79-ag-studio.md) | Evidence — stage 79 ★ (AG Studio + boilerplate) |
| 80 | [2026-10-28-stage80-ledger-grid.md](2026-10-28-stage80-ledger-grid.md) | Evidence — stage 80 (grid data from OUR DB via REST) |
| 81 | [2026-10-28-stage81-filters-sort.md](2026-10-28-stage81-filters-sort.md) | Evidence — stage 81 (column filters + sorting) |
| 82 | [2026-10-28-stage82-detail-row.md](2026-10-28-stage82-detail-row.md) | Evidence — stage 82 (detail row: click → invoice/payment details) |
| 83 | [2026-10-28-stage83-status-colors.md](2026-10-28-stage83-status-colors.md) | Evidence — stage 83 (reconciliation status column: MATCHED / UNMATCHED / REVIEW, coloured) |
| 84 | [2026-10-28-stage84-nl-query-grid.md](2026-10-28-stage84-nl-query-grid.md) | Evidence — stage 84 ★ (natural-language query -> grid filters) |
| 85 | [2026-10-29-stage85-ai-explain.md](2026-10-29-stage85-ai-explain.md) | Evidence — stage 85 (AI explanation of the selected row: why UNMATCHED) |
| 86 | [2026-10-29-stage86-row-actions.md](2026-10-29-stage86-row-actions.md) | Evidence — stage 86 (row actions: send reminder / mark matched -> PayPal call) |
| 87 | [2026-10-29-stage87-csv-export.md](2026-10-29-stage87-csv-export.md) | Evidence — stage 87 (CSV export, AG Grid community) |
| 88 | [2026-10-29-stage88-ui-states.md](2026-10-29-stage88-ui-states.md) | Evidence — stage 88 (3 UI states: empty, loading, API error) |
| 89 | [2026-10-29-stage89-performance.md](2026-10-29-stage89-performance.md) | Evidence — stage 89 (performance: 1000 rows without freezes) |
| 90 | [2026-10-29-stage90-responsive-1280.md](2026-10-29-stage90-responsive-1280.md) | Evidence — stage 90 (judge-screen responsiveness: 1280px, no horizontal scroll) |
| 91 | [2026-10-29-stage91-phase-criterion.md](2026-10-29-stage91-phase-criterion.md) | Evidence — stage 91 ★ (phase criterion: the grid is a working seller's tool) |
| 94 | [2026-10-29-stage94-negotiation.md](2026-10-29-stage94-negotiation.md) | Evidence — stage 94 (two LLM agents with roles: buyer budget / seller floor) |
| 95 | [2026-10-29-stage95-contract.md](2026-10-29-stage95-contract.md) | Evidence — stage 95 (settled agreement -> contract JSON, validator gate) |
| 96 | [2026-10-29-stage96-invoice-from-contract.md](2026-10-29-stage96-invoice-from-contract.md) | Evidence — stage 96 ★ (agreement -> invoices.create through the core shell) |
| 97 | [2026-10-29-stage97-confirmations.md](2026-10-29-stage97-confirmations.md) | Evidence — stage 97 (payment + confirmation for BOTH agents) |
| 98 | [2026-10-29-stage98-limits.md](2026-10-29-stage98-limits.md) | Evidence — stage 98 (limits: no action without agreement, max 10 rounds) |
| 99 | [2026-10-29-stage99-negotiation-window.md](2026-10-29-stage99-negotiation-window.md) | Evidence — stage 99 (UI minimum: negotiation window, 2 columns + "settled" button) |
| 100 | [2026-10-30-stage100-module-a-demo.md](2026-10-30-stage100-module-a-demo.md) | Evidence — stage 100 ★ (phase criterion: "two agents pay each other", 45 s video) |
| 103 | [2026-10-30-stage103-homepage.md](2026-10-30-stage103-homepage.md) | Evidence — stage 103 ★ (homepage: what the judge sees in 5 s) |
| 104 | [2026-10-30-stage104-navigation.md](2026-10-30-stage104-navigation.md) | Evidence — stage 104 (navigation: Dashboard / Agent / Settings — 3 screens) |
| 105 | [2026-10-30-stage105-empty-first-run.md](2026-10-30-stage105-empty-first-run.md) | Evidence — stage 105 (first-run empty states: what to do with no data) |
| 106 | [2026-10-30-stage106-style-consistency.md](2026-10-30-stage106-style-consistency.md) | Evidence — stage 106 (style consistency: colours, spacing, fonts) |
| 107 | [2026-10-30-stage107-a11y.md](2026-10-30-stage107-a11y.md) | Evidence — stage 107 (accessibility auto-audit: axe — 0 critical) |
| 108 | [2026-10-30-stage108-user-errors.md](2026-10-30-stage108-user-errors.md) | Evidence — stage 108 (user errors: invalid input, repeated submits) |
| 109 | [2026-10-30-stage109-lighthouse.md](2026-10-30-stage109-lighthouse.md) | Evidence — stage 109 (first-render speed on a weak PC: Lighthouse ≥ 80) |
| 110 | [2026-10-30-stage110-meta.md](2026-10-30-stage110-meta.md) | Evidence — stage 110 (favicon, title, meta description) |
| 111 | [2026-10-30-stage111-cold-test.md](2026-10-30-stage111-cold-test.md) | Evidence — stage 111 ★ (cold test #1: new browser → URL → result, no hints) |
| 112 | [2026-10-30-stage112-fix-list.md](2026-10-30-stage112-fix-list.md) | Evidence — stage 112 (fix everything from the cold test) |
| 113 | [2026-10-30-stage113-cohesive-product.md](2026-10-30-stage113-cohesive-product.md) | Evidence — stage 113 ★ (phase criterion: a cohesive product, not a PoC) |
| 115 | [2026-10-30-stage115-render-setup.md](2026-10-30-stage115-render-setup.md) | Evidence — stage 115 ★ (Render service from repo + $50 credits) |
| 118 | [2026-10-30-stage118-webhook-prod.md](2026-10-30-stage118-webhook-prod.md) | Evidence — stage 118 (PayPal webhooks → production URL) |
| 119 | [2026-10-30-stage119-prod-e2e.md](2026-10-30-stage119-prod-e2e.md) | Evidence — stage 119 ★ (prod E2E: create → pay → reconcile on the public URL) |
| 120 | [2026-10-30-stage120-ai-on-prod.md](2026-10-30-stage120-ai-on-prod.md) | Evidence — stage 120 (AI chain on production: AI action on the public URL) |
| 121 | [2026-10-30-stage121-security-audit.md](2026-10-30-stage121-security-audit.md) | Evidence — stage 121 (security: no secrets in repo, .env ignored, history scanned) |
| 122 | [2026-10-30-stage122-logs.md](2026-10-30-stage122-logs.md) | Evidence — stage 122 (service logs available for judge-side diagnosis) |
| 123 | [2026-10-30-stage123-readme.md](2026-10-30-stage123-readme.md) | Evidence — stage 123 ★ (README: 3 commands from clone to demo — R6) |
| 124 | [2026-10-30-stage124-troubleshooting.md](2026-10-30-stage124-troubleshooting.md) | Evidence — stage 124 (Troubleshooting section: 5 common startup errors) |
| 125 | [2026-10-30-stage125-two-paths.md](2026-10-30-stage125-two-paths.md) | Evidence — stage 125 ★ (phase criterion: demo via TWO paths — URL + locally) |
| 128 | [2026-10-30-stage128-rehearsal.md](2026-10-30-stage128-rehearsal.md) | Evidence — stage 128 (rehearsal: scenario dry run, timed, <3 min) |
| 129 | [2026-10-30-stage129-recording.md](2026-10-30-stage129-recording.md) | Evidence — stage 129 (screen recording: problem + product start) |
| 130 | [2026-10-30-stage130-onetake.md](2026-10-30-stage130-onetake.md) | Evidence — stage 130 (E2E demo recorded in ONE take, no splicing) |
| 131 | [2026-10-30-stage131-ai-moment.md](2026-10-30-stage131-ai-moment.md) | Evidence — stage 131 (the AI moment: LLM decides → PayPal acts, visible on screen) |
| 132 | [2026-10-30-stage132-montage.md](2026-10-30-stage132-montage.md) | Evidence — stage 132 (minimal montage: pause trimming + English subtitles) |
| 133 | [2026-10-30-stage133-copyright-audit.md](2026-10-30-stage133-copyright-audit.md) | Evidence — stage 133 (R5: no foreign tracks/logos — audio own, logos own) |
| 134 | [2026-10-31-stage134-youtube.md](2026-10-31-stage134-youtube.md) | Evidence — stage 134 ★ (YouTube upload) + 136 (thumbnail & title) |
| 135 | [2026-10-31-stage135-r5-checklist.md](2026-10-31-stage135-r5-checklist.md) | Evidence — stage 135: R5 video checklist (all points ✓) |
| 137 | [2026-10-31-stage137-familiar-test.md](2026-10-31-stage137-familiar-test.md) | Evidence — stage 137 ★ (phase criterion): familiar-person test |
| 139 | [2026-10-31-stage139-readme.md](2026-10-31-stage139-readme.md) | Evidence — stage 139 ★ (README final) |
| 140 | [2026-10-31-stage140-how-ai.md](2026-10-31-stage140-how-ai.md) | Evidence — stage 140: README section «How AI is used» (R7) |
| 141 | [2026-10-31-stage141-paypal-apis.md](2026-10-31-stage141-paypal-apis.md) | Evidence — stage 141: README section «PayPal APIs used» |
| 142 | [2026-10-31-stage142-license-about.md](2026-10-31-stage142-license-about.md) | Evidence — stage 142: LICENSE in root + repo About section |

---
*Generated 2026-10-31 during stage143 (evidence transparency). Keep this index
updated when adding new reports.*
