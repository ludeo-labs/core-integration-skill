---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "6"
question: "Do dead entities stay in the world after death (ragdoll, corpse, death animation, dissolve, pooling, a delayed lifespan) instead of being destroyed at the moment they die?"
sanitized: true
origin: "unreal:common-mistakes/ondestroyed-fires-on-gc-not-on-kill, unreal:common-mistakes/ondestroyed-not-for-bp-death, unreal:common-mistakes/ondestroyed-vs-endplay-timing"
---

# Death is not destruction: detect kills and deaths by an alive-state transition

**Precondition:** an entity's "destroyed" callback isn't guaranteed to fire at the moment it dies.

Three games, one mistake: the `Kill` / `Death` action was hung on the engine's **entity-destroyed** callback.

- **Corpses persist.** Enemies stayed as ragdolls, so the destroyed callback fired only on garbage collection or
  pool return, never during play. No kills were reported.
- **Death animations and dissolves.** Destruction happened much later, or never in the session.
- **Delayed lifespan on the player.** The pawn lived on for 5 s after death. If the level ended or the game exited
  first, the integration's own teardown ran before the destroyed callback, and the `Death` was lost.

Where the game *does* destroy the entity at death (one game swapped dead AI for a separate corpse object), the
callback works. Check which case you're in.

## Fix

Poll an alive signal per tracked entity and fire on the **true → false edge**. Prefer the game's own alive/dead
flag over `health <= 0`:

```cpp
for (TrackedEntity& t : registry) {
    const bool alive = t.entity ? t.entity->IsAlive() : false;   // a vanished entity counts as dead
    if (t.wasAlive && !alive)
        LudeoManager::Get().SendAction(t.isPlayer ? "Death" : "Kill");
    t.wasAlive = alive;
}
```

Set the baseline `wasAlive` when you register the entity, so the first poll can't fire. Run the detector in both
flows (`06 §7`), and keep the destroyed callback only as a backup.

The action name stays canonical. If goals need the victim's type, send an additive allowlisted action next to
`Kill`; don't fuse it into the name
(`learnings/common-mistakes/name-actions-from-player-perspective.md`).
