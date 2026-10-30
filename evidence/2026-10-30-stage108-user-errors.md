# Evidence — stage 108 (user errors: invalid input, repeated submits)

Date: 2026-10-30 (plan date 08.11 — early)

## Marker: 3 error cases with clear messages — PASS (6/6, Playwright)

| # | Case | Message shown | Result |
|---|---|---|---|
| 1 | Empty submit to the NL box (button no longer swallows the click silently) | `Type a question first — e.g. "show unmatched payments over $50".` | PASS |
| 2 | Unparseable query (`qwerty zxcv nonsense 12345`) | `Couldn’t find anything filterable in that — try e.g. "unmatched payments over $50" or "invoices with status SENT".` — **and the grid is left untouched** (asserted: row count unchanged) | PASS (2 checks) |
| 3 | Repeated submit: Send reminder on the same invoice twice | 1st: `Reminder sent for INV2-6YK5-WRAX-BNTB-TCLP — PayPal accepted; rate limits (1/24h, 3 lifetime)…` (real sandbox transmission); 2nd: **`BLOCKED: 24h limit reached (1/day)`** — the actual guardrail refusing the repeat | PASS (2 checks) |

Screenshots: `2026-10-30-stage108-1-empty.png`, `-2-gibberish.png`, `-3-repeat.png`.

## Behaviour notes
- Case 1: `disabled` on empty input was REMOVED (a disabled button gives no
  explanation); the busy state still disables submission and is itself the
  `Thinking…` label — no double sends possible (case 3 proves the server-side
  guard is the second line of defence anyway).
- Case 2: deterministic — the server answers `{filter:{}}` (verified by curl:
  `source=fallback, ms=757`); non-string/missing query already returns
  HTTP 400 `query required.` which the UI surfaces as `Could not parse the query: …`.
- Case 3 goes through the REAL pipeline: sandbox PayPal call on the first submit,
  rate-limit refusal on the repeat (no second transmission attempted).
- Gates before commit (per the stage-CI lesson): biome 0/0/0, tsc 0, npm test 1/1.
