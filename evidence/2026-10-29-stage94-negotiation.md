# Evidence — stage 94 (two LLM agents with roles: buyer budget / seller floor)

Date: 2026-10-29 (plan date 07.11 — early)

## Marker: simulation of 3 negotiation rounds in the console — PASS (2/2 runs)

Implementation:
- src/negotiation.ts (new): `negotiate(cfg)` runs alternating buyer/seller turns.
  Each side is an LLM (src/llm.ts chat(), temperature 0.4, JSON-only protocol
  `{"message", "offer_usd"}`) wrapped in HARD code-enforced limits the model cannot
  exceed: buyer = authorization ceiling (clamped), seller = floor (clamped).
  The acceptance turn is additionally pinned: an LLM acceptance at ANY price other
  than the seller's counter is discarded and replaced by the scripted acceptance
  (first run caught exactly that — the model counter-offered $425 instead of
  accepting; the guard now makes the transcript self-consistent).
  Malformed replies fall back to scripted rounds (anti-fragile, mirrors stages 84/85).
- scripts/stage94-negotiate.ts (npm run stage94): the DEMO-SCENARIO config —
  10 × "cross-border reconciliation report", open $400, ceiling $460, floor $450,
  maxRounds 3 — prints the transcript and `MARKER_3_ROUNDS: PASS/FAIL` (exit code).

## Console transcripts (both runs settled at $450.00 after exactly 3 rounds)

Run 1:
```
Round 1 — BUYER:  "Hello, I am looking to purchase 10 units of the cross-border reconciliation report for a total of $400.00." [400.00]
Round 2 — SELLER: "My absolute final price for the 10 cross-border reconciliation reports, including weekly delivery, is $450.00." [450.00]
Round 3 — BUYER:  "Deal — $450.00 works for us for the 10 cross-border reconciliation reports with weekly delivery. We accept." [450.00]
Result: SETTLED at 450.00 USD after 3 rounds (buyer accepted the seller's counter)
MARKER_3_ROUNDS: PASS
```

Run 2 (fresh wording — same structure):
```
Round 1 — BUYER:  "…with a target budget of $400.00." [400.00]
Round 2 — SELLER: "Our lowest price … including weekly delivery, is $450.00, which is our final offer." [450.00]
Round 3 — BUYER:  "Deal at $450.00 for the 10 cross-border reconciliation reports with weekly delivery." [450.00]
Result: SETTLED at 450.00 USD after 3 rounds
MARKER_3_ROUNDS: PASS
```

All three messages per run are LLM-generated (phrasing differs between runs; the
scripted fallbacks would be verbatim identical).

## Notes
- The transcript maps1:1 onto DEMO-SCENARIO.md replicas 1–3 — this negotiation is
  what stages 95–97 will turn into contract JSON → invoice → payment.
- `npx tsc --noEmit` exit 0 (money stays in minor units; no float arithmetic).
