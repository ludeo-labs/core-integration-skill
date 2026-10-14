---
category: common-mistakes
tier: universal
sourceGame: PlatformerSample
phase: "3,5"
question: null
sanitized: true
origin: "unity:engine-quirks/timescale-zero-stops-the-sdk-notification-pump, unity:engine-quirks/verify-the-timescale-pump-claim-against-the-installed-plugin"
---

# Drive `ludeo_Tick()` from a path the freeze does not stop — or the callback you wait on never arrives

The restore is built around waiting **frozen** on SDK callbacks: the apply runs under the freeze, the finished moment
is held frozen through `OpenRoom` → `AddPlayer`, and it stays frozen until `RoomReady` — the viewer pressing Play,
which can be minutes away (CR-010, `07 §2.1`). The overlay pause (CR-011) freezes during playback too. Every one of
those callbacks is delivered by `ludeo_Tick()` (CR-005), and the integration's queued operations (`03 §8.3`) drain in
the same place.

**If the freeze stops the code path that calls `ludeo_Tick()`, the callbacks stop with it.** Observed with an engine
plugin that pumped SDK notifications from a loop the freeze halted:

```
five minutes of total log silence, process alive, no error of any kind
```

`RoomReady` was never delivered; the begin gate waited for a callback the SDK could no longer hand it. Nothing logs,
nothing throws, the process looks healthy — the most expensive shape of bug to diagnose from outside, and pure
self-inflicted deadlock.

In a C++ engine you place the tick yourself, so the places it goes wrong are yours:

- inside the **fixed-step accumulator loop** — at a time scale of 0 it runs zero iterations per frame;
- inside the "game is playing" branch of the update that the pause state skips;
- inside a system the freeze suspends (the simulation tick, the world update);
- inside a frame loop that stops on window focus loss or while minimized.

## The rule

Call `ludeo_Tick()` — and drain the operation queue — **once per frame from the outermost main loop**, unconditionally,
outside anything the freeze, the pause, focus loss or a loading screen can stop. Then freezing across an SDK wait is
safe, and you can keep the freeze the docs require.

## Don't drop the freeze to "fix" a hang

The opposite mistake is worse. One integration, told that "freezing stops the notification pump", skipped the
required pre-play freeze; the plan quoted the learning and a reviewing agent confirmed it — from the learning's body,
not from the code. Without the freeze everything not explicitly suppressed (physics, triggers, moving platforms,
hazards, run timers) keeps running until Play, and the restored state decays before anyone sees it — which then looks
like a restore bug. If callbacks stop under the freeze, **move the tick**; never move the freeze. (The remedy first
recorded for this hang — freeze only inside `RoomReady` and apply there — contradicts CR-010 and must not be used.)

## Verify

Freeze the game (debug hook), issue an async call (e.g. `ludeo_Session_GetLudeo`), and confirm its callback still
arrives while frozen. Grep the call site of `ludeo_Tick()` and read every condition and loop that encloses it.
