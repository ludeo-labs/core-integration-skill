---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "4,5"
question: "Does in-match randomness visibly drive what happens after Play: which spawn point AI uses, when encounters escalate, loot layout, crowd reactions?"
sanitized: true
origin: "unreal:common-mistakes/random-seed-is-not-optional"
---

# Capture and restore the game's master random seed when randomness drives visible play

**Precondition:** a master seed (or a few seeded random streams) feeds gameplay decisions the player can see.
`06`'s heuristic table rates the seed "track if gameplay-deterministic". When this precondition holds, it is.

## The mistake

The capture covered transforms, health and AI state, but skipped the master seed: "it's just an int, not really
state". It is the **input** to all in-match randomness, and replay without it visibly diverged:

- which of N spawn points the AI used;
- when the intensity/encounter escalation fired which beat;
- which items appeared in which container;
- which bystander fled, surrendered or froze;
- cosmetic randomness (idle animations, ambient sounds, weapon spread).

The player notices: "this isn't what I just did."

## The rule

1. Find the master seed surface, usually on the match/mission/session state (a set-seed or apply-seed function).
2. Capture it on the world/session object. If the game re-mixes the seed as play progresses, capture the
   **current** value per tick, not only the initial one.
3. Restore it in the apply, **before anything after Play draws from it**. Random streams derived from it then
   follow deterministically. Rolls the game makes during the level load are a different case: under the restore
   order they happen before the apply. Those are suppressed or overridden on `IsRestoring()` (`07 §9.11`; for
   procedural content, the generation inputs are the entry identity, `5c` and `procedural-world.md §5`).
4. Add it to the phase-4 census as a question: *"Where is the master seed, and is it captured?"*

**Anti-pattern signal:** "AI spawn order looks slightly different on replay", "the item layout drifts", "the
second bystander behaves differently". These are almost always the seed. Don't paper over them with scripted
respawns; restore the seed.
