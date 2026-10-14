---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: "2"
question: "Procedural world, and you plan to reproduce it by capturing the RNG seed/state? Read the generator's live entry point for reads of PERSISTED player progression — many builders drop or unlock content from save data, so the same seed builds a different world for a different player."
sanitized: true
origin: "unity:architecture/persisted-progression-can-be-a-generation-input"
---

# The seed may not be the only generation input — persisted progression often is one too

**Precondition:** a procedural game you plan to reproduce by capturing its random state.

The determinism work on a run-based procedural game had reached a comfortable conclusion: route every random draw
through one seeded stream, capture that stream's state as one integer, and the world is reproducible. Then reading
the live world builder's opening block changed the picture. Before rolling anything, it **filtered the level set
using persisted player state**:

```cpp
// neutral illustration of the shape
for (int i = (int)levels.size() - 1; i >= 0; --i) {
    const bool doneOnce = levels[i].trigger_once && save.GetString(CompletedKey(levels[i])) == kDone;
    const bool gated    = levels[i].is_progress_gate && save.GetInt(kRunCounter) >= levels[i].unlocks_at_run;
    if (doneOnce || gated) levels.erase(levels.begin() + i);   // the candidate set differs per player
}
```

Three persisted values fed that filter: a per-level "completed" marker, a total run counter and a furthest-progress
cursor. **So the same seed produces the same world only for the same progression state.** Replay on a fresh
profile, or a profile further along, and the generator rolls against a different candidate set — same stream,
different output.

## Why it is easy to miss

A determinism investigation scopes itself to randomness: find the random calls and reseeds, route them through one
stream. Correct and incomplete. A generator's inputs are **everything it reads before it decides**, and non-random
inputs never show up in a search for random ones. The progression keys also look like save data — the thing you
restore — rather than generation inputs, the thing you must match before the world is built. They are both, and
the generation role comes first in the restore order.

## The check (phase 2)

Open the **live** builder entry point — confirm which overload runs; these classes often carry several, selected
by a config flag — and read from the top to the first roll. Everything read before that point is a generation
input: save/prefs reads, progression counters, unlock gates, completed markers, difficulty or new-game-plus tier,
data selected by an index that comes from save state.

Record them **alongside** the seed in `CODE_MAP.json`'s generation inputs (`game-patterns/procedural-world.md` §3)
and say plainly the seed alone is insufficient. Phases 4–5 then decide whether to capture those values and apply
them before generation, or pin the replay profile so they cannot drift. Related:
`learnings/architecture/seed-replay-only-reproduces-what-the-seeded-stream-draws.md`.
