# Evidence — CI failure analysis & fix (logs_111187321661.zip, run 2026-10-30 07:04Z)

Source: GitHub Actions `build-and-test` logs bundle provided by the user.

## What failed
- Job stopped at **step 5 "Lint (biome)"** → `Found 23 errors, 4 warnings, 2 infos`,
  `Process completed with exit code 1`. Steps 6–13 (tests/build) never ran
  (post steps numbered 14/15 confirm they were skipped, not missing).
- Root cause: stages 94–107 added/edited files without running the local
  `biome check` gate — formatting/style violations in
  `src/server.ts, contract.ts, negotiation.ts, confirmation.ts`,
  `scripts/stage71-probe.mjs, stage94-negotiate.ts, stage97-confirm.ts, stage100-demo.ts`.

## Fixes applied (all local-verified before push)
1. `biome check --write` + **manual fixes** for the unsafe/leftover rules — final
   state: **biome exit 0 with 0 errors / 0 warnings / 0 infos** (was 23/4/2), including:
   - server bench LCG: assignment-in-expression → statement body (error),
   - `let result` implicitly any → typed `RowActionResult` (error),
   - unused `sleep` in stage97, unused `role` param + call sites in negotiation,
   - optional-chain in contract validator, template literals (probe/confirmation),
     non-null assertion in stage94 output, import sort/format (server.ts).
2. **Latent test flake found while verifying:** `tests/smoke.test.ts` probes
   `/health` for 40×100 ms = **4 s**, but server startup-to-listen is now **~3.7 s**
   (heavier import graph from the Module A + endpoints additions) — the first local
   run failed with `fetch failed`, the rerun passed. Budget raised to 100×100 ms
   (10 s); the assertion itself (status 200, body ok) is unchanged.

## Verification after fixes
| Gate | Result |
|---|---|
| `npx biome check src tests scripts` | exit 0 (0/0/0) |
| `npx tsc --noEmit` | exit 0 |
| `npm test` | pass 1 / fail 0 |
| `npm run stage94` (negotiation after the ask() signature change) | MARKER_3_ROUNDS: PASS |
