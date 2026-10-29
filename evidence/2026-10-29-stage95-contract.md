# Evidence — stage 95 (settled agreement -> contract JSON, validator gate)

Date: 2026-10-29 (plan date 07.11 — early)

## Marker: agreement JSON is valid — PASS (with two negative tests)

Implementation:
- src/contract.ts (new):
  - `buildContract(settledResult, cfg, transcript)` — THROWS if the negotiation is
    not settled (stage-98 rule: no contract without a recorded agreement).
    Money and payment terms are CODE-owned (total_minor from the agreement,
    unit = round(total/qty), net_days from config); the LLM only drafts the
    one-sentence `summary` (temperature 0, JSON-only) with a template fallback.
  - `validateContract(x)` — hand-rolled, zero-dependency gate: shape/types, ISO
    currency, integer money, **price consistency (unit×qty ≈ total, rounding
    tolerance)**, net_days 1..365, negotiation rounds, parseable agreed_at, and a
    JSON round-trip. Downstream stages run only on `ok:true`.
- scripts/stage95-contract.ts (`npm run stage95`): real negotiation -> contract ->
  print JSON -> 3 assertions, exit code = marker.

## Run output (assertions)
```
validation: contract=VALID, tampered=rejected (good), unsettled-refused=true
MARKER_CONTRACT_VALID: PASS
```
| Check | Result |
|---|---|
| Contract built from a REAL settled negotiation ($450, 3 rounds) | VALID |
| Tampered total (`price.total_minor = 1`) rejected by the validator | rejected (good) |
| `buildContract` on an unsettled run (maxRounds=1) refused | refused=true |
| `npx tsc --noEmit` | exit 0 |

## Contract shape (live run)
```json
{
  "id": "CNT-20261029-…", "status": "settled",
  "parties": { "buyer": "Procurement agent (finance team)", "seller": "Merchant agent (…)" },
  "subject": { "item": "cross-border reconciliation report", "quantity": 10, "currency": "USD" },
  "price": { "total_minor": 45000, "unit_minor": 4500 },
  "terms": { "type": "net_days", "days": 7 },
  "negotiation": { "rounds": 3, "opened_minor": 40000 },
  "summary": "The buyer purchased 10 … for $450.00.", "source": "llm",
  "agreed_at": "2026-10-29T…Z"
}
```

## Defect found & fixed (honest log)
- First implementation let the LLM extract `payment_days` from the transcript: it
  **invented net-30** although no payment terms were ever said (the model guessed a
  common default). Terms moved to CODE ownership (cfg.paymentDays, default 7 —
  DEMO-SCENARIO net-7); the LLM is now summary-only and explicitly told not to
  invent numbers. Verified in the final run: `days: 7`.
