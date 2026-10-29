# Evidence — stage 98 (limits: no action without agreement, max 10 rounds)

Date: 2026-10-29 (plan date 07.11 — early)

## Marker: violation -> simulation stops — PASS (7/7 checks)

Run (`npm run stage98`):
```
scenario A: impossible deal, maxRounds=10
  rounds=10 settled=false reason="round limit (10) reached"
  buildContract: no contract without a settled agreement (round limit (10) reached)
  createInvoice: refused: invalid contract (price consistency (unit×qty≠total))
```
| Check | Result |
|---|---|
| rounds stop exactly at the cap (impossible deal: buyer $400 < floor $450) | OK |
| cap is hard (`MAX_ROUNDS = 10`, exported from src/negotiation.ts; negotiate() clamps any config to it) | OK |
| no settlement -> no agreed price | OK |
| no agreement -> buildContract refuses (simulation stops before any action) | OK |
| invalid/tampered agreement -> invoice refused (validator: unit×qty≠total) | OK |
| no EXECUTED create_invoice appeared from the violations (audit before==after) | OK |
| refusal audit-logged as `create_invoice / BLOCKED / executed=0` | OK |
| **MARKER_LIMITS_ENFORCE** | **PASS** |

## Enforcement points (where the limits live)
1. `src/negotiation.ts`: `export const MAX_ROUNDS = 10` + `negotiate()` clamps
   `maxRounds = clamp(cfg.maxRounds, 1, 10)` — a caller CANNOT request more.
   The loop stops at the cap with `reason = "round limit (N) reached"`.
2. `src/contract.ts`:
   - `buildContract()` throws on an unsettled negotiation (already stage 95; asserted
     here as the stop point of scenario A).
   - `createInvoiceFromContract()` re-validates and refuses invalid/unsigned
     contracts BEFORE any PayPal call — and now logs every refusal to
     `agent_actions` as `limit_check='BLOCKED', executed=0` (SECURITY rule 3:
     blocked attempts are recorded too).
3. The $500 auto-limit (`enforceActionPolicy`) and reminder rate limits remain
   unchanged inside the core shell (stages 68/64).
