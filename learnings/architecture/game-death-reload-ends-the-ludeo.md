---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: "3"
question: "Does the game handle player death by reloading the level, returning to a load screen or otherwise tearing down the gameplay world, instead of respawning in place?"
sanitized: true
origin: "unreal:architecture/death-reload-ends-ludeo-decouple-terminal-state"
---

# A game-side death → reload ends the Ludeo whatever its goals say — keep death and "experience over" apart

**Precondition:** on player death the game reloads the level or otherwise destroys the gameplay world (common in
arcade, roguelike and wave-survival loops).

## The problem

The reload is a game-initiated exit: the level-unload path ends the gameplay session and closes the room (CR-007, as
it must). In a Player-Flow replay that means **death always ends the Ludeo**, whatever the Ludeo's goals say. A Studio
Lab goal like "dying is not a failure — keep going toward the objective" can never be honored: the game destroys the
world before the platform can apply any pass/fail decision. Death has been hard-wired as terminal upstream of the
platform's scoring.

## The principle

Separate "what happened" from "is the experience over":

- **Death is the `Death` action** (fired in both flows, `06 §7`). The platform's goals decide what it means.
- **The experience ends on platform markers:** in Player Flow the backend ends the Ludeo through
  `PauseGameRequest` (`05 §6.11`); the game ends it only on an interrupt — `BackToMenuRequest`, the next validated
  `LudeoSelected`, the player quitting.
- **If the game cannot survive a death without tearing down the world** (no in-place respawn), record that as a
  structural limit in the lifecycle plan and tell the human: this integration cannot support non-terminal-death goals
  until the game can respawn in place. Don't accept it silently, and don't paper over it.

In a Creator-Flow run the reload legitimately ends that recording — the room follows the gameplay session (`03 §2.8`).
The limit is the replay case. It is harmless for a mode where death genuinely ends the run, but it is the wrong
*reusable* pattern: it bakes a game-over policy into the session lifecycle that the platform is meant to own.

Related: `learnings/architecture/roomready-is-a-platform-signal-never-force-begin.md` — the begin side of the same
"the platform owns the experience lifecycle" principle.
