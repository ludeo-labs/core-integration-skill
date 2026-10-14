---
category: save-systems
tier: generalizable
sourceGame: VoyagerV2
phase: "4,5"
question: "Does the game have a per-entity save interface — a virtual save/load pair that each stateful entity implements to serialize its own components?"
sanitized: true
origin: "unreal:save-systems/use-game-native-save-interface"
---

# When entities save themselves, collect Ludeo state through that interface

**Precondition:** the game's save system is built on a per-entity interface (`virtual void SaveState(Writer&)` /
`virtual void LoadState(Reader&)` or similar) that every stateful entity implements, rather than one central
serializer that knows every type.

That interface is the most reliable state source the integration can get, for four reasons:

1. The game team already answered "where does this entity's state live" — health on one component, energy on
   another, a flag in a custom container. Field-by-field discovery from the outside misses some of it.
2. Each entity knows how to read its own components, however they are stored.
3. The implementations already encode the game's data relationships (what refers to what, what is derived).
4. The set of implementors is the game's own census of stateful types (`06 §2.7`, and
   `learnings/architecture/audit-every-level-against-the-games-own-save-list-before-calling-restore-done.md`).

## Capture

Call the interface on each tracked entity and map what it returns onto **named attributes** through the
`LudeoStateAdapter` (`ludeo_DataWriter_Set*`), not into one opaque blob — `06 §1.4` keeps attributes as the
default even when the source is a serializer. Two cautions:

- The save path is a **floor, not a ceiling**: saves skip transient state a moment needs (velocity, AI
  perception, timers mid-countdown). Walk the runtime members the save skips (`06 §2.7` pitfalls, `06 §9.6`).
- A save call often allocates or does file-shaped work. Call it for capture at the rate the attribute actually
  changes, not every tick, and stop querying a latched value once it is recorded.

## Restore

The load half is the cheapest correct restore primitive: it runs the game's **own** load path, with the side
effects the game chose (no pickup sound replayed, the HUD updated, dependent objects informed). If it accepts the
save file's serialized form, hand it a synthesized payload containing only the fields you restored. This is the
`07 §4` "Group 1" strategy applied per entity; two-pass ordering (CR-006) still applies for references.

Check what the load path **also** touches: if a flag restores correctly but the HUD that shows it is drawn only by
the gameplay path that sets it, the viewer still sees the wrong thing — mirror every visible effect of the load.

## Verify

Diff the implementor list against what the adapter captures, and confirm one restored value per type at the
post-settle check (`11 §10`).
