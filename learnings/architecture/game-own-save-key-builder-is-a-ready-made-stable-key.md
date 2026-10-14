---
category: architecture
tier: generalizable
sourceGame: ActionAdventureSample
phase: "4"
question: "Does the game persist per-object progression flags (permanent deaths, consumed elements, triggered events, opened chests) — and if so, how does it build the key it stores them under?"
sanitized: true
origin: "unity:architecture/game-own-save-key-builder-is-a-ready-made-stable-key"
---

# Before inventing a stable key, look for the one the game's persistence already built

**Precondition:** the game persists per-object progression flags across runs.

`06 §4.2` requires a cross-run stable id per tracked object and forbids runtime handles and pointers. The reflex is
to add a key field and assign it at spawn. **Check first whether the game already computes one.** A game that
persists "this enemy is permanently dead", "this chest is opened", "this event already fired" must identify those
objects across runs, so it already has a key builder. A common shape:

```cpp
std::string key = flagNamespace + "/" + level.Path() + "/" + entity.AuthoredName();
```

For **level-placed** objects that is a genuine stable identity: level path plus the authored name, both fixed at
authoring time. Reusing it needs no game edit, and it is the identity the game's own save logic already agrees with,
so Ludeo restore and game persistence cannot disagree about which object is which. A sibling tell: a reset or
restart interface with a "get name" accessor — it exists so the game can key objects by name
(`learnings/architecture/level-reset-registry-is-census-batch-iterator-and-reset-seam.md`).

## The hard boundary: level-placed only

**Runtime-spawned instances usually share one name** (the template's), so the key collapses. The honest census
answer is a **split identity scheme**, recorded per `objectType` in `OBJECT_TRACKING.md`:

- **level-placed** → reuse the game's `{level}/{name}` key;
- **runtime-spawned** (wave enemies, summons, loot drops, projectiles) → an assigned per-spawn key (a monotonic
  counter handed out at the spawn site) — real work, and a prerequisite for tracking those types.

Assuming one scheme covers everything looks fine on an authored test level and breaks the first time a moment
contains spawned enemies.

## Checks before committing to it

- **Confirm names are unique within a level.** Most editors permit duplicate names; verify on the real levels
  (duplicated props are the usual offender) rather than assuming the game's convention holds everywhere.
- **Take the key's ingredients, not the namespaced string.** Capture the `{level}/{name}` part so one object has one
  Ludeo key whichever flag namespace the game filed it under.
- **Renaming an authored object breaks both** the game's saved flags and recorded Ludeos — pre-existing, but say
  so: a level-editing change can invalidate old Ludeos.
