---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Is an OWNER reference captured so the restore can re-register spawned entities with whatever produced them — and does that owner hold MORE THAN ONE collection of spawned entities?"
sanitized: true
origin: "unity:common-mistakes/owner-attribution-is-not-enough-restore-needs-the-owners-specific-collection"
---

# Capturing "who owns me" is not enough — the restore has to re-register into the owner's SPECIFIC collection

Applies when restored spawned entities are re-registered with their owner, and the owner keeps several spawned-entity
collections.

The standard move for restoring runtime-spawned entities: the spawner's population counter only moves through
incremental side effects, so the restore recomputes it from ground truth by re-registering each restored entity with
its owner (`07 §11.2`). So the capture adds `owner_key`, and the restore gets a seam `RegisterRestoredSpawn(entity)`.
Both sides look complete; the plan's cross-entity table closes.

**Check how many spawned-entity collections the owner has.** In the observed project one boss had three:

| Collection | Lives on | What it gates |
|---|---|---|
| continuous minion drip | the boss controller | a live cap (`count < max`) that decides whether the boss keeps spawning |
| summon-attack list | a child state controller | an "any alive?" test that decides whether the attack may re-fire |
| cocoon-attack list | another child state controller | teardown only |

The capture walked all three and recorded the same thing for every hit — the boss's key. The restore knows a minion
belongs to that boss and cannot know which list produced it, while the seam it must call is a **method on one
specific list**. Three approved seams; the data to choose between them was never captured.

## Why it's invisible until the restore is written

Capture-side the lists are interchangeable — any of them answering "owned" is complete. Restore-side each gates
different forward play. The asymmetry appears only when you write the register call and find its argument has no
source; the plan row `owner_key → id map → RegisterRestoredMinion` is true for all three seams, so review passes it.

## What to do

- **At capture:** if the owner has more than one such collection, record **which** — an ordinal, or fold it into the
  key as `{ownerKey}#{listId}`. One attribute, and the only thing that makes the restore deterministic.
- **If Ludeos already exist** (changing the capture invalidates them), pick a discriminator from data you have and
  write it down as a stated approximation. Here the entity's own type worked for part of the set; the ambiguous rest
  went into the list with the live **cap**, the only one where a wrong count changes forward play.
- **Rank collections by consequence**, not by which seam is convenient: a population cap outranks an "any alive"
  latch, which outranks a teardown-only list.
- **Log the choice** (`minion→dripList`) so a gate can tell a mis-filed minion from a missing one.

**Generalization:** an owner reference answers "who", but a re-registration seam is a method on a **collection**.
Whenever a restore resolves an owner and calls a mutator on it, ask what the mutator mutates and whether the owner
has more than one. Pools per type, UI entries per panel, agents per squad *and* per objective — capture the **slot**,
not just the owner.
