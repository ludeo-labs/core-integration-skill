---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/direct-field-assignment-bypasses-setter-side-effects"
---

# Restoring a field by direct assignment can skip the setter's side effects

## The mistake

The restore wrote a member directly, although during gameplay that field is only ever written through a setter
that also does real work:

```cpp
// bypasses SetProgressionIndex(), which also rebuilds the cached spawn orders
director.m_progressionIndex = snap.progressionIndex;
```

After the restore the wave director had the right progression index and an **empty** cached spawn-order list. Its
order selection iterated that cache, returned nothing, and no squads ever spawned. It looked like "the wave just
died".

## Why it's easy to miss

The assignment compiles and runs, and reading the field back gives the right value. The bug shows only in code
that consumes **derived** state the setter maintains: caches, side tables, broadcasts, counters. You don't see
those unless you read the setter.

## The rule

For every field you restore by direct assignment, **read the setter the game uses** and list what else it does:

- rebuilds a cache or derived array?
- fires a notification or event?
- updates a side table, index or registry?
- marks state dirty for networking, saving or UI?

Then either **call the setter**, if all its side effects are safe during a restore, or **assign and mirror the
side effects you need** inline. In the incident the progression-changed notification was deliberately skipped,
since listeners shouldn't react to a restore, while the cache rebuild was mirrored:

```cpp
director.m_progressionIndex = snap.progressionIndex;
director.RebuildSpawnCaches();   // what SetProgressionIndex() normally does; its notification is skipped on purpose
```

Decide each side effect explicitly and note the decision in `RESTORATION_PLAN.md`.

## How to apply

Audit every direct-assignment line in the restore path, find the matching setter (`SetX`, or whoever writes the
field during play) and check it. For aggregate side effects that span many entities, recompute from ground truth
after the apply instead (`07 §11.2`). The opposite failure, calling a live-play setter that fires one-shot effects,
is `learnings/common-mistakes/restore-through-the-initial-state-path-not-the-live-play-setter.md`.

Related: `learnings/common-mistakes/choose-the-restore-write-path-per-field.md` (the per-field decision rule this
lesson is one row of).
