# Evidence — stage 134 ★ (YouTube upload) + 136 (thumbnail & title)

Date: 2026-10-31 (plan: 10.11 — 11 days early)
URL: **https://youtu.be/7WFiknEULyU**

## Verification (cookie-less fetch from a server = incognito-equivalent, no session used)

| Check | Result |
|---|---|
| `playabilityStatus.status` | **OK** (was `LOGIN_REQUIRED / Приватне відео` while private — now public) |
| oEmbed (public API surface) | returns metadata (public/unlisted only — OK) |
| Title | `Cross-Border Reconciliation Agent — AI PayPal payments demo | PayPal AI Hackathon` (80/100, keyword-rich) |
| Channel | Eugene Kozlovsky |
| Duration | **101 s = 1:41** (< 3:00 per R5) |
| Description | 1139 chars — live demo link ✓, repo link ✓, chapters 0:00/0:18/0:41/1:22 ✓ |
| Category | **Science & Technology** (was «Ігри» default — corrected on the page) |
| Audience / age | family-safe (`isFamilySafe: true`), not18+; made-for-kids = No (publish succeeded ⇒ answered) |
| Published | **2026-10-31T12:29:18-07:00** (today; plan date10.11 →11 days of margin) |
| isUnlisted | **false** (Public) |
| Thumbnail | `i.ytimg.com/.../maxresdefault.jpg` → HTTP **200**, **1280×720, OUR custom clean screenshot** (hero + CTA + Explore cards, no burned subs) — stage 136 ✓ |
| Qualities ready | 144p–**720p** (processing complete) |
| Platform | YouTube only (Rules §4; no Vimeo) |

## Caption tracks — known, accepted
`captionTracks:1 × (en, kind=asr)` — **auto-generated** English track. CC is OFF by
default ⇒ ordinary viewers see exactly ONE subtitle set (the burned-in one). Optional
zero-duplication polish: Studio → Content → Subtitles → `English (auto-generated)` →
⋮ → Delete (must not add any new track — stage-132 rule: never attach CC on top of
burned subs; deletion only).

## Materials pack used
- `/mnt/data/PayPal AI Hackathon/YOUTUBE-UPLOAD.md` — full upload pack: fragments
  (title/description/tags), Path A/B, element-by-element Details-page checklist
  (verified against the live DOM: audience required-choice, category fix «Ігри»→
  «Наука і техніка», unchecks for auto-episodes/places/concepts, AI disclosure «Ні»
  per its 4 scenarios, English video language, Standard license, embed on).
- `/mnt/data/PayPal AI Hackathon/video/paypal-ai-hackathon-demo.mp4` — upload copy
  (4.36 MiB, re-encode of the crf20 master so it also fits the ≤5 MiB browser-RPC path).
- `/mnt/data/PayPal AI Hackathon/video/youtube-thumbnail.png` —1280×720 thumbnail.

## Stage markers
- 134: URL opens without login (cookie-less playability OK) ✓; upload finished
  31.10 —11 days before the10.11 deadline ✓ → **DONE**.
- 136: thumbnail live (ours,1280×720) + keyword title live → **DONE**.
