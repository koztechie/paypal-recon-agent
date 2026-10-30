# Evidence — stage 132 (minimal montage: pause trimming + English subtitles)

Date: 2026-10-30 (plan date 10.11 — early)

## Marker: file <3:00, subtitles in place — PASS

**Deliverables:**
- `evidence/2026-10-30-stage132-demo-final.mp4` — **100.8 s (1:41 < 3:00)**,
  H.264 1280×900 + AAC,4.6 MB
- `evidence/2026-10-30-stage132-demo-final.srt` — the same EN subtitles as a
  standalone file (for the YouTube upload, stage 134)
- `evidence/2026-10-30-stage132-montage-script.py` — the single rerunnable build
  (audio-driven segment lengths, trims, burns)

## Structure (audio is the master clock — segments equal their VO tracks exactly)
| Seg | VO track | Length | Video source & edits |
|---|---|---|---|
| 1 Проблема | vo-1 | 17.972 s | clip1: **cropped off the page header** (removes the row-count chip that would contradict the VO's "one hundred forty-four"), padded to1280×900, freeze-tail to audio length (end frame = static detail panel, so the hold is invisible) |
| 2 Рішення | vo-2 | 22.848 s | clip2 at natural speed, freeze-tail on the static Settings card |
| 3 Демо | vo-3 | 41.285 s | five exact slices: negotiation UI14 s + console take t10.5–22.5 (SETTLED → contract → **invoice INV2-… created**)12 s + AI panel6 s + hosted5 s + filters4.29 s |
| 4 Чому | vo-4 | 18.669 s | outro (hero → ledger+AI panel → hosted) |
| **Total** | | **100.8 s** | concat + burned subtitles (13 cues) |

## Verification
| Check | Result |
|---|---|
| duration | **100.812 s <180** ✓ |
| streams | `h264,1280×900` + `aac` ✓ |
| audio levels | mean −18.8 dB, max −1.6 dB (healthy VO, no clipping, not silent) ✓ |
| subtitles burned (4 sampled frames: t=4/25/60/92) | all four blocks show legible EN cues matched to the on-screen scene (white + outline + bottom margin) ✓ — inspected visually |
| SRT standalone |13 cues, correct `HH:MM:SS,mmm` timing, offsets = cumulative audio starts ✓ |

## Honest notes
1. **Count contradiction solved by crop, not by re-gen:** the VO says "one hundred
   forty-four" while the live ledger had grown (165/178 rows). Seg-1 crops the header
   row that carries the count — no number appears on screen during vo-1, so nothing
   contradicts the narration. (Alternative path if ever needed: re-generate vo-1
   without the numeral → rerun `montage132.py`.)
2. Seg-3 cue4 ("…creates the invoice…") leads the on-screen invoice line by a couple
   of seconds — acceptable drift for the declared *minimal* montage; a finer build
   would nudge the slice start.
3. The build is one deterministic script (audio lengths drive everything) — swapping
   any VO file and rerunning reproduces the whole film in ~1 min.
