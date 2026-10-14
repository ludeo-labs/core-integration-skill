---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game create tracked entities (pre-spawned waves, pre-placed enemies, warm pools) BEFORE the Creator room opens — e.g. during level construction, which finishes before gameplay starts?"
sanitized: true
origin: "unity:common-mistakes/pool-hooks-alone-miss-entities-that-predate-the-capture"
---

# Pool hooks alone miss entities that predate the capture

Applies when some tracked entities are created before the room's `DataWriter` exists.

Registering pooled entities through spawn/despawn hooks is the right seam (`06 §2.4`) — but hooks only see events
that happen **while capture exists**. This game pre-spawned each room's first enemy wave during level construction,
before the room opened. A recording carried 49 of the 104 enemies actually alive, and the missing set included the
very room the player was fighting in at the Ludeo's start.

The failure is quiet and **partial**: rooms whose asynchronous pre-spawn happened to finish after capture started
*did* register (their counts matched perfectly), so spot checks pass while half the world is missing. Which rooms
make it in depends on streaming order — it varies run to run.

## The rule

When capture goes live (`Begin`'s callback, or world-ready, whichever is later), **sweep the game's own registry of
live entities** — every spawn manager's alive list, the pool's active set, whatever the game itself uses for
bookkeeping — and run each through the same registration path the hooks use. Make registration **idempotent on
identity** so the sweep and the hooks compose. The hooks then cover everything born after. This is `06 §6` batch
registration; the lesson is that a pool-based game still needs it.

## The cross-check that proves it worked

Compare the number of captured entity objects against the game's own alive counts. Here each encounter recorded its
alive-NPC count, so captured NPCs per room had to equal it. That comparison exposed the gap from the platform's
stored snapshot alone, before anyone read a line of code — log it per room (or per spawner) at the batch pass, not as
one total.
