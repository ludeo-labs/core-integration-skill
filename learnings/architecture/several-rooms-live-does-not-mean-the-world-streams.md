---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "4"
question: "Is the game procedural with several rooms/areas live and navigable at once? Before importing the open-world streaming machinery, check separately whether anything ever streams OUT — 'multi-room' and 'streaming' are two different facts."
sanitized: true
origin: "unity:architecture/several-rooms-live-does-not-mean-the-world-streams"
---

# "Several rooms live" is not the same fact as "the world streams"

**Precondition:** a procedural game where `game-patterns/procedural-world.md` §2.1 lands you in the "several rooms
live or navigable" branch, which sends you on to `open-world-tracking.md`.

Read quickly, that branch reads as *multi-room ⇒ streaming*. It isn't. A third regime is common in generated dungeon
crawlers: **the whole level is generated and instantiated up front, and nothing ever streams out.** Several rooms
are live and navigable — so the multi-room half applies — but no object is ever unloaded, so the streaming half does
not.

## Why conflating them costs you

`open-world-tracking.md` has two independently switchable halves:

| Half | Wrongly included | Wrongly excluded |
|---|---|---|
| **Per-room mutation deltas** (cleared flags, doors, looted containers) | harmless — a slightly larger capture | the player back-tracks in the replay into a default-state room |
| **Streaming machinery** (stream-in/out hooks, presence ≠ existence, unregister only on real removal, ids that survive a stream cycle) | hooks for lifecycle events that never fire; a hunt for an "unloaded vs removed" distinction the engine never draws | in a genuinely streaming world, objects vanish from the replay |

The streaming half is the one that punishes a false positive: a census full of stream-in/out columns that are all
"n/a", and a search for a persistence layer that does not exist.

## The check — two questions, recorded separately in `OBJECT_TRACKING.md`

1. **How many rooms/areas are live and navigable at once?** → per-room deltas and layout/connectivity.
2. **Does anything get unloaded while the session is live?** → streaming machinery at all.

Answer question 2 from the level builder. **An async, rate-limited loader is not streaming.** A builder that enqueues
every room's instantiation and drains the queue over several frames looks like streaming — content appears
progressively, there is a load-complete flag — but it is a one-way fill. The tell: find the **unload** side. No
per-room unload, release or cull-to-disk path during play means no streaming, however asynchronously it arrived.

## Record the negative result

Write "nothing streams out" into the census with its evidence, and put `no` in every type's stream columns. A blank
column cannot be told apart from "forgotten", and later waves will re-open the question once per wave.

The async loader still matters: it sets the **readiness signal** the restore waits on before the apply (`07 §2.1`
step 4). Gate on the builder's own "loading finished + setup finished" signals — edge-safe
(`learnings/architecture/a-world-ready-flag-may-still-answer-for-the-world-you-are-leaving.md`) — never on a fixed
delay.
