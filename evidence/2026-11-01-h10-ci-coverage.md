# Finding H-10 — CI now covers the whole product (web build + dependency audits)

Date: 2026-11-01 · Finding: CI ran only backend lint/typecheck/test — the Next app
(where the CRITICAL advisory lived, C-4) never compiled in CI; `npm audit` ran
nowhere; secret-scan absent.

## Premise verification against the CURRENT file (post-H-9)
| Claim | Status at start of this finding |
|---|---|
| web/ never builds in CI | **TRUE** — no web steps at all |
| `npm audit` nowhere in CI | **TRUE** |
| secret-scan absent | **STALE** — added in H-9 (`91622a7`), still present ✓ |

## Fixes
- **CI pipeline extended** (`.github/workflows/ci.yml`): `Dependency audit (root)` →
  `Web install (npm ci)` → **`Web lint (eslint)`** → `Dependency audit (web)` →
  **`Web build (next)`**; both audits use `--audit-level=high` (high/critical fail the
  pipeline; web's15 known moderates are the documented H-4 residual, tracked not
  hidden); `setup-node` now caches BOTH lockfiles; timeout10→15.
- **Pre-push verification caught REAL web issues** (the whole point): `eslint` had
  never run — it found2 errors (`react-hooks/set-state-in-effect` in
  `data-grid.tsx`'s two intentional external-sync effects, flagged since the C-4
  eslint-config bump) +1 unused-var warning (the dead `dashboard` const leftover
  from the homepage P4 change). Resolutions: **block disables with written WHY** on
  exactly the two effects (deriving instead would close the panel on transient filter
  states / the explain loading marker is stage-85 design — no behavior change, zero
  risk to the UI verified in stages 79–146) and the **dead const removed** (subtract).
  `web lint` → rc0.

## Verification (the full NEW chain, exactly as CI runs it, locally first)
| Step | rc |
|---|---|
| root lint / audit(high) / build / test | 0 / 0 / 0 / 0 (**77/77**) |
| web npm ci (fresh node_modules) / eslint / audit(high) / next build | 0 / 0 / 0 / 0 |
| workflow YAML re-parsed (12 steps, timeout15) | ✓ |

Then pushed and verified on the REAL CI run (see commit).

**H-10 status: FIXED — CI builds and lints `web/`, audits BOTH lockfiles at high,
and (from H-9) scans for secrets; the stale secret-scan bullet noted honestly.**
