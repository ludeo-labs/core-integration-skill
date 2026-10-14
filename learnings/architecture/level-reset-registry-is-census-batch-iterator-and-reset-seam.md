---
category: architecture
tier: generalizable
sourceGame: ActionAdventureSample
phase: "4,5"
question: "Does the game have a level-restart/reset contract — a small interface plus a per-level registry that every stateful object registers itself into when it initializes?"
sanitized: true
origin: "unity:architecture/level-reset-registry-is-census-batch-iterator-and-reset-seam"
---

# A level-reset registry solves three phase-4/5 problems at once

**Precondition:** the game implements a level-restart contract: a one-method interface
(`virtual void ResetForRestart(bool soft)`), a per-level list every object with runtime state adds itself to when
it initializes, and a level manager that iterates the list on restart.

When you find one, do not file it as "interesting reset code". It is simultaneously:

1. **The census seed (phase 4).** The implementors are the game's own answer to "what has runtime state worth
   resetting" — very nearly "what is worth capturing". One search for implementors produced a clean type list in
   minutes, where a directory sweep took far longer and still missed types. Seed `OBJECT_TRACKING.md` from it,
   then add what it misses (below).
2. **The batch-registration iterator (`06 §6`).** Objects alive when gameplay begins must be registered in one
   pass. The registry already *is* that list — populated by then, scoped to the current level — so batch
   registration becomes a loop over it, Creator Flow only (skip it while `IsRestoring()`, `06 §6.3`), instead of a
   hand-built enumerator per subsystem.
3. **The baseline-reset seam (`07 §5.4`).** Matched instances must be reset to a clean baseline before restored
   attributes are applied. This contract already does that game-wide, including subsystems you would never think
   to reset by hand (accumulated decals, shared AI-coordination state, destructible remains, animation rebinds).

The three problems are documented in three places (census in phase 4, batch registration in `06 §6`,
reset-before-apply in `07 §5.4`), so it is easy to solve each separately and never notice they share one existing
answer. Grep for the reset contract **at the start of phase 4**: an interface whose only method takes a soft/hard
flag; a per-level list named like "resettables"/"restart objects"; a `Register(this)` call from an init method.

## It is a floor, not a ceiling

- **Singletons and managers are usually absent** — the level identity, the time base, combat/AI arbitration state
  are typically the *owner* of the registry, not members. Add them from the phase-4 mandatory-type rules.
- **Short-lived spawned objects are often absent** (projectiles, drops) — they self-destruct rather than reset.
- **Registry membership is not liveness.** If the game removes an object from its live lists on death while the
  object persists as a corpse or wreckage, keying the tracked set off membership silently drops it — that is a
  terminal-state flag, not an unregister (`06 §3.5`).
- **Check soft vs hard reset before reusing it as the restore reset.** A soft restart commonly preserves map reveal
  and similar progression — more or less than the baseline you want.

Related: `learnings/architecture/game-own-save-key-builder-is-a-ready-made-stable-key.md`.
