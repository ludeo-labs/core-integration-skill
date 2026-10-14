---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5,7"
question: "Is a captured moment unplayable, or does it show the wrong thing, while every signal you can reach says the capture succeeded? Before explaining WHY the wrong content was captured, open the video and confirm the recorder was capturing anything at all — a dead recorder produces a full-length, correctly-sized, cleanly-uploaded clip of one still frame."
sanitized: true
origin: "unity:common-mistakes/a-finished-moment-can-still-be-one-frozen-frame"
---

# A moment that uploaded cleanly can still be sixty seconds of one frozen frame

**Precondition:** a moment is wrong or unplayable and you are about to theorise from logs and backend status.

Finishing a boss fight produced moments that could not become a playable Ludeo. Every reachable signal said the
capture worked: the highlight marks succeeded; the SDK log showed `onCaptureVideoRequest` with a clean 60000 ms
window, `Sending video data … bytes` and `Finished uploading video data`; the upload socket closed gracefully; the
backend moved each moment to `ready`; every `video.mp4` returned HTTP 200.

Two explanations were built from that evidence — the room closed early; the window scrolled past the fight — both
wrong, both made **without opening a single video**. Every clip was **one still frame held for the full minute**:
the recorder had stopped taking frames from the game window and never recovered, while everything downstream stayed
healthy.

## The rule: the video is the primary artifact — open it first

Logs, status and byte counts describe the pipeline *around* the recorder. The encoder is constant-bitrate, so a still
frame fills the same budget as a firefight: **file size proves the encoder ran, never that it had anything to
encode.**

```
ffmpeg -hide_banner -i clip.mp4 -vf freezedetect=n=-60dB:d=2 -map 0:v:0 -f null - 2>&1 | grep freeze
```

| Output | Meaning |
|---|---|
| `freeze_start: 0` and **no** `freeze_end` | recorder already dead when the window opened — **the defect** |
| late `freeze_start`s, each with a `freeze_end` | a full-screen menu recorded faithfully — **healthy, don't report** |

## Don't stop at the first correlated event

A session socket dying inside the suspect window looked causal. It was not: a later session dropped the same sockets
and produced clean clips. **A clean control run** — same build, normal play, repeated captures — separates "our
integration did this" from "the SDK did this", and makes an escalation credible. Run one before writing it.

## Bound the onset before explaining it

Each clip is a rolling window ending at its capture: a clip with no freeze proves the recorder alive through its
window; one frozen from `t=0` proves it dead when the window opened. Two such clips bracket the onset — here,
narrowing "unknown" to eighteen minutes and refuting both proposed triggers.

Automate it: a script that walks the SDK's capture log, fetches each clip and classifies it clean / static-UI /
dead-recorder (non-zero exit on the last) turns an hour of watching into one command. Related:
`learnings/common-mistakes/enumerate-captures-from-the-sdk-log-not-from-what-you-were-handed.md`.
