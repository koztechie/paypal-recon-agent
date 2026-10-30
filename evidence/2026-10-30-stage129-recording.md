# Evidence — stage 129 (screen recording: problem + product start)

Date: 2026-10-30 (plan date 10.11 — early)

## Marker: clips without freezes — PASS (verified frame-by-frame)

| Clip | Frames (scenario) | Duration | File |
|---|---|---|---|
| **1 — проблема** | F1 ledger + UNMATCHED filter → F2 панель QA-P5 → F3 пауза | **10.2 s** | `evidence/2026-10-30-stage129-1-problem.mp4` |
| **2 — старт продукту** | F4 hero + CTA → F5 Agent-аудит → F6 Settings | **14.1 s** | `evidence/2026-10-30-stage129-2-product-start.mp4` |

Both: H.264 / yuv420p /1280×900, no audio track (VO arrives later — stage 130+).

## Method
- Recorded with **Playwright `recordVideo`** (fresh context per clip; every navigation
  waits for its ready-state; page/console errors collected: **0 errors across both
  recordings** — `2026-10-30-stage129-record.json` with per-action timestamps).
- Freeze removal exactly as the scenario's montage rules prescribe ("різати паузи
  завантаження"):
  - clip 1: head-trim at **2.9 s** (skips the hydration shell + empty-grid frames);
  - clip 2: **middle cut** — segments [0…2.95] + [5.85…end] concatenated (removes the
    CTA navigation's loading gap; hero dwell jumps straight to the ready ledger).

## Frame-by-frame verification (1 fps strips of the FINAL mp4s — inspected visually)
- **Clip 1:** opens on the full grid → filter popup → "UNMATCHED" typed → filtered
  rows ($55/$97/$30) → detail panel of QA-P5 (recon UNMATCHED, amount 55.00) held to
  the end. **No loading shell, no spinner, no black frames.**
- **Clip 2:** hero (chip "145 live rows" — the stage-128 seed is live) → straight to
  the ready ledger (post-cut) → Agent page (stats145/81/36 + PASS rows) → Settings
  guardrails card. **No loading shell, no spinner.**
- Recording console/page errors: **0** (both clips).

## Not in this stage (deferred by design)
Console clip (F9, `npm run demo`) and negotiation/hosted-URL/AI clips (F7–F12) are
recorded in the next stages; final assembly + VO/subtitles after ElevenLabs files
(the audio contract is in VIDEO-SCENARIO.md).
