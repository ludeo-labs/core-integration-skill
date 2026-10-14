---
category: common-mistakes
tier: generalizable
sourceGame: StoryPuzzleGame
phase: "5"
question: "Does reaching the captured moment require streaming in a sub-area (a sublevel, room chunk, flashback scene) that the game normally loads through its own trigger — possibly while a different root level is loaded than in the captured run?"
sanitized: true
origin: "unreal:engine-quirks/stream-unregistered-sublevel-with-levelstreamingdynamic"
---

# The game's own streaming call may only toggle sub-areas registered with the current level

**Precondition:** the game streams sub-areas in and out (portal- or trigger-loaded rooms, memory/flashback scenes,
chunked levels), and the restore must bring back the sub-area that was loaded at capture time — part of **reaching
active gameplay** on the captured level (CR-010 step 4).

## The trap

The integration re-streamed the captured sub-area by calling the same function the game's trigger calls. In that
engine, the function only **toggles** sub-areas already **registered** with the currently loaded root level; it
cannot load one the root level doesn't list. The restore loaded a different root level than the one the player
had travelled through, the sub-area wasn't registered there, and the call **silently failed** — one warning line
in the log ("failed to find streaming level …"), nothing else. The follow-up teleport put the player onto geometry
that wasn't there: **falling through the floor into void**.

It is easy to misdiagnose as a restore-position bug: in normal play the sub-area loads fine, because the level the
player actually came through registered it.

## Fix — two options

- **Load it directly**, through the engine's registration-independent "load level instance" path (any level asset,
  explicit transform — use zero offset to put it exactly where it was captured). Best for the restore.
- **Pre-register** the sub-areas with the root level from a post-load hook, so the game's own streaming calls
  resolve them. Best when the game's later triggers must keep working in the replay.

## Streaming is asynchronous — gate on "visible"

Either way the load completes frames later. Gate the teleport/apply on the sub-area reporting loaded **and**
visible (poll in the integration's update, with a timeout and a logged failsafe) — never on the next line. Note
that the restore freeze must not stop the streaming itself; let loading run before the freeze-and-apply step
(`learnings/architecture/frame-dependent-restore-work-runs-unfrozen.md`,
`learnings/architecture/active-gameplay-gate-must-wait-for-async-loads.md`).

## Verify

Capture inside a streamed sub-area, play the Ludeo, and grep the log for the streaming warning; the player must
land on solid geometry in the captured room.
