---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "3"
question: "Does the game boot through a multi-step asynchronous chain (a boot state machine, login, metadata fetch, loadout setup, asset-load callbacks that fire 'next frame') between startup and its first menu?"
sanitized: true
origin: "unreal:architecture/sdk-activation-competes-with-game-boot"
---

# SDK activation traffic can starve the game's async boot chain

**Precondition:** the game's boot is a chain of asynchronous steps whose callbacks fire between frames, and
`ludeo_Tick()` runs on the game thread (CR-005). `LAUNCH-AND-READINESS.md` §5 holds the rule; this is the integration
that found it.

## What happened

With the SDK enabled, the game hung on its "getting ready" loading screen forever. The log showed `ludeo_Tick()` running
about once every 28 seconds during boot, the SDK working through activation (authentication, a ~19 KB configuration,
the attribute and action schemas, activation complete) inside those rare ticks — and the game's
"character loadouts set up" callback, which should have fired the next frame, never firing.

`ludeo_Tick()` processes every pending SDK network response and its callback on the game thread. Slow responses during
activation can make single ticks hold the thread for seconds, and a boot chain built on "next frame" callbacks stalls
behind them. A simpler reference game with the same activation timing booted fine — it had no async boot chain to
starve.

## Mitigations, cheapest first

1. **Keep rooms and per-tick tracking out of boot and menu states.** In this game the integration was also running in
   the menu level — opening rooms and tracking — which was most of the SDK traffic in the boot window. No room before an
   explicit start trigger (`LAUNCH-AND-READINESS.md` §3, §6).
2. **Defer activation** to the game's "boot done / menu ready" hook instead of straight after `ludeo_Initialize()` —
   the one documented exception to activating immediately (`LAUNCH-AND-READINESS.md` §5).
3. **Report it to the SDK owners** with the tick timings: a tick that blocks for seconds is an SDK-side issue.

Never skip or throttle `ludeo_Tick()` to "fix" it — that breaks every callback (CR-005).

## How to check

After wiring activation (phase 3), boot with the SDK enabled and confirm the game reaches its menu as fast as with it
disabled. If it hangs or slows, log `ludeo_Tick()` frequency and duration during boot: under one tick per second, or
ticks lasting seconds, means the SDK is starving the boot.

Related (activation timing): `learnings/architecture/activate-late-or-the-cloud-selects-before-the-game-can-load.md`,
`learnings/architecture/cloud-needs-idle-ready-state-before-room-open.md`,
`learnings/common-mistakes/gate-activation-on-window-readiness-not-retry-on-failure.md`.
