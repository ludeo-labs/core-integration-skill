---
category: save-systems
tier: generalizable
sourceGame: PlatformerSample
phase: "4"
question: "Are you reusing the game's own per-object save id as the Ludeo stable id — and is that id a serialized field on a template / prefab / archetype, populated per level by an editor tool someone has to remember to run?"
sanitized: true
origin: "unity:save-systems/serialized-id-keys-collapse-where-the-id-minter-never-ran"
---

# A serialized per-object save id is only a stable id where the minter actually ran — measure it

Applies when the game's per-object save identity is authored data. Reusing that identity as the Ludeo stable id
(`06 §4.2`) is the right instinct: no game-code edit, and the integration agrees with the game's own persistence about
which object is which. The trap is *how* the identity is produced. A common shape:

```cpp
struct SaveIdentity {             // a component on the TEMPLATE; per-instance value stored as a level override
    std::string id;               // authored empty on the template
};

// Editor-only tool, run by hand per level: writes a fresh GUID into every SaveIdentity instance in the open level.
void IdMinterTool::GenerateIds(Level& level);
```

Run on a level, the tool writes a distinct id into each instance as a per-instance override — genuinely stable
identity, **for the levels where someone remembered to run it.**

Everywhere else, instances inherit the template's value — usually the empty string it was authored with. Every
instance of that template in that level keys to `""` and collapses onto one entry. The game's own save has the same
bug, so nothing in the game surfaces it; those objects have simply never round-tripped, and the symptom (one of five
pickups reappearing after a load) reads as an ordinary bug.

## Measure it from the level data — cheap and exact

Per level, per template, compare:

- **instances** — references to the template in the level file;
- **instances carrying their own id** — instance overrides that set the id field.

Instances > ids means the remainder inherit the template's value; check the template to learn what they collapse
*to*. Collect every id value across all levels into a multiset while you are there, to catch the **second** failure
mode — worse because the ids look present:

> **Duplicate minted ids.** Four instances of one pickup template in the same level carried the *same* GUID. The tool
> had run and the overrides existed, yet the key still collapsed 4 → 1. A presence check passes; only a uniqueness
> check catches it.

## What this changes in phase 4

The honest census output is a **per-level, per-template key-coverage table** in `OBJECT_TRACKING.md`, not one line
saying "the game has a stable id".

1. **It helps pick the capture level.** Coverage is usually best where the team last worked; with content coverage it
   is a better argument for the wave-1 capture level than content alone.
2. **The gaps are prerequisites, not caveats.** A type with a collapsed id in the capture level cannot be tracked
   there. Re-minting is a data-only action — cheap, but it must happen *before* the wave, and it invalidates nothing
   because no Ludeos exist yet.
3. **Say plainly that it is pre-existing** — a defect in the game's save data that the integration measured, reported
   as a finding with a one-step fix, not as integration work.

**"The game already has a stable id" is a claim about the id's values, not about the existence of an id field.** Verify
presence and uniqueness, per level, per type — and expect the answer to differ per level. Related:
`learnings/architecture/game-own-save-key-builder-is-a-ready-made-stable-key.md`.
