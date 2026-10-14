---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Does the game's 'gameplay started' signal fire before the player entity has been spawned?"
sanitized: true
origin: "unreal:common-mistakes/pawn-not-spawned-at-action-phase-start"
---

# The "gameplay started" signal can fire before the player exists

**Precondition:** the gameplay-phase-started event and the player spawn are separate steps.

On one game, that event fired about 112 frames **before** the player spawned. A restore triggered on it found no
player and skipped player restoration.

When reaching active gameplay (`07 §2.1` step 4), wait until the player entity actually exists. Bound the wait. If
it runs while the simulation is frozen, drive it from a tick source that keeps running while paused.
