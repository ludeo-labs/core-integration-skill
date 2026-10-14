---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5,8"
question: "Do any enemy abilities toggle collision or ground-check OFF at a start stage and back ON only at a later stage (a leap through obstacles, a burrow, a teleport fade)? Replayed fights maximize mid-ability interrupts, so every such pair must be restored on ALL exit paths."
sanitized: true
origin: "unity:common-mistakes/interrupt-unsafe-ability-toggles-strand-enemies"
---

# Interrupt-unsafe ability toggles strand enemies below the world

Applies when enemy abilities disable the actor's own collision or ground-check at a start stage and re-enable it
only at a later stage.

A leap ability turns the actor's collision off at its start stage (so it can pass over obstacles) and back on only
at the landing stage. The ability's finish/stop cleanup restores gravity, kinematic mode and buffs — **but not the
toggle**. Any interrupt between the stages (a player stagger, a wave transition stopping the ability, the death of
the ability's driver) leaves the actor permanently non-colliding with gravity re-armed by the cleanup: it falls
through floor and scenery until the game's kill plane deletes it. The viewer sees "the enemy was inside the rock,
then gone."

**Why replays surface it when live play rarely did:** a Ludeo is one dense fight replayed again and again by a
player comparing against the video, and restored mid-fight state plus a fresh player's interrupt pattern hits the
mid-ability window far more often than a single live run. A kill plane that silently cleans up fallen actors is the
game team's own tell that falls were a known, tolerated phenomenon.

**Fix shape (small, game-side):** track the pending toggle in a flag set at the disable and cleared at the
re-enable; restore the toggle in **both** the finish-style and the stop-style cleanup paths, guarded on the actor
being alive so the death path's own collision handling isn't stomped. Reset the flag in the ability's pooled
re-init.

**Same disease, different site:** a ragdoll knockdown whose stand-up snaps the actor's root to wherever the hip
ended — with no ground validation — plants survivors **under** the floor when a heavy hit drags the hip through
geometry. Probe downward at stand-up: snap to the hit, and if there is no floor under the hip at all, leave the root
where the knockdown began.

**Diagnosis shortcut for both:** actors found at impossible depths with full health and AI running, whose fall
**start** time (back-computed from depth with `0.5·g·t²`) lands mid-fight rather than at spawn. Placement was fine;
a mid-fight event removed their footing. Check this before suspecting the restore's position apply.
