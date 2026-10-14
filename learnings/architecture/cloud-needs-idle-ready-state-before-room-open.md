---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: "3"
question: "Does the game boot straight into a gameplay level (no frontend menu on its boot path), so an integration could open a Creator room the moment that level is ready?"
sanitized: true
origin: "unreal:architecture/cloud-needs-idle-ready-state-before-room-open"
---

# On the cloud, idle in a "ready and waiting" state before any room opens

**Precondition:** the build is uploaded to run on the cloud, and the game boots directly into gameplay. The rule and
its gotchas are in `LAUNCH-AND-READINESS.md` §6; this is the integration that found it.

## What happened

The integration opened a Creator room as soon as the boot level was game-ready. Locally everything worked. On the
cloud machine no Ludeo ever arrived: the streamer/overlay must attach and the machine must report ready **before** the
platform sends `LudeoSelected`, and a game already recording at boot never presents that idle state. Nothing local can
catch this — there is no streamer to wait for.

A working cloud reference boots to a menu, activates the session, sits idle while the streamer attaches, and only
then receives `LudeoSelected` → restore → gameplay. The idle menu is the ready surface.

## The pattern

Separate "session activated / level loaded" from "room opened / gameplay started". At boot, reach an idle,
interactive state and open nothing. Then:

| Trigger | Flow |
|---|---|
| A validated `LudeoSelected` | Player Flow — commit, restore, then `OpenRoom(ludeoId)` (`07 §2.1`) |
| The player starts playing (closes the idle menu, presses start) | Creator Flow — `OpenRoom` → `AddPlayer` → `Begin` |

With no frontend in the boot path, make the idle state the game's **own pause / in-game menu over the loaded level**:
when the level is ready, freeze (its own pause bit, CR-011 independence), show the menu, suppress auto-spawners, set an
"awaiting start" flag, and open no room.

## Gotchas found the hard way

- Key the start trigger on the **menu state** ("idle menu closed"), and force-unpause on start instead of trusting the
  menu's own resume to clear every pause source.
- Arm the "menu closed → start" detector only once the menu is confirmed up, or the first frame false-starts.
- Enter the idle freeze only after the level has fully loaded/streamed — a freeze over a frame-dependent load hangs.
- Leave idle at the commit of a validated selection, so the Player-Flow load isn't fighting a frozen world.
- Keep per-tick tracking and actions gated on "the run has started", so the idle menu records nothing.

Related (activation timing): `learnings/architecture/activate-late-or-the-cloud-selects-before-the-game-can-load.md`,
`learnings/architecture/sdk-activation-competes-with-game-boot.md`,
`learnings/common-mistakes/gate-activation-on-window-readiness-not-retry-on-failure.md`.
