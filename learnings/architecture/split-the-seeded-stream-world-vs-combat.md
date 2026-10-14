---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: "4"
question: "Converting a game to seeded randomness for replay? Check WHAT ELSE draws from that stream. If any draw fires at player frequency — enemy AI decisions, drop rolls, container contents — one shared stream cannot reproduce the world, and a shared random helper is usually how they got there."
sanitized: true
origin: "unity:architecture/split-the-seeded-stream-world-vs-combat"
---

# One seeded stream is not enough — split world from combat

**Precondition:** you are routing a procedural game's world generation through a seeded stream whose state is
captured, and the game funnels randomness through shared helper functions.

A run-based game was converted well: one seeded generator whose whole state is a single integer, captured and
restored as one attribute. The plan even said loot and cosmetics must stay on the engine RNG "so ordinary play cannot
advance this stream and change the map". The implementation then broke that through a step that looked like pure
profit.

## How the contention got in

Most randomness went through one shared helper with three primitives. Repointing those three bodies at the seeded
stream fixed **69 call sites** without touching a caller — and swept in every caller nobody had classified, chiefly
**enemy AI decisions**: move-vs-attack and which attack, once per enemy per decision cycle, all fight long. The notes
called it "a side effect… harmless". It was exactly the contention the plan forbade.

And it was structural, not a tuning problem — the decision **cadence** came from the unseeded RNG:

```cpp
// neutral illustration of the shape
void Enemy::Rest()  { rest_timer = EngineRandom::Range(rest_min, rest_max); }   // unseeded
void Enemy::Think() { if (TimerExpired(rest_timer)) ChooseAction(); }          // -> shared helper -> SEEDED
```

The engine RNG decides **how many** draws come off the seeded stream, so even with identical input the stream's
position after any fight is non-deterministic, and every world decision after combat (next room's contents, specials,
rewards, shop stock) lands somewhere unpredictable.

## What it costs

- "Replay one Ludeo twice and diff the world" fails whenever an enemy was alive and thinking, with no defect present.
- A moment that clears one area and continues into the next gets different content than the recording.
- The restored moment itself looks fine — its entities come from captured state — so it is slow to spot.

## The fix: two streams, each captured

| Stream | Draws | Property |
|---|---|---|
| **World** | area selection, slot content, rewards, offered upgrades, shop stock | low frequency, advanced only by progression |
| **Combat** | AI decisions, summons, drop rolls, container contents, jitter | player frequency, free to diverge |

Nothing in combat may touch World. Make it hard to get wrong later:

1. **No unqualified draw API.** Expose only `Rng::World()` and `Rng::Combat()`; a new draw that never chose a stream
   fails to compile instead of silently landing.
2. **Point the shared helper's existing names at Combat**, with explicit `*World` variants — the fail-safe default
   lands an unclassified draw on the stream allowed to diverge. The combat code then needs no edits.

Check any "deliberately left random" list against what the helper really does: two loot files were listed as random,
but only their amounts were; their chance rolls went through the shared percentage helper and had been seeded too.
Related: `learnings/architecture/seed-replay-only-reproduces-what-the-seeded-stream-draws.md`.
