---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "1,4"
question: "Procedural world? Map every random source at intake and record WHICH STREAM each load-bearing one draws from, then confirm in phase 4 by replaying one Ludeo twice and diffing the world. Generators often draw LAYOUT from a seeded stream and CONTENT from the engine's global RNG."
sanitized: true
origin: "unity:architecture/seed-replay-only-reproduces-what-the-seeded-stream-draws"
---

# Seed replay reproduces only what the seeded stream draws — check the rest before you trust it

**Precondition:** a procedural game you plan to reproduce by capturing a seed.

Capture the seed, replay it, the world comes back — it half works, and the failing half is silent. The generator owned
a properly seeded stream and used it for the **layout** (which rooms, arrangement, coordinates). The **contents** —
props, chests and their rarity, enemy composition, decoration — came from the **engine's global RNG**, whose state at
the draw depends on everything that has run in the process since launch. Same seed, same rooms, **different things in
them every run**.

## Why it stays hidden

Every early check passes: the layout is stable, navigation works, entities restore into rooms that exist — all
measured against whatever world *this* run generated. What you get instead is **intermittency**, which invites
blaming timing. On one integration it surfaced as three separate "bugs" over two sessions — enemies occasionally
invisible, occasionally falling through the floor, one occasionally missing and blocking completion. One cause: the
destructible props enemies stood on, and the encounter population, re-rolled on every replay. The human noticed first,
not by looking: a chest "was blue here" last time.

## Map it at intake, prove it in phase 4

At intake (`know-your-game.md`, phase 1) grep every random source, keep the sites that decide **what exists** (layout,
dressing, loot, enemy composition — not footstep audio), and record **which stream each draws from**. That one column
is the finding.

In phase 4, **replay one Ludeo twice** and diff a fingerprint taken at the same instant (after the settle):

- the seeds in effect, and the physics settings;
- **count + order-independent hash** per category (rooms, destructibles, entities), using a hash stable across
  processes — FNV-1a over values rounded to fixed precision; `std::hash` makes no cross-build guarantee;
- a floor probe if entities fall — a grid of downward rays naming holes by coordinate.

| Result | Meaning |
|---|---|
| layout matches, content differs | this lesson — content draws from the global RNG |
| everything matches | the world is deterministic; look at timing |
| layout differs | seeds are not applied at all — a bigger problem |

## The fix, cheapest first

1. **Seed the global stream around the generation window** — set it from the recorded seed immediately before content
   generation and restore the previous state afterwards, so live gameplay randomness is untouched. One change, no
   call-site edits. Re-run the diff.
2. **Still differs?** Something else draws from the global stream during that window. Route the generator's own picks
   through its seeded stream — usually a handful of shared weighted-pick helpers, not every call site.

Do not start by converting every random call; most are cosmetic. Related:
`learnings/architecture/split-the-seeded-stream-world-vs-combat.md`,
`learnings/architecture/persisted-progression-can-be-a-generation-input.md`.
