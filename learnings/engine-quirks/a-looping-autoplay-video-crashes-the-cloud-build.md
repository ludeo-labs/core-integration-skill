---
category: engine-quirks
tier: generalizable
sourceGame: RoguelikeSample
phase: "7,8"
question: "Does the game play video through Windows Media Foundation (directly or via a video library), and does any video start automatically and loop — especially one embedded in always-loaded UI that is rarely or never shown?"
sanitized: true
origin: "unity:engine-quirks/a-looping-playonawake-video-crashes-the-cloud-build"
---

# A looping autoplay video crashes the cloud build, and never the local one

Applies when the game decodes video through Media Foundation. Ludeo's cloud runs the Windows build under Proton/Wine,
whose Media Foundation is far less forgiving than Windows'.

The cloud build died mid-playback, reproducibly, on every machine, with an identical dump each time:

```
EXCEPTION_INVALID_HANDLE (0xc0000008)  at ntdll +0x66fe8
frames:  ntdll ×3 → rtworkq.dll +0x4dc6 → ntdll ×2 → kernel32 → ntdll
```

`rtworkq.dll` is the **Media Foundation real-time work queue**; the whole MF stack was resident in the process
(`mfplat`, `mfreadwrite`, `msmpeg2vdec`, `msvproc`, …). The cause: a tutorial-video popup inside the gameplay UI was
configured to **start automatically and loop**, and nothing in the code ever started it explicitly. So the clip began
at every gameplay-level load and looped forever behind a popup that was never shown, keeping MF in permanent
seek-and-restart churn. Turning autoplay off was the whole fix: five consecutive cloud replays clean, where the
previous build crashed every time.

## Why it is invisible until it isn't

- **It never reproduces locally.** Real Media Foundation tolerates the handle churn; Wine's raises
  `EXCEPTION_INVALID_HANDLE`. A clean run on a Windows machine is the expected result either way — not evidence.
- **Nothing references it.** Grepping for play calls finds nothing to guard; the behaviour lives in a data flag
  (a UI layout, a level file, a widget definition), not in code.
- **It arrives indirectly.** The video lived in a UI template instantiated at runtime, so searching the gameplay
  level's own data found nothing. Search every data file type that can carry a video component.

## Do this

Before the first cloud build, enumerate every video source in code **and data**, and kill the pairing that matters:
*autoplay on* + *loop on* + reachable from an always-loaded level or UI.

**A runtime guard that stops videos is not a fix.** By the time you can stop one, Media Foundation is initialised and
its work-queue threads live for the process lifetime. Only never starting the video avoids MF. A guard is still worth
shipping as an instrument — logging what it stopped, within a second of each level load, is what found this one.

## Hand the trade-off back

If autoplay was the only thing starting the video, turning it off means the popup shows a static first frame when it
is legitimately displayed — something must start it on open. Flag that to whoever owns the UI rather than silently
changing what players see.

For pulling the dump off the cloud machine, see
`learnings/engine-quirks/the-cloud-crash-dump-is-inside-the-container.md`.
