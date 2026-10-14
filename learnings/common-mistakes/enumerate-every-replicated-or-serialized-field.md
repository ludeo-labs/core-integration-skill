---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "4"
question: "Does the game already sync or serialize entity state somewhere (network replication, save/load, a snapshot or rollback system) that lists the fields it considers important?"
sanitized: true
origin: "unreal:common-mistakes/scan-all-replicated-properties"
---

# Enumerate every field the game already syncs or serializes; don't cherry-pick the obvious ones

**Precondition:** the game has a replication, save or snapshot path that names the per-entity fields it carries.

## Problem

During property discovery, the agent picked the "obvious" fields (transform, health, defeat state, stance, alive)
and missed a replicated player-state flag that **toggles the game into a different mode**. The human had to point
it out. The heuristic "anything the game already replicates is likely important for playback" was in the
reference, but it was treated as optional.

**Selective** discovery is biased toward fields the agent already expects. **Exhaustive** discovery means listing
everything the game itself chose to sync, then filtering.

## Fix

For each tracked entity type in phase 4:

1. List **every** field in the game's replication registration, save serializer or snapshot writer for that type
   (grep the registration macro or the serialize function). This is the save-system-driven discovery technique of
   `06 §2.7`.
2. Present the **full** list to the human, with your recommended subset and a disposition per field (`06 §9.6`).
   Don't filter silently.
3. Ask explicitly: *"Are there player-triggered states that change how the game plays (an ability toggle, stealth
   versus alerted, vehicle entry, a form change)?"* These change AI behavior, the available actions and the flow,
   not just the visuals.
