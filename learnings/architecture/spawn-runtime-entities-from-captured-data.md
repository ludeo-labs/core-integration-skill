---
category: architecture
tier: generalizable
sourceGame: multiple
phase: "5"
question: "Does the game create gameplay entities at runtime (waves, summons, player-placed objects, randomly placed bots) that do not exist when the level loads?"
sanitized: true
origin: "unreal:architecture/player-flow-spawn-not-defer, unreal:architecture/bot-spawning-player-flow"
---

# Reconstruct runtime-spawned entities in Pass 1 — don't wait for the game's spawner

**Precondition:** some captured entities were created at runtime — wave enemies, placed turrets, bots with random
placement — so a fresh level load does not contain them.

## The mistake

Deferring them: loading the level and hoping the game's own spawner (timer-, credit- or wave-driven) produces "the
same" entities, then overriding their state. The spawner's timing, identities and positions don't match the capture,
so the restore races it and the replay drifts.

## The pattern

The restore owns their reconstruction (`07 §3.1`, `match_or_spawn`):

1. **Capture what the factory needs.** Per entity: its stable id (`06 §4`), the archetype key the game's spawn factory
   accepts (prefab / class / template id), transform, and the state fields.
2. **Match before spawning.** Look the stable id up among the instances the level already has; spawn only when it is
   absent. Positional heuristics (nearest instance of the same archetype) are a last resort for entities with no
   stable id.
3. **Spawn through the game's own spawn primitive**, not a raw engine instantiate — the primitive assigns team, AI
   controller, collision and manager registration. A bare instantiate yields an entity that looks right and doesn't
   behave.
4. **Skip the dead.** An entity dead at capture is not spawned (or comes back as a tombstone / corpse, `06 §3.5`).
5. **Old captures.** If an older capture lacks the archetype key, resolve it from the type name and log the fallback.

## The game's spawner during the replay

Gate the spawner's **trigger** on `IsRestoring()` (start-of-run waves, `07 §9.11`) — never the spawn primitive that
Pass 1 uses (`07 §11.1`). Restore the spawner's own cursor (wave index, budget, timers) so that after Play it continues
from the captured point instead of re-creating the restored wave. Then recompute derived counts (alive enemies,
remaining objectives) from what was actually spawned (`07 §11.2`).
