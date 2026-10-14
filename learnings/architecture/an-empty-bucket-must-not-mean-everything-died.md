---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: "5"
question: "Does the restore treat 'absent from the snapshot' as 'this entity was destroyed before the capture instant'? Then decide what it does when a type's snapshot set is empty while the level still holds entities of that type."
sanitized: true
origin: "unity:architecture/an-empty-bucket-must-not-mean-everything-died"
---

# "Absent means destroyed" is fail-dangerous — an empty set must never mean everything died

**Precondition:** a reconciliation restore (`07 §5.1`): the level load produces the entities, the restore matches
them against the snapshot, and an entity with no snapshot entry is removed because it was dead or collected at
capture (`06 §3.5` "drop").

That terminal rule is correct and cheap — it is what stops every collected pickup reappearing in a replay. It is
also **fail-dangerous**, and it took a bad capture to show it. When a payload truncation
(`learnings/architecture/the-state-upload-is-lossy-above-a-ceiling.md`) left the snapshot with no enemy objects,
the rule concluded all 31 enemies had been killed and removed every one — turning a *capture* failure into a
silently empty level, reported as "restore works but I see no enemies at all".

## The rail

**Removal is meaningful only when capture demonstrably worked.** Refuse to remove anything when a type's snapshot
set is empty while the level still holds objects of that type, and say so:

```
[Ludeo] restore: 0 'Enemy' objects in snapshot but 31 in level — refusing to remove (capture likely truncated)
```

An empty set has two meanings — "the player killed everything" and "the capture did not arrive" — and from inside
the restore they are indistinguishable. Take the reading that leaves the level playable: a replay with a few too
many enemies is a fidelity bug; a replay with none is not the moment at all. If the game has a better witness (a
recorded kill counter, an "area cleared" flag), use it to decide instead.

The general review question, for every inference the restore makes: **what does this conclude if the data is
simply missing?** This was a latent design assumption, not a regression — it needed a different bug to expose it.

## Remove through the game's own path

The removal pass must call what the game calls — the pickup's collect/despawn, the entity's own destroy, the pool's
release, a soft-destroy — never a raw engine delete. A raw delete strands pooled instances and leaves spawners and
counters unnotified, so wave logic and objectives compute against a population that no longer exists. Same
principle as `learnings/architecture/write-restored-state-to-whoever-owns-it.md`, applied to removal.
