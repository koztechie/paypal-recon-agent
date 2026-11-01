# Finding H-6 — a BLOCKED action can no longer be marked executed

Date: 2026-11-01 · Finding: `recordExternalPayment`'s `!recGate.allowed` branch called
`markAgentActionExecuted` before throwing → the BLOCKED row flipped to `executed=1`
→ direct falsification of the audit log (SECURITY.md Rule 3).

## Premise verification
- Code confirmed at `src/invoicing.ts` (blocked branch → mark → throw). The flip
  targets the NEWEST pending row (`ORDER BY id DESC`) = the BLOCKED decision itself.
- **Full sweep of every `markAgentActionExecuted` call site** (invoicing ×4, agent.ts):
  all others sit strictly AFTER a real execution — the pattern existed ONLY here.
- **Blast radius: zero** — `BLOCKED AND executed=1` rows = **0** in the dev book and
  **0** in the committed snapshot → no data remediation, no snapshot re-export.

## Fix + pin (TDD)
- Red first: `H-6a` failed for exactly the right reason (some row got executed=1
  after a >$500 block; tool never ran), `H-6b` (allowed path) already green.
- Removed the flip; the BLOCKED row stays `executed=0` (guards.ts contract:
  "caller flips it after real execution").
- Suite: **62/62**, lint0, build0 (unpiped).

## Docs
SECURITY.md Rule 3 extended with the H-6 invariant.

**H-6 status: FIXED + VERIFIED (tests62/62, sweep clean, zero polluted rows).**
