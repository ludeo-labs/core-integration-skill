---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "4,5"
question: "Do gameplay decisions that should play out the same after a restore (spawn rolls, drop rolls, AI choices) draw from random numbers — and does any of that code use a global/unseeded generator (rand(), a global engine random function) rather than a per-system seeded stream?"
sanitized: true
origin: "unreal:engine-quirks/fmath-frand-vs-frandomstream-determinism"
---

# Restoring the game's seed doesn't fix rolls that use the global random generator

**Precondition:** gameplay decisions use random numbers, and the replay should continue them the way live play
would.

## Two kinds of randomness

| Source | Controlled by | Capturable? |
|---|---|---|
| Global C-runtime `rand()` or an engine "random float" that wraps it / seeds from system entropy | nothing the game owns | no — not portably |
| An engine global stream with an explicit seed API | that seed call | yes — capture and restore its current state |
| A **per-system seeded stream** (an RNG object with its own state) | its constructor / `Initialize(seed)` | yes — capture its current state |

The game in question had a "mission seed": systems that needed determinism derived a per-system seed from it
(seed ⊕ a per-system salt) and owned their own stream. Restoring the mission seed fixed exactly those systems. The
vehicle-spawn roll, however, called the global random function directly — after restore it diverged from the
captured run every time, no matter what seed was restored.

## Symptom

"The same Ludeo plays out differently each replay": spawns fail at different rates, squads pick different orders,
drops differ.

## Fix

1. Grep the decision path for global random calls (`rand(`, `std::rand`, the engine's global random/range helpers).
   Each one is a determinism break.
2. Check whether the game already has a per-system stream pattern; if so, follow it.
3. Give the offending system its own stream, seeded from the game's seed with a salt no other system uses; gate the
   switch behind `LUDEO_SDK_ENABLED` if the team wants the live game unchanged — and record it as a game-code
   change.
4. **Capture the stream's current state** (not just its initial seed) each capture, and **restore it last** — after
   every other restored value and the deferred queue (`07 §6`) — so no random draw made during the restore itself
   shifts the stream before Play.

```cpp
class SpawnDirector {
    RandomStream m_rng;                                // per-system stream
public:
    uint32_t Ludeo_GetRngState() const  { return m_rng.State(); }
    void     Ludeo_SetRngState(uint32_t s) { m_rng.SetState(s); }
};
```

## Scope it honestly

Full determinism is rarely required — a replay that continues *plausibly* is usually fine. Do this for the rolls the
viewer notices (what spawns next, what drops), and say in `RESTORATION_PLAN.md` which rolls remain non-deterministic.
