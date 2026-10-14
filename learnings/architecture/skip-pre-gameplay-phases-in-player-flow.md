---
category: architecture
tier: generalizable
sourceGame: Lyra
phase: "5"
question: "Does the curated slice run a pre-gameplay phase — warm-up, countdown, pick/ban, 'waiting for players' — before play starts? Ask the user (intake PUX-2): the code shows that a phase machine exists, not which phases matter to the viewer."
sanitized: true
origin: "unreal:architecture/skip-warmup-phase-player-flow, unreal:common-mistakes/ask-about-pregameplay-phases"
---

# Skip pre-gameplay phases in a replay — and fire the skipped phase's completion

**Precondition:** the level enters play through a phase system: warmup → playing, a countdown, pick/ban, "waiting for
players". This is practically always true of multiplayer games, so **ask** during restore planning, on every
integration: *"Does the curated slice have a warm-up, countdown, pick/ban or 'waiting for players' phase before
gameplay starts? The replay will skip it."* Confirm intake question `PUX-2` was answered for the curated slice; the
code alone shows that a phase machine exists, not which phases matter to the viewer. Agree the game-code change below
with the user first.

A replay restores a mid-run moment; warmup and countdowns are meaningless there. Without a skip, the viewer sits
through warmup, or warmup's own start logic (respawn, score reset) clobbers the restored state. These are start-of-run
mechanisms, gated on `IsRestoring()`: record each phase on the start-of-run list (`07 §9.11`) with its hook and gate.

## Two parts

**1. A skip in the game's phase system** (a small, gated game-code change):

```cpp
#if LUDEO_SDK_ENABLED
void PhaseSystem::SkipPhase(PhaseId id)   { skipped_.insert(id); }
void PhaseSystem::ClearSkippedPhases()    { skipped_.clear(); }
#endif

void PhaseSystem::StartPhase(PhaseId id, PhaseEndedCallback onEnded) {
#if LUDEO_SDK_ENABLED
    if (skipped_.count(id)) { if (onEnded) onEnded(); return; }   // still report "ended"
#endif
    // ... existing code ...
}
```

The critical detail: **when skipping, fire the phase's completion callback** — not a bare `return`. Whatever waits on
that phase ending stalls otherwise (`learnings/common-mistakes/skipped-phase-must-still-signal-completion.md`).

**2. The integration drives it:**

- At the commit (`07 §2.1` step 3), with `IsRestoring()` set and before the level load: `SkipPhase(Warmup)`.
- When the game's mode/rules finish loading: start the **playing** phase directly. The game's own phase observers then
  flip "gameplay active", and reaching active gameplay completes.
- In `EndCurrentLudeo()`: `ClearSkippedPhases()`, so the next Creator run gets its warmup back (`07 §2.6`).

## A reference integration may call APIs this game build doesn't have

One reference called skip methods that did not exist in the current game source — the reference was built against a
later version. Grep the current headers before assuming an API exists; add the missing piece as a small, generic,
gated change.
