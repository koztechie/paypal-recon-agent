# Evidence — stage 153 ★: submission CONFIRMED (status Submitted + URL)

Date: 2026-11-02 · Marker: «Статус `Submitted` + URL підтвердження» · Plan deadline: 11.11 (external 12.11)

## What happened (provenance — honest record)
The user walked the Devpost manage flow page by page (each step given as an
element-by-element instruction in this session: invite → overview → details →
additional-info) and completed the final Submit **in their own browser session**.
The MCP `submit_project` path was prepared (custom-answers JSON, video_url, omitted
opt_in_prize_ids) but was **not needed** — the web flow validated and submitted first.
Submit timestamp from the API read-model: **2026-11-02T03:12:40.905-05:00 (= 08:12:40Z)**.

## Verification — three independent channels
| # | Channel | Result |
|---|---|---|
| 1 | `get_project` (auth read-model) | `hackathons[paypalaihackathon].submitted_at = 2026-11-02T03:12:40.905-05:00` (non-null; baseline at stage151/152 was `null`) ✅ |
| 2 | `list_my_projects` (auth read-model) | `in_progress: true` + `hackathons: [PayPal AI Hackathon]` — tool semantics: hackathons the project **has been submitted to**; in_progress = submitted, winners pending ✅ |
| 3 | Public anonymous fetch (no cookies) | `GET https://devpost.com/software/paypal-reconciliation-agent` → **200**, containing `<div id="submissions"> <h4>Submitted to</h4>` → **PayPal AI Hackathon** entry with link ✅ |

Server-side required-field validation passed for the entry to be accepted, so all19
required custom answers were present at submit (inference from Devpost's submit
validation, documented as such).

## Public page byte-checks (same anon fetch)
- Title `<title>Cross-Border Reconciliation Agent | Devpost` ✓
- Video: `youtube.com/embed/7WFiknEULyU` (embed present) ✓
- Links: `paypal-recon-agent.onrender.com` ×5, `github.com/koztechie/paypal-recon-agent` ×4 ✓
- Description: Markdown-rendered headings present (`Inspiration` ×3), `AG Grid` ×3, `Built with` section ✓
- Thumbnail: `og:image = .../software_thumbnail_photos/005/773/594/datas/medium.png` — a **real uploaded**
  thumbnail (not the default placeholder) → the user completed the «Edit thumbnail» step ✓
- Hackathon association links ×2 ✓

## What is NOT publicly verifiable (honest limits)
- **Track opt-ins (AG Grid + Render)**: no public surface exists — `/gallery` → 404,
  `/submissions` (anon) lists nothing, `get_prizes.participation` disproved as a state
  channel (stage152), no submission-read tool in the MCP. Source of truth remains the
  user's stage152 ticks + saved form pages. **Fallback if ever needed**: Devpost allows
  editing a submitted entry until the deadline — re-check entered prizes in the manage
  view and re-tick there.
- Submission-history section on the public page renders empty for anonymous visitors.

## Confirmation URLs
- **Public entry (the confirmation URL):** https://devpost.com/software/paypal-reconciliation-agent
- Manage view (user, auth): https://devpost.com/submit-to/31302-paypal-ai-hackathon/manage/submissions

## Final state
Entry: id 1513867 / submission 1268346, status **Submitted** (not Draft), submitted
02.11.2026 — nine days before the external deadline (12.11, 20:00 UTC). Pack
`SUBMISSION-ANSWERS-READY.md` (21 answers) + `SUBMISSION-custom-answers.json` remain the
answer source of record; the MCP submit payload was never sent (superseded by the web flow).

**Stage 153 DONE — PLAN 153/153 complete.**
