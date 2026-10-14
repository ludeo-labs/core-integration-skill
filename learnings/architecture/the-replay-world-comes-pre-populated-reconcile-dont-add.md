---
category: architecture
tier: generalizable
sourceGame: multiple
phase: "5"
question: "Does the replay rebuild the world through the game's normal level-build path, and does that path populate it on its own (level-start AI/NPCs, pre-spawned waves, default enemies, loot) with types the restore also creates from the capture?"
sanitized: true
origin: "unity:architecture/the-replay-world-comes-pre-populated-reconcile-dont-add, unreal:common-mistakes/destroy-default-spawns-before-restoring-tracked"
---

# The replay world comes pre-populated — reconcile, don't add

**Precondition:** the restore reaches active gameplay through the game's own level build (`07 §2.1` step 4), and that
build populates the level with default entities (guards, civilians, a room's first wave, loot) of types the restore
also creates from the capture.

A restore that rebuilds the level through the game's construction path inherits everything that path does. The
obvious symptom is duplicate characters everywhere — the level's default population plus the captured one
(`07 §9.10`). The quiet one is worse: one game's level build pre-spawned each room's first enemy wave, **dormant and
invisible** until the room's trigger ran, and the restore spawned the captured enemies on top and removed nothing.
Cleared rooms were haunted by invisible dormant enemies the game's counters reported alive; a room's count read 22
where the recording said 20; kill-ratio wave logic computed against polluted totals, so encounters resolved after
half the expected kills. Nothing visible on screen — only count checks caught it.

## The rule

Restore is a **reconciliation** between two populations (`07 §5`), not an insertion. Pick one strategy per type and
record it in `RESTORATION_PLAN.md`:

- **Reconcile by identity** (the core default, `07 §3.1`, `§5.4`): match placed instances by stable id, then reset
  and apply.
- **Clear, then spawn** — when the defaults have no identity you can match, or the recording shows the state **in
  progress** (a fight running): at the top of the frozen apply, remove the world-build population of the tracked
  types through the game's own release/pool path, then run Pass 1. Wipe the manager's bookkeeping lists too, dead and
  alive, or the counts stay polluted (and recompute derived aggregates after the apply, `07 §11.2`).
- **Keep the world's own and skip the captured twins** — when the recording shows the area **untouched** (a room never
  triggered): they are the same entities captured dormant. With seeded spawn rolls, the world's own roll reproduces
  the recorded composition. Leave the trigger armed so the game runs it forward (`07 §11.1`).

## Guardrails

- Never clear the player, or types another system owns (traffic vehicles, say).
- If the capture holds zero objects of a type, don't clear it (`07 §5.4`;
  `learnings/architecture/an-empty-bucket-must-not-mean-everything-died.md`).
- Gate re-population **triggers**, not the spawn primitive the restore itself uses (`07 §11.1`;
  `learnings/common-mistakes/gate-spawn-trigger-not-primitive-in-player-flow.md`).
- Watch for the game's own list bugs: here, level-placed enemies were added to the alive list twice, so a naive
  per-entry release would have double-released.

## Verify both sides

Check each manager's alive count against the recording's at both checkpoints (`11 §10`), and register a check that
untouched rooms stay **untriggered** — the regression on that side is silent too.
