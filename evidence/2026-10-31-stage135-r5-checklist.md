# Evidence — stage 135: R5 video checklist (all points ✓)

Date: 2026-10-31 · Target: published video **https://youtu.be/7WFiknEULyU**

## Method (why this proof is hard)
Audited **the very bytes YouTube serves**, not the local master: fresh yt-dlp
(2026.10.26 binary; system one got HTTP 403 — YouTube anti-bot) downloaded the public
video → `published.webm`, **AV1 1024×720, 100.85 s**, audio opus present (merged
f398+f251). 14 frames extracted at 2/5/10/20/26/35/44/47/51/57/68/75/79/96 s →
one strip, reviewed EYE-BY-EYE: `2026-10-31-stage135-r5-frames.png`.

## R5 checklist (PLAN:63) — verdict per point

| # | R5 point | Verdict | Proof from the PUBLISHED file |
|---|---|---|---|
| 1 | Відео **< 3 хв** | ✅ | `ffprobe` published = **100.85 s (1:41)** < 180 s |
| 2 | **Кадри працюючого проєкту на цільовому пристрої** | ✅ | 14/14 frames are screen captures of the RUNNING product in its target context — a desktop web browser (and the terminal for the CLI cycle). Zero mockups/placeholders. See frame table ↓ |
| 3 | **Лише YouTube**, публічне | ✅ | stage 134 evidence: cookie-less `playabilityStatus: OK`, category Science & Technology; uploaded nowhere else (Vimeo explicitly forbidden, ADR/§4 ruling 27.10 — never touched) |
| 4 | **Без сторонніх торгових марок і авторської музики** | ✅ | logo audit on 14/14 published frames: **zero third-party logo graphics**; only nominative text (PayPal/Gemini/AG Grid as API & model names — same ruling as stage 133). Audio = **1 stream, our4 ElevenLabs VO tracks only** (montage script audio inputs = `vo-{1..4}.mp3`, nothing else; no music exists in the pipeline) |

### Frame table (published timestamps → what it proves "working on target device")
| t (s) | On screen | Proves |
|---|---|---|
| 2 | Ledger grid + header filter popup typing `UNMATCHED`, status pills | live data grid in a desktop browser, real interaction |
| 5 | Filter applied — rows collapsing | working filter (not a still) |
| 10 | 3 UNMATCHED rows + detail panel (kind/ref/status/amount/variance) | row inspection works |
| 20 | Home hero + gradient CTA + Explore cards + "PAYPAL SANDBOX…LIVE DATA" | product shell on the target platform (web) |
| 26 | Ledger + NL query box + pills + open panel | AI-augmented ledger |
| 35 | Agent page: stats 170/94/29, guardrail decisions incl. BLOCKED | audit trail + guardrails working |
| 44 | Negotiation window, "Negotiating…" | two-agent flow running |
| 47 | Buyer/seller messages exchanged ($400 vs $450 floor) | live LLM negotiation |
| 51 | **Settled ✓ $400** + contract card CTR-26103166-195A | agreement → validated contract |
| 57 | Terminal E2E cycle output (create → send → pay → reconcile) | the tool works from the shell too |
| 68 | Ledger + AI detail panel (explained match) | explanations from live data |
| 75 | Hosted demo: `health: OK`, result `filter: {…} source: llm` | **works from a browser, no install** — literal target context |
| 79 | Quick-filter EUR over rows + Export CSV | sub-second filters, export |
| 96 | Hosted demo outro + "Open source: three commands…" | closing proof |

**"На тому, для чого він зроблений"** — the product is a browser-based seller tool for
PayPal cross-border reconciliation; every frame shows it doing exactly that job with
live sandbox data (real INV2-/CTR-/EXTR- IDs, live row counts, real LLM answers) in a
desktop browser, plus the terminal path — and the hosted segment proves it runs
where sellers work: any browser, no install.

## Marker: R5 checklist — ALL POINTS ✓ → stage 135 DONE
