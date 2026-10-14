---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: "4"
question: "Are the gameplay entities placed in the level data rather than spawned at runtime — verified both in the level data and in the code path that looks like a spawner?"
sanitized: true
origin: "unreal:architecture/level-placed-units-make-restore-matching-trivial"
---

# Level-placed entities make restore matching trivial — verify placement before designing spawn reconstruction

**Precondition:** the entities in scope are authored into the level, not created at runtime. Verify it with **two**
checks before relying on it:

1. **The level data** lists the entity instances (and their visual counterparts).
2. **The suspected spawner's code path.** In one game the "battle manager" created at battle start turned out only to
   *register* units already placed in the level — it spawned nothing. Reading that one function removed the whole
   spawn-reconstruction problem.

The second check is mandatory: level data shows placed entities only; runtime spawns are invisible to it.

## Why it matters

Loading the level reproduces the capture-time entity set, with **stable, level-authored names**. So:

- **Identity** is the authored name, captured as an attribute; the restore looks it up in a map (`07 §3.1`
  `match_or_spawn` reduces to *match*). Keep a fallback — archetype + team among unclaimed instances.
- **Dead or absent at capture** → remove the placed counterpart through the **game's own removal function** — a clean
  "remove unit from game" path rather than the animated death sequence — and never a raw destroy, which skips turn
  order, grid occupancy and other bookkeeping. Apply `07 §5.4`'s guard: zero captured instances of a type the level
  still has means a truncated capture, not a cleared level.
- **No spawn reconstruction**: no archetype round-trip, no destroy-the-defaults sweep. Whole classes of bugs —
  duplicates, spawn-position drift, missed init cascades — are out of scope by construction.

## Watch out

- Keep runtime-spawn handling anyway for summons and reinforcements: track them in Creator Flow and give them the
  archetype path in restore.
- If the game later adds a runtime-spawned mode for the same scope, the fallback matching must carry the weight —
  build it in from day one.
