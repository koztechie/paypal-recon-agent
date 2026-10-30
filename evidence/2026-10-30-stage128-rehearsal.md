# Evidence — stage 128 (rehearsal: scenario dry run, timed, <3 min)

Date: 2026-10-30 (plan date 10.11 — early)
Raw: `2026-10-30-stage128-rehearsal.json` (per-frame cumulative timings)

## Marker: rehearsal fits under 3 min — PASS (80.5 s of180 s)

### Prep BEFORE the timer (per the scenario's precondition checklist)
| Step | Result |
|---|---|
| warm `GET prod /health` | **200, took32.5 s** — cold start confirmed; proves the warm-up step is mandatory |
| re-seed prod (create + send + pay `SEED-128` → recon) | `INV2-2LKG-J6LN-PJ85-TY2L` → payment row → **MATCHED** on prod (poll ~4) — hosted chip now >0 |
| LLM probe (`stage71-probe`,10 calls) | **10/10 correct, median696 ms, max2.4 s** — recording window healthy |

### Timed scenario walk (frame-by-frame, cumulative from start)
| Frame | Milestone | Cumulative |
|---|---|---|
| F1 | ledger + UNMATCHED filter applied | 6.5 s |
| F2 | row details panel open | 9.4 s |
| F3 | caption hold | 10.9 s |
| F4 | hero + CTA → grid | 14.5 s |
| F5 | Agent audit table | 17.5 s |
| F6 | Settings limits card | 20.5 s |
| F7 | negotiation — 3 LLM rounds done | 27.1 s |
| F8 | Settled ✓ + contract card | 29.8 s |
| F9 | console `npm run demo` (DRY_RUN — same duration, zero sandbox spam) → **PROVEN** | 67.8 s |
| F10 | ledger → AI insight (`via llm`) | 71.9 s |
| F11 | hosted URL mini-demo → llm answer | 75.0 s |
| F12 | quick-filter speed shot | 78.9 s |
| F13–14 | outro frames (montage-only) | 80.4 s |
| **TOTAL** | **80.5 s <180 s → PASS** | |

### Rehearsal conclusions for the shoot (stage129+)
- **Breathing room is generous:** live actions total ~80 s vs the planned160 s —
  each block has slack for narration holds (e.g., block D: actions ~51 s inside90 s),
  so slow VO or an extra take will not break the timeline.
- Longest single step: console demo F9 =38 s (dry-run) — fits block D comfortably;
  the real-sandbox variant adds only a few seconds.
- Two slow spots to remember while recording: cold warm-up (32.5 s — do it BEFORE
  rolling) and LLM negotiation (6.6 s — natural, keep it in the shot).
- No stumbles: every frame executed on the first attempt (0 retries).
