---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "3,5"
question: null
sanitized: true
origin: "unreal:common-mistakes/never-force-begin-without-onroomready"
---

# Never force `Begin` on a timeout when `RoomReady` hasn't fired

## The anti-pattern

An integration added a wall-clock "grace timer": if the room was open and the player added, but `RoomReady` hadn't
arrived within N seconds (4 s), it set `room_ready = true` itself and called `TryBeginGameplaySession()`, "to avoid
a permanent freeze". A second tier force-unfroze the game.

The result was a **"dies on start"** symptom that is easy to blame on difficulty, restore position or stream lag.
In Player Flow, `RoomReady` is **the viewer pressing Play** (CR-010). Before it fires, nobody is watching or
controlling. Force-beginning unfreezes the moment unattended: AI, timers and hazards run with no input, and the
player is dead or the Ludeo failed by the time a viewer arrives. The log shows gameplay begin, a few seconds
survived, **zero player actions**, then death.

## Why it hides locally and bites on the cloud

Locally, `RoomReady` follows almost immediately, so the timer never elapses and the integration looks right. On
the cloud, the viewer connects over the stream and `RoomReady` can lag `OpenRoom`/`AddPlayer` by seconds, or never
arrive on a bad run. The timer fires first on exactly the runs where it does the most damage. **A bug that appears
only on the cloud is a strong tell that a local wall-clock timer is racing an async platform signal.**

## What to do instead

- **Gate `Begin` strictly on `player_added && room_ready` (and `applied` in Player Flow), and wait.** Don't invent
  a deadline. The platform bounds the wait on its side: if no viewer arrives, the backend times the session out.
  The game should sit frozen, not begin blind.
- **No timer on the click.** In Player Flow the viewer may read the pre-play screen for minutes, so a deadline on
  `AddPlayer → RoomReady` — even a long one that only tears down — false-fires on a perfectly good moment. Bound only
  the `OpenRoom` + `AddPlayer` leg (`learnings/architecture/room-ready-is-the-players-play-click.md`).
- **A missing `RoomReady` is information.** In Creator Flow, check the SDK build against the backend first
  (`11 §9`). In Player Flow, ask whether the viewer ever connected, or whether your own room lifecycle is broken
  (`learnings/common-mistakes/dont-bypass-sdk-when-your-lifecycle-is-broken.md`).

Forcing `Begin` past it turns a diagnosable streaming or lifecycle problem into a silent "the player always dies
instantly" bug.

Related: `learnings/architecture/roomready-is-a-platform-signal-never-force-begin.md` (what `RoomReady` is and how to
diagnose a missing one).
