---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: "3,7"
question: "Does the game boot through screens (splash, intro, shader warm-up) from which it cannot yet load a level, and is ludeo_Session_Activate called before the boot reaches its menu or idle state? On a cloud machine the platform sends LudeoSelected within a couple of seconds of activation."
sanitized: true
origin: "unity:architecture/activate-late-or-the-cloud-selects-before-the-game-can-load"
---

# Activate when the game can load a Ludeo, or the cloud selects one while it is still booting

**Precondition:** the boot chain passes through screens from which a level load does not work (splash sequence,
intro video, warm-up), and activation runs before that chain finishes.

## What happened

Activation is the starting gun for the platform pushing `LudeoSelected`. Measured on one cloud session: activate
succeeded at T, `LudeoSelected` arrived at **T+1.6 s**, while the game was still in its splash sequence. The restore
asked for the captured level from inside the splash, the load never took effect, and the game sat frozen on the
splash — a white screen with no error anywhere. `Begin` was never reached, so every later
`ludeo_GameplaySession_End` failed with a wrong-state result.

**Why it hid:** on a Studio test machine a human clicks through, which gave the same build ~22 s to reach the menu
before a Ludeo was chosen. Local runs pass too — nothing pushes a selection at you. Only an automated cloud
selection exposes it.

## The fix

- Keep `ludeo_Initialize`, `ludeo_Session_Create` and **every** `AddNotify*` registration early (`05 §4` — they
  must exist before activation completes).
- Make sure a selection can only commit from a state where the game can load a level. Either:
  - have the restore's "reach active gameplay" step (`07 §2.1` step 4) wait, bounded, for the boot chain to reach
    its menu/idle state before requesting the level — this needs no change to activation timing; or
  - **defer `ActivateSession()` to the game's own "menu/idle is up" hook** — the mechanism
    `LAUNCH-AND-READINESS.md` §5 documents for a tick stall (still after the window exists, still before gameplay).
    The doc currently scopes that deferral to an observed stall; this is a second observed reason, so state it in
    the plan and confirm with the user.
- If you defer activation, **arm the readiness gate's timeout when `Activate` is actually called**, not at bootstrap
  — a timer started earlier runs out against an activation that hasn't been sent and reports a false timeout
  (`LAUNCH-AND-READINESS.md` §3.1).
- In a launch that is going to play a Ludeo, skip what only delays it: splash screens and intro cutscenes in front
  of the menu are pure latency in the one timing-sensitive flow.

## The diagnostic that named it in one run

Log the screen or level the restore loads **from**, not just the one it loads:

```cpp
LUDEO_LOG("[Ludeo] loading '%s' for playback (from '%s')", target.c_str(), CurrentScreenName());
```

Working runs said `from 'MainMenu'`; failing runs said `from 'Splash'`, five times in a row. One field was the
whole diagnosis.

Related (activation timing): `learnings/architecture/sdk-activation-competes-with-game-boot.md`,
`learnings/architecture/cloud-needs-idle-ready-state-before-room-open.md`,
`learnings/common-mistakes/gate-activation-on-window-readiness-not-retry-on-failure.md`.
