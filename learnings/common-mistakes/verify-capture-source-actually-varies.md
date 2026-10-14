---
category: common-mistakes
tier: universal
sourceGame: TacticsGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/verify-capture-source-actually-varies"
---

# Verify every captured attribute actually varies with the gameplay it represents

## The trap

A capture source can be syntactically perfect and semantically dead. An integration captured each unit's
transform as its position. It compiled, wrote plausible coordinates every tick, read back identically, and passed
every restore-vs-data check — **and it was a constant.** In that game the unit's logic entity never moves:
movement updates a grid index and moves a separate visual "puppet" entity, while the logic entity sits at its
spawn point forever. Every capture recorded the battle-start formation regardless of play.

Four rounds of replay debugging (puppet linkage, transform layering, capture cadence) happened on top of this dead
source before a per-tick capture exposed it: the same unit showed its grid index moving while its transform stayed
byte-identical to the start tile.

## Why no check caught it

Restore validation compares the world against the captured data — and faithfully confirms a perfect restore **of
the wrong constant**. Only a **data-vs-gameplay** comparison can catch a dead source.

## The rule

For every attribute in the capture schema: **change the gameplay state it represents, capture again, and confirm
the attribute changed.** Right after a wave's capture path first works (`phase 5`, before its restore is built):

1. Play: move an entity, spend a resource, take damage — one gameplay change per attribute family.
2. Capture two snapshots bracketing the change (two Ludeos, or two dumps of the writer's values).
3. Diff. Any attribute that did **not** change when its gameplay did is a dead source — find the real one. It is
   often a parallel object: the visual entity vs the logic entity, an animation-layer copy vs the logic copy, a
   modified runtime instance vs the original asset.

## Corollary: census the leaf type, not the base you happened to read

The same integration later found its schema missing all of a unit's combat state (armor, weapon-loaded flags, ammo
type, a per-battle objective item) — because the schema was built from the toolkit's **base** unit type while the
game's units were a **subtype** with dozens of extra fields. The miss surfaced only when a cloud replay showed a
full armor bar on a nearly dead unit. For every tracked entity, inspect the **actual runtime leaf type** and its
whole parent chain, then split its fields into placement constants (skip) and battle-dynamic state (capture).

## Corollary: logic/visual split architectures

When the game separates logic from presentation, assume the logic entity's transform is suspect. Position truth is
usually the grid/board index; pose truth is the visual entity. Capture the index for logic restore and the visual
entity's transform for pose — and never write the logic entity's transform on restore if live play never does.
