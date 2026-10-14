---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "4"
question: "Does the game have AI-controlled entities whose behavior depends on runtime AI state (focus target, movement/behavior mode, perceived enemies) rather than only on their transform and health?"
sanitized: true
origin: "unreal:common-mistakes/track-bot-ai-state-for-player-flow"
---

# AI entities need their behavior state tracked, not just transform and health

**Precondition:** AI decisions read runtime AI state, not just transform and health.

Tracking only position, rotation and health produces bots that **stand still** after the restore: the body is back,
but the AI brain starts fresh — no target, idle mode, unaware of the player. The Ludeo looks broken even though state
was technically restored.

**Minimum per bot:**

- transform + aim/look rotation;
- health / max health, team;
- **focus target** — as the target's stable id, resolved in Pass 2 (`07 §3`);
- **movement/behavior mode** — idle, patrol (+ waypoint), attack, flee;
- **perceived enemies** — a list of stable ids.

**How to apply:** in the `phase 4` census, read the AI's decision code and list every field its first decisions
read (`06 §10.2`). Restore through the AI system's own entry points, in `ApplyDeferred()` if it only accepts input
once ticking (`07 §6`).
