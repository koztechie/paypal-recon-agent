# Finding H-7 — audit log: no duplicate decisions, identity-based flips

Date: 2026-11-01 · Findings: (1) `enforceActionPolicy` logged a decision and the
wrapper (`createDraftInvoice`, `recordExternalPayment`) logged the SAME decision
again → duplicate rows; (2) `markAgentActionExecuted` flipped the "newest
not-executed row per action" → under concurrency it could flip a DIFFERENT record
(catastrophic when `target_ref` was undefined — it matched ANY pending row).

## Premise verification
- Duplicates confirmed: `createDraftInvoice` (policy + own `system-policy(createDraftInvoice)`),
  `recordExternalPayment` (policy + `direct-call:`) — real DB sample from the H-5
  cycle showed the paired rows live. `sendInvoice`/`sendInvoiceReminder` log ONCE
  (not duplicated). No consumer (tests/scripts/src) reads the duplicate strings →
  removal is safe (grepped).

## Fix (identity, not selection)
- `logAgentAction` now **returns the row id**; new **`markAgentActionExecutedById(id)`**
  (UPDATE … WHERE id = ? AND executed = 0); the heuristic "newest pending" function is
  **deleted** (0 references remain — grep).
- `PolicyDecision` gained `logId`; every wrapper flips **its own** decision row:
  create → `gate.logId`, record → `recGate.logId` (blocked path flips nothing — H-6),
  send/reminder → their single attempt-log ids; the agent loop guard returns
  `{refusal, logId}` and flips exactly its policy row after execution.
- The two duplicate PASS logs removed (create + record): **one row per decision+attempt**.

## TDD (red-first)
`tests/audit-identity.test.ts`: (a) race pin — mark A, B stays untouched (old code
flipped the newest = B); (b) record → EXACTLY one row (was 2 → RED first);
(c) create → EXACTLY one row (was 2 → RED first). Plus the type-level red for the
missing export. Suite: **65/65**, lint0, build0 (unpiped).

## Live proofs
| Check | Result |
|---|---|
| `npm run stage53` (create +2 records + manual) | **5/5** |
| `npm run stage65` (reminder path) | **5/5** |
| Row shape, last15min | test groups **rows=1** each; stage65 create/send/reminder **rows=1** each; the only `rows=2` = stage53's **two real attempts** ($40 @17:16:40 + $35 @17:16:41, each flipped by its own id, `executed_at` +1s apart) — correct, not a duplicate |
| Old heuristic symbol | **0 references** |
| Historical pending-twin pairs (pre-fix era) | **6** — LEFT UNTOUCHED (deleting audit history would be its own falsification; documented) |

**H-7 status: FIXED + VERIFIED (suite65/65 + live row-shape proof).**
