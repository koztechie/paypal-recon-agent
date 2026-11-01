# Evidence — stage 146 ★: judge cold-start — 3 commands, <5 min

Date: 2026-11-01 (plan11.11) · Marker: **3 команди → робота; час <5 хв** ✓

## Method (true clean profile)
Fresh environment per phase, simulated with `env -i` + brand-new `HOME` +
**empty npm cache** (worst-case downloads, like a first-time judge):
`git clone` **from public GitHub over HTTPS** (no credentials, no SSH keys) into
`/tmp/cold146`, then the README's exact three command lines.

## Timings (wall clock)

| Phase | Command | Time |
|---|---|---|
| Clone | `git clone https://github.com/koztechie/paypal-recon-agent.git` | **5 s** |
| Install + env | `cd paypal-recon-agent && npm install && cp .env.example .env.local` | **26 s** (COLD npm cache) |
| Demo | `npm run demo` | **32 s** |
| **TOTAL** | three commands, empty → done | **63 s (1.05 min)** vs **300 s budget → 4.8× margin** |

Demo result: **exit 0**, ends `=== DONE in 29.1s — two agents paid each other:
**PROVEN (simulated: dry-run mode)** ===` with the full5/5 story (fresh contract
`CNT-20261101-…`, invoice `DRY-…`, confirmations to both agents).

## Literal-marker add-ons (`npm ci && npm start`)
- **`npm ci`**: works from the committed lockfile — 251 packages, **14 s** (warm cache).
- **`npm start`**: boots → `[server] listening on http://localhost:3000`,
  `GET /health` → **200**. Ownership verified by `/proc/<pid>/cwd` = the cold clone
  itself (not the dev server) — honest attribution of the health hit.

## Housekeeping
Cold-clone dirs and the stray server were removed/killed afterwards; the dev
server was restored. Node prerequisite: `engines` ≥ 22.18 enforced (22.22 here).

## Marker: 3 commands → working demo in63 s → stage146 DONE
