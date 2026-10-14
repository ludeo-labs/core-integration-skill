---
category: architecture
tier: generalizable
sourceGame: Lyra
phase: "3,6"
question: "Does opening the game's in-game menu leave the simulation running (common in multiplayer-style games), so that checking the engine's pause state never sees it?"
sanitized: true
origin: "unreal:architecture/menu-overlay-detection-for-nonludeable, unreal:architecture/pause-menu-non-ludeoable, unreal:architecture/player-flow-pause-support"
---

# A menu that doesn't pause the engine is invisible to a pause poll — detect the menu itself

**Precondition:** the game's in-game menu opens over a running simulation — typical of games built on multiplayer
rules, where "pause" doesn't stop the world.

## The problem

An integration that reports pauses by polling the engine's paused state never sees this menu: the state never flips.
The objective timer keeps counting down through every menu visit, because only `PauseLudeo` reaching its Global
Trigger stops it (`06 §7.3`).

## The fix

Detect the menu directly — poll the UI layer stack or menu manager for an active menu screen
(`learnings/architecture/single-ui-state-enum-as-overlay-signal.md` when the game has one UI-state value) —
and on the open transition, drive the game's pause primitive, so one detector reports the pause. Close → resume.

## The pause menu is always on the list

When listing non-gameplay segments, include the in-game pause menu alongside frontend menus, loading screens and
cutscenes. Classify it correctly: it is a **pause** — `PauseLudeo` / `ResumeLudeo` in either flow, with the local
tracking pause of `06 §8.1` — **not** a non-ludeoable area (`StartNoneLudeable` keeps the timer running, `06 §8.5`).

## Pause support is not optional

Don't mark pause "N/A" because the game is multiplayer-style and never really pauses. Player Flow needs a real
**simulation freeze** primitive, with independent bits for the restore freeze, the overlay pause and the idle state
(CR-010, CR-011). Two separate things then use it, and neither replaces the other:

- the SDK's `PauseGameRequest` / `ResumeGameRequest` (cloud Player Flow only) **request** a freeze;
- **every** pause, that one included, must **report** `PauseLudeo` / `ResumeLudeo`, exactly once per transition
  (`phase 6 · task 2` Step 5).

The converse trap: if the request handler freezes through a path the detector doesn't watch, the SDK-requested pause
goes unreported — send the action from the shared pause primitive, with a span guard so it is reported once
(`learnings/common-mistakes/send-pauseludeo-on-every-pause-transition.md`).
