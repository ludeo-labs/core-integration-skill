---
category: architecture
tier: generalizable
sourceGame: FTPS_Online
phase: "3,5"
question: "Does the moving entity (vehicle, aircraft, character) move through physics simulation, or through a kinematic mover that integrates the game's own speed variables and sets the position directly each frame?"
sanitized: true
origin: "unreal:architecture/floatingpawnmovement-not-physics-for-flight"
---

# Check how an entity actually moves before planning its velocity restore

**Precondition:** the game has moving vehicles, aircraft or characters whose motion the restore must continue.

## What happened

A flight game's design document planned to restore aircraft by setting physics linear and angular velocity. When the
entity was actually inspected:

- its root was a plain transform node, not a simulated physics body;
- motion came from an arcade-style kinematic mover, not the physics solver;
- position and rotation were written directly each frame;
- speed lived in the game's own `currentSpeed` / `targetSpeed` / `maxSpeed` variables.

Setting physics velocity on that entity does nothing. Had it not been caught at planning time, it would have surfaced
in phase 5 after hours of restore code that "applied" and changed nothing.

## The correct capture for a kinematic mover

- **Capture:** transform, the mover's own speed/state variables, health, team.
- **Restore:** the transform through the game's own teleport / set-transform path, then the speed variables.
- **Don't** call physics-velocity setters.

For an entity that *is* physics-simulated, velocity goes through `ApplyDeferred()` — the body must be registered and
the value set before its first physics step (`07 §6`).

## How to detect it early

During code mapping, for every moving type record **what integrates its motion**: the physics solver, a kinematic
mover component, a character controller, or game script setting positions. Read its update path rather than inferring
from the genre. Record it in `CODE_MAP.json` so the restore plan (`RESTORATION_PLAN.md`) picks the right fields.
