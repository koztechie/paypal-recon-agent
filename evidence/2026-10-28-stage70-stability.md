# Evidence — stage 70 (stability: 10 repeats, identical statuses)

Date: 2026-10-28 (plan date 04.11 — early)

## Marker: 10/10 without status discrepancies — PASS (4/4 checks)
Scenario (fixed): payment $35.00, reference invoice #9002 ($40.00 USD) -> PARTIAL.
Runs 1..10: PARTIAL x10 (set size = 1). Reasons all carry concrete digits.
Latency: min 7.7s, median 11.8s, max 22.2s.

## Notes
- Determinism of the STATUS holds; reason phrasing varies slightly (two natural
  wordings) — acceptable: marker covers statuses; digits always present.
- FINDING FOR STAGE 71: median 11.8s EXCEEDS the plan's "<10s" target —
  stage 71 must investigate latency (free-tier queuing / thinking behaviour;
  thinkingBudget=0 was rejected by this model with 400 in an earlier probe).
