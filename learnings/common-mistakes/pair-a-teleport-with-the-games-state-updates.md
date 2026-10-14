---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Is the restore about to call the game's low-level teleport / placement method — and do the game's OWN call sites of that method pair it with sibling state updates (room membership, spatial-index registration, camera notification)?"
sanitized: true
origin: "unity:common-mistakes/pair-a-teleport-with-the-games-state-updates"
---

# A game's teleport has siblings — moving the body without the record desyncs the game's state

Applies when the restore places an entity by calling a game placement method that the game itself never calls
alone.

The restore called the game's public teleport method to place the player at the recorded spot. Position: correct.
But the game's own call sites never call it alone — its composite teleport path also:

- registers the destination room with the **spatial index** before the move (without it, spatial queries silently
  fail to find the player — nothing errors);
- updates the authoritative **room membership** record ("which room is this player in") that every room query
  reads — encounters, wave counters and room-cleared checks all ask that record, not positions.

The bare teleport moved the body and left the record pointing at the previous room: the player stands in the
restored room while the game counts them elsewhere. No error; it surfaces later as encounters not triggering or
clearing wrongly.

**Also verify the authority layer can't reject the move.** If the game has a server / authority model, read the
teleport's implementation: here, client-authoritative mode routed the teleport to the owning client and
server-authoritative mode wrote the position and forced a resync — both safe for a self-hosted replay. A game with
server-side position reconciliation needs the move issued through its authoritative path, or the next correction
snaps the player back.

**The rule:** never call the lowest-level placement primitive you can find — **mirror the game's own composite
teleport path**, sibling updates included, in the same order. Grep the game's call sites of the primitive first;
whatever they always do around it is part of the operation. Physics and navigation placement may still need the
deferred queue (`07 §6`).
