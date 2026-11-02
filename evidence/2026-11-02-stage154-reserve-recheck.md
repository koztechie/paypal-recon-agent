# Evidence — stage 154: reserve-day re-verification of `Submitted` (executed early, 02.11)

Marker: «Повторна перевірка статусу Submitted» · Plan date: 12.11 (external deadline day) ·
Executed: 2026-11-02 (state is static — every check below is idempotent and re-runnable;
the same battery re-runs on 12.11 per the runbook at the bottom).

## Result: ALL GREEN — no submission errors found, nothing to fix

### 1. Status (auth read-model)
- `get_project` → `hackathons[paypalaihackathon].submitted_at = 2026-11-02T03:12:40.905-05:00` (non-null) ✓
- `project.state = published` ✓
- (`list_my_projects` on 02.11 during stage153: `in_progress: true` + hackathon listed ✓)

### 2. Public anonymous bytes (fresh fetch, no cookies)
| Check | Result |
|---|---|
| `GET devpost.com/software/paypal-reconciliation-agent` | **200**, «Submitted to» section present ×1 ✓ |
| Video embed on page | `youtube.com/embed/7WFiknEULyU` ×1 ✓ |
| YouTube oEmbed (video still public) | **200** — title «Cross-Border Reconciliation Agent — AI PayPal payments demo \| PayPal AI Hackathon», author Eugene Kozlovsky ✓ |
| Demo `https://paypal-recon-agent.onrender.com/` | **200** + app markup («Cross-Border»/«Reconciliation» present) ✓ |
| Repo `github.com/koztechie/paypal-recon-agent` | **200** — correct title ✓ |
| Links on project page | demo ×5, repo ×4 ✓ |
| Thumbnail | `software_thumbnail_photos/...` ×5 (real upload) ✓ |

### 3. Hackathon timing (get_key_dates, authoritative)
- `current_phase = submissions_open` · status `submissions_open` ✓
- **`submissions_end_at = 2026-11-12T20:00:00Z`** (the external deadline)
- judging 2026-12-01 → 2026-12-15 · winners announced 2026-12-21T17:00:00Z

### 4. Known non-verifiable (unchanged, documented at stage152/153)
Track opt-ins (AG Grid + Render): no public/API surface. Fallback = user glance at the
manage page's entered-prizes section (step 4 of the runbook).

## RUNBOOK — re-run this battery ON 12.11 (before 20:00 UTC / 12:00 PT)
1. **Status (3 channels):**
   - `curl -s https://devpost.com/software/paypal-reconciliation-agent | grep -c "Submitted to"` → must be ≥1
   - MCP `get_project` → `hackathons[...].submitted_at != null`
   - MCP `list_my_projects` → our project `in_progress == true`
2. **Assets alive:**
   - `curl -s -o /dev/null -w "%{http_code}\n" https://paypal-recon-agent.onrender.com/` → 200 (Render may cold-start: first hit can take ~50s — open it once manually if 503/timeout)
   - `curl -s -o /dev/null -w "%{http_code}\n" https://github.com/koztechie/paypal-recon-agent` → 200
   - `curl -s "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=7WFiknEULyU&format=json"` → 200 (video public)
3. **Dates:** MCP `get_key_dates` → phase still `submissions_open`, `submissions_end_at` unchanged.
4. **User glance (30 s):** open the manage view → status label = **Submitted** → check
   entered prizes = **AG Grid + Render** (the only item no API can read; if missing →
   edit the entry, re-tick both, save — Devpost keeps the Submitted status after edits).
5. **Decision tree:** any red → fix (edit entry in manage until 20:00 UTC 12.11, then
   re-run steps 1–3) → all green → done; judging opens 2026-12-01.

**Stage 154 DONE: zero errors found on re-verification (02.11); runbook archived for the deadline day.**
