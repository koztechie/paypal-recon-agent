# Security fix C-4 — dependency vulnerabilities (both lockfiles)

Date: 2026-11-01 · Finding:20 vulns across both `package-lock.json` files —
**1 critical +3 high +11 moderate-class** in `web/` (Next.js 16.0.0–16.4.0 GHSA
cluster: SSG/ISR cache poisoning, image-opt SSRF, Draft-Mode leak) and backend highs
via `@paypal/agent-toolkit` (`@langchain/core` serialization injection,
`jsondiffpatch` XSS/prototype-pollution, `zod <4.6.6` DoS, `mathjs`, `langsmith`,
`uuid`).

## Before → after

| Location | Before | After |
|---|---|---|
| `web/` | **1 critical +3 high** +16 moderate (20) | **0 critical, 0 high** +15 moderate (eslint dev-chain only) |
| root | **11 high +1 moderate** (12) | **0 — `npm audit`: found 0 vulnerabilities** |

## Batches (each its own revertable commit, each verified before push)
| Commit | What | Verification |
|---|---|---|
| `bcd0adb` (batch1) | web `next 16.3.6 → 16.4.3` (clears the CRITICAL cluster + sharp/source-map-js/zod highs) + eslint/config bumps | `next build` clean; UI smoke: home CTA ✓, ledger 23 rows, NL filter 23→3, 0 page errors |
| `2fb6a2b` (batch3a) | overrides `uuid→11.1.1`, `jsondiffpatch→0.7.7`, `mathjs→15.2.0` | probes: dry-run E2E **PROVEN**, live PayPal SDK OK, live LLM **10/10 median937ms** |
| `0384a02` (batch3b) | measured majors: `@langchain/core 0.3.6→1.1.29` (drags langsmith to fixed **0.11.6**), `ai 4.3.19→5.0.207` (kills the `@ai-sdk` high chain), `zod 3.25.76→4.6.6` | after EVERY override: tsc0, tests **24/24**, dry-run **PROVEN** (34–37s), live LLM **10/10 median658–733ms**, live SDK call OK |

## Honesty log
- **openai override dropped**: the advisory covers `4.55.0–5.23.2` and NO fixed
  release exists in that5.x line (latest = 7.47.0; my `5.30.0` attempt failed to
  install and I discarded the misleading green that followed). Our runtime never
  invokes the openai provider (`LLM_PROVIDER=gemini`, proven by the10/10 probes);
  exposure = import-only, pinned by `@paypal/agent-toolkit@1.11.0`.
- Plain `npm audit fix` changed nothing in root (all fixes are breaking majors) —
  hence the measured-override path instead of `--force`.

## Residual register (accepted, with reasoning)
| Residual | Why accepted | Mitigations already armed |
|---|---|---|
| web **15 moderate** (eslint/`minimatch` glob-DoS) | dev tooling only — **not in the runtime bundle** (`next build` output ships without eslint) | CI runs it on trusted code only |
| openai pinned4.86 (import-only) | provider unused (gemini-only path,10/10 probes) | upgrade when toolkit ships a fixed pin; watch releases |
| `@paypal/agent-toolkit` still flagged-by-chain in some DB refreshes | official SDK (R1 requirement), latest = 1.11.0 | C-1/C-2/C-3 + body caps + fail-closed patterns bound impact |

## Prod verification (after deploy)
`health200` (boot = import-smoke for zod4/core1/ai5) · **live LLM filter `source:llm738ms`**
· token gate `401` · book healed by signed cycle **`SEED-C4-15322`** → rows `0→2→4→5`,
**MATCHED** via auto-reconcile (C-1→store→auto-recon full path with the new stack).

**C-4 status: FIXED (root audit0; web critical/high0) + VERIFIED ON PROD.**
