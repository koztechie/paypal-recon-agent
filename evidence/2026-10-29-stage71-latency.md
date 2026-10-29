# Evidence — stage 71 (agent action speed: < 10 s per action for the demo)

Date: 2026-10-29 (plan date 04.11 — early; originally PENDING since 28.10)

## Marker: < 10 s per action — PASS (20/20 actions under 10 s)

Official measurement, executed 2026-10-29 20:32–20:33 EET (18:32–18:33 UTC) with
`scripts/stage71-probe.mjs` (also at /tmp/stage71-probe.mjs): 10 real LLM-backed
agent actions through POST /api/nl-filter (same Gemini path + retry wrapper as the
agent), each with a correctness expectation — run twice back-to-back.

| Run | Correct | Via LLM | Median | Min | Max | <10 s |
|---|---|---|---|---|---|---|
| 1 (18:32Z) | 10/10 | 10/10 | **835 ms** | 593 ms | 3801 ms | PASS |
| 2 (18:33Z) | 10/10 | 10/10 | **1044 ms** | 788 ms | 8009 ms | PASS |

- **Every one of the 20 individual actions was under 10 s** (worst single call 8.0 s).
- No fallback engaged in either run — all answers came from the LLM and were correct.

## History (why this stage was PENDING)
- 28.10 peak finding: correctness 10/10, floor 1.4 s, but median 17.6 s at 23:30
  EET (free-tier serving queue — thoughts=0, proven not "thinking"). Six parameter
  variants + 5 alternative models did not help (recorded in PLAN row 71).
- The deferred 07:00 runner (/tmp/stage71-deferred.sh/.done/.log) was wiped by the
  environment's /tmp cleanup + server restarts (29.10) before it could fire.

## Honest framing for the demo
- Free-tier latency VARIES by congestion window: observed 0.6–4 s (normal), 8–9 s
  (busier), one 14 s timeout (00:15 EET, triggered the stage-84 fallback live).
- Recommendation for the video (stages 127–138): run `node scripts/stage71-probe.mjs`
  immediately before recording; expected median ~1 s.
- Safety net regardless of timing: NL filter, explanations and agent decisions all
  have deterministic fallbacks (stages 84/85, src/fallback.ts) — a slow LLM never
  blocks the demo, it degrades to a fast rule-based answer that is labeled as such.
