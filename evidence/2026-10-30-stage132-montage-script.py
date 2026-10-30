#!/usr/bin/env python3
"""Stage 132 montage (single rerunnable build): assemble the demo from recorded
clips + the four ElevenLabs tracks, trim pauses, burn EN subtitles.
Output: <repo>/evidence/2026-10-30-stage132-demo-final.{mp4,srt}
Usage: python3 montage132.py
"""
import json, subprocess, sys, os, re

REPO = "/home/koztechie/projects/hackathons/paypalaihackathon"
EV = f"{REPO}/evidence"
VO = "/mnt/data/PayPal AI Hackathon/voiceover"
WORK = "/tmp/montage132"
os.makedirs(WORK, exist_ok=True)

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print("FFMPEG FAIL:", cmd)
        print(r.stderr[-1500:])
        sys.exit(1)

def dur(path):
    r = subprocess.run(
        f'ffprobe -v error -show_entries format=duration -of csv=p=0 "{path}"',
        shell=True, capture_output=True, text=True)
    return float(r.stdout.strip())

# ---------- voice tracks (master clocks) ----------
vo = [f"{VO}/vo-{i}-{n}.mp3" for i, n in
      [(1, "problem"), (2, "solution"), (3, "demo"), (4, "why")]]
vo_d = [dur(v) for v in vo]
print("voice durations:", [round(d, 3) for d in vo_d])
starts = [0.0]
for d in vo_d:
    starts.append(starts[-1] + d)
total = starts[-1]
print(f"total (audio-driven): {total:.2f}s")

CLIP1 = f"{EV}/2026-10-30-stage129-1-problem.mp4"
CLIP2 = f"{EV}/2026-10-30-stage129-2-product-start.mp4"
TAKE = f"{EV}/2026-10-30-stage130-e2e-onetake.mp4"
V2 = "/tmp/pw91/vid2"

# ---------- SEG 1: problem (vo-1) ----------
# crop off the page header (nav/title/count — count contradicts the VO numeral),
# keep toolbar->grid->panel, pad bottom to the1280x900 canvas, freeze tail to audio length.
run(f'ffmpeg -y -loglevel error -i "{CLIP1}" -i "{vo[0]}" '
    f'-filter_complex "[0:v]crop=1280:710:0:190,pad=1280:900:0:190:0xF5F7FA,'
    f'tpad=stop_mode=clone:stop_duration=12,setsar=1,fps=30,format=yuv420p[v];'
    f'[1:a]aresample=44100,apad,atrim=0:{vo_d[0]}[a]" '
    f'-map "[v]" -map "[a]" -t {vo_d[0]} -c:v libx264 -preset fast -crf 20 -g 30 -c:a aac -b:a 128k "{WORK}/seg1.mp4"')

# ---------- SEG 2: product start (vo-2) — natural speed, freeze on Settings ----------
run(f'ffmpeg -y -loglevel error -i "{CLIP2}" -i "{vo[1]}" '
    f'-filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=12,setsar=1,fps=30,format=yuv420p[v];'
    f'[1:a]aresample=44100,apad,atrim=0:{vo_d[1]}[a]" '
    f'-map "[v]" -map "[a]" -t {vo_d[1]} -c:v libx264 -preset fast -crf 20 -g 30 -c:a aac -b:a 128k "{WORK}/seg2.mp4"')

# ---------- SEG 3: demo block (vo-3) — five exact slices = audio length ----------
# nego UI (14s) + console take t10.5-22.5 (decision->invoice,12s) + ai panel6s
# + hosted5s + filters4.29s
neg = dur(f"{V2}/negotiation.webm")
ai = dur(f"{V2}/ai-panel.webm")
host = dur(f"{V2}/hosted.webm")
filt = dur(f"{V2}/filters.webm")
a3 = vo_d[2]
# budget split:14 +12 +6 +5 + rest
s_n, s_c, s_a, s_h = 14.0, 12.0, min(6.0, ai - 0.05), min(5.0, host - 0.05)
s_f = round(a3 - s_n - s_c - s_a - s_h, 3)
assert s_f > 0, f"filters slice {s_f}"
assert neg > s_n and ai >= s_a and host >= s_h and filt >= s_f, "slice exceeds source"
print(f"S3 slices: nego{s_n} console{s_c} ai{s_a} hosted{s_h} filters{s_f} = {s_n+s_c+s_a+s_h+s_f:.3f} vs {a3:.3f}")
run(f'ffmpeg -y -loglevel error -i "{V2}/negotiation.webm" -i "{TAKE}" -i "{V2}/ai-panel.webm" -i "{V2}/hosted.webm" -i "{V2}/filters.webm" -i "{vo[2]}" '
    f'-filter_complex "[0:v]trim=0:{s_n},setpts=PTS-STARTPTS[v0];'
    f'[1:v]trim=10.5:22.5,setpts=PTS-STARTPTS,scale=1280:900:force_original_aspect_ratio=decrease,pad=1280:900:(ow-iw)/2:(oh-ih)/2:color=black[v1];'
    f'[2:v]trim=0:{s_a},setpts=PTS-STARTPTS[v2];'
    f'[3:v]trim=0:{s_h},setpts=PTS-STARTPTS[v3];'
    f'[4:v]trim=0:{s_f},setpts=PTS-STARTPTS[v4];'
    f'[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[v];'
    f'[v]tpad=stop_mode=clone:stop_duration=6,setsar=1,fps=30,format=yuv420p[vf];'
    f'[5:a]aresample=44100,apad,atrim=0:{a3}[a]" '
    f'-map "[vf]" -map "[a]" -t {a3} -c:v libx264 -preset fast -crf 20 -g 30 -c:a aac -b:a 128k "{WORK}/seg3.mp4"')

# ---------- SEG 4: outro (vo-4) ----------
run(f'ffmpeg -y -loglevel error -i "{V2}/outro.webm" -i "{vo[3]}" '
    f'-filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=6,setsar=1,fps=30,format=yuv420p[v];'
    f'[1:a]aresample=44100,apad,atrim=0:{vo_d[3]}[a]" '
    f'-map "[v]" -map "[a]" -t {vo_d[3]} -c:v libx264 -preset fast -crf 20 -g 30 -c:a aac -b:a 128k "{WORK}/seg4.mp4"')

for i in range(1, 5):
    print(f"seg{i}: {dur(f'{WORK}/seg{i}.mp4'):.3f}s (audio {vo_d[i-1]:.3f}s)")

# ---------- concat ----------
with open(f"{WORK}/concat.txt", "w") as f:
    for i in range(1, 5):
        f.write(f"file '{WORK}/seg{i}.mp4'\n")
run(f'ffmpeg -y -loglevel error -f concat -safe 0 -i "{WORK}/concat.txt" -c copy "{WORK}/base.mp4"')
print("base:", round(dur(f"{WORK}/base.mp4"), 3), "s")

# ---------- subtitles (EN, burned; also emitted as a standalone .srt) ----------
BLOCKS = [
    ("A seller gets paid across borders — and the money rarely matches the invoice.",
     "Every mismatch is an hour of manual work, or a chargeback waiting to happen.",
     "One hundred forty-four real sandbox events. One agent. No spreadsheets."),
    ("Meet the Cross-Border Reconciliation Agent: it reconciles, explains, and acts — inside hard guardrails.",
     "Every action is logged, including the ones the guardrails refuse.",
     "Limits are code: five hundred dollars per invoice, one reminder a day, ten negotiation rounds."),
    ("Two agents haggle: the buyer opens at $400, the seller holds the $450 floor.",
     "They agree — and the deal becomes a validated contract. No action without one.",
     "The same guarded shell creates the invoice, sends it, and records the payment.",
     "The ledger shows the new row, and the agent explains its own decision: matched, variance zero — and why.",
     "It works from a browser too — no install, powered by the same AI layer. Filters under a second, CSV export — every state handled."),
    ("Freelancers lose days to reconciliation. This agent does it in seconds — auditable, guardrailed, on real PayPal data.",
     "Open source: three commands to run it, or just open the URL. PayPal AI Hackathon."),
]

def fmt_t(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

cues = []
for bi, sentences in enumerate(BLOCKS):
    b0, b1 = starts[bi], starts[bi + 1]
    span = b1 - b0
    total_chars = sum(len(s) for s in sentences)
    t = b0
    for si, sent in enumerate(sentences):
        d = span * len(sent) / total_chars
        end = b1 if si == len(sentences) - 1 else t + d
        cues.append((t, end, sent))
        t = end

srt_work = f"{WORK}/final.srt"  # no spaces in the path — the subtitles filter chokes on them
srt_path = srt_work
with open(srt_path, "w", encoding="utf-8") as f:
    for i, (a, b, txt) in enumerate(cues, 1):
        f.write(f"{i}\n{fmt_t(a)} --> {fmt_t(max(b, a + 0.8))}\n{txt}\n\n")
print("srt cues:", len(cues))
import shutil
# "-subs-source" suffix keeps VLC from auto-loading it OVER the burned subs
os.makedirs(f"{EV}/subs", exist_ok=True)
shutil.copy(srt_path, f"{EV}/subs/2026-10-30-stage132-demo-final-en.srt")

final = f"{EV}/2026-10-30-stage132-demo-final.mp4"
style = ("FontName=DejaVu Sans,FontSize=17,Bold=0,PrimaryColour=&H00FFFFFF,"
         "OutlineColour=&H96000000,BackColour=&H50000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=34")
run(f'ffmpeg -y -loglevel error -i "{WORK}/base.mp4" -vf "subtitles=\'{srt_path}\':force_style=\'{style}\'" '
    f'-c:v libx264 -preset fast -crf 20 -c:a copy "{final}"')
print("FINAL:", round(dur(final), 3), "s ->", final)
