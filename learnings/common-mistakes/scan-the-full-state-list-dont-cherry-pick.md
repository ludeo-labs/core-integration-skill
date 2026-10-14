---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "4"
question: "Does the game keep a systematic per-class list of its persistent or synchronized state (network-sync/replication registration, save/load serializer, reflection or property tables)?"
sanitized: true
origin: "unreal:common-mistakes/doreplifetime-scan-not-cherry-pick"
---

# Scan an entity's full state list; don't cherry-pick the obvious properties

## The problem

In phase 4 the agent picked the "obvious" fields (transform, health, armor) by browsing the code. It missed a
boolean on the player state that switches the game between its two major gameplay modes. That field was in the
game's synchronized-state list for a reason, and without it the replay couldn't restore the game's basic state.

## What should happen

For each tracked type:

1. Find the class's systematic state list: the network-sync registration, the save/load serializer, or the
   property table.
2. Extract **every** entry, inherited ones included.
3. Put the full list in `OBJECT_TRACKING.md` and let the user trim it.

The scan is the discovery step. Don't pre-filter it by what looks relevant.

If the game has no such list, enumerate the members through the census instead of guessing (`06 §2.7`/§2.8).
