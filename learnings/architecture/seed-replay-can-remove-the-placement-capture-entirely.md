---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "4"
question: "Procedural world, and about to plan capturing each room's resolved world transform? First check whether the transform is DERIVED from the layout (a fixed coordinate-to-world mapping) or ROLLED independently (connector alignment, offsets). If derived, seed replay reproduces placement and the placement capture is unnecessary."
sanitized: true
origin: "unity:architecture/seed-replay-can-remove-the-placement-capture-entirely"
---

# When placement is derived from the layout, seed replay reproduces it — don't capture room transforms

**Precondition:** a generated world where you can reproduce the layout from captured seeds, and
`game-patterns/procedural-world.md` §3 is steering you toward capturing each room's resolved placement.

`procedural-world.md` §3 rightly treats placement as its own generation input: when a room's transform is rolled
independently of which room it is (connector alignment plus a per-transition offset), reproducing *which* content
does not reproduce *where it sits*, and absolute positions restore into the void. That advice assumes placement is
**rolled**. Some generators never roll it: they assign each room a **grid coordinate** as part of the layout, then
map coordinate → world transform through a fixed formula (coordinate × a room-size constant from config).

```cpp
// synthetic illustration of the shape
const int gx = (int)std::lround(worldPos.x / roomSize.x);
const int gy = (int)std::lround(worldPos.z / roomSize.y);   // ...and the inverse when placing
```

If the layout graph is reproduced and the mapping is constant-driven, placement comes back for free. Capturing
per-room transforms would store values about to be recomputed identically — pure cost, and a second copy of the
truth that can drift.

## The question to ask the placement code

**Is the room's world transform computed from its layout identity, or from a roll at placement time?**

| Feeds the transform | Regime | Action |
|---|---|---|
| grid coordinate / index from the layout + config constants | derived | don't capture transforms; re-drive the generator from the seeds |
| connector picks, per-transition offsets, jitter, any RNG call at placement | rolled | capture resolved transforms (`procedural-world.md` §3) and replay at the placement seam (§5) |
| a runtime origin shift / floating-origin rebase | non-deterministic regardless | capture relative to a reconstructed frame — this trips even authored worlds |

Check the third row separately, by grep; record a clean negative.

## What "derived" still rests on

It turns the placement question into a **determinism** question:

1. The layout must be exactly reproducible from the captured seeds — the generator re-seeds immediately before
   generating, and every layout consumer draws from that seeded stream (a single layout draw from a global RNG breaks
   it; `learnings/architecture/seed-replay-only-reproduces-what-the-seeded-stream-draws.md`).
2. Capture **every** seed the generation path consumes, not just "the seed" — a primary seed plus a secondary roll is
   common.

Prove the round trip at the first restore gate **from a deep state**: an early capture restores perfectly while a deep
one lands in the void. The decision removes a whole object type — a per-room type, its key, a capture path and a
placement-seam injection — so make it on evidence, cite the mapping code in `OBJECT_TRACKING.md`, and never assume
"derived" because the world looks grid-like. A studio repro tool that teleports to absolute coordinates after a seed
replay is strong evidence placement is derived (`learnings/architecture/find-the-studios-own-repro-tooling-first.md`).
