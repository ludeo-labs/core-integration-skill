---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: "4,5"
question: "About to call the restore 'done' while later waves (puzzles, doors, chests, platforms, pickups) are still deferred, in a game that has a save system with a per-object save interface? Diff the interface's implementors, level by level, against what you capture first."
sanitized: true
origin: "unity:architecture/audit-every-level-against-the-games-own-save-list-before-calling-restore-done"
---

# Audit every level against the game's own save list before calling the restore done

**Precondition:** the game has a save system whose stateful objects implement a common save interface, and the
wave plan (`phase 5`) has parked some census types in later waves.

## What happened

The first restore wave (player, enemies, companions, pickups, run counters) passed its gate and the integration
moved on. QA then found the gaps **one at a time, each in a different level**: a floor button whose door came back
shut, a collected key back on the ground with an empty HUD slot, a one-shot power-up that fired the normal attack.
Each was a full report → diagnose → fix → build → re-record round trip, and all three were types the census had
already listed — as deferred. **A deferred wave is a silent gap**; nothing tells a viewer which wave a mechanic is in.

## The check

1. **Take the game team's own list of what is stateful** — every implementor of the save interface. It is the
   studio's answer to "what must survive a reload" and beats any census derived by reading fields. Diff it against
   what the `LudeoStateAdapter` captures.
2. **Map it level by level, resolving nested templates.** If levels place reusable templates (prefab-like
   composites) that contain other templates, a flat search of a level file misses instances inside templates, and
   counting per-instance overrides over-counts (one integration over-counted enemies ~6× this way). Count
   recursively: direct instances + Σ over template instances of that template's count. **Validate the table against
   one runtime number** (the enemy count your capture logs) before trusting the rest.
3. **List every type present in a level that the census never names.** Dismiss the visual/audio/UI ones explicitly;
   read the handful that are not.
4. **Rank what is left by what a viewer notices:** rewards that can be taken twice (chests closed again), progress
   that silently resets (half-solved puzzles, switches), paths that close again, and clips that start on something
   moving (platforms).

## Not sufficient on its own

The save list misses state the game never persists. The one-shot power-up was a public flag on a player-owned
component armed by a respawning pickup — not saved, because the game never saves mid-power-up. After the diff,
also sweep mutable fields on **player-owned** components that pickups or triggers write (`06 §9.6`).

## Adding coverage without breaking recorded moments

Where the meaning fits, put a new kind into an **existing** id ledger (a pressed floor button is "a door that is
open"; a collected key is "a collected pickup") so the recording format does not change. When a new attribute is
unavoidable, read it as **optional** — absent means "leave the authored default" — so old moments degrade instead of
failing (`11 §6.8`). Say that old moments lack the new information and ask for fresh recordings to test.

The save interface is also the cheapest restore primitive:
`learnings/save-systems/use-the-games-own-per-entity-save-interface.md`. Related:
`learnings/architecture/check-what-actually-ships-before-scoping-per-entity-work.md`.
