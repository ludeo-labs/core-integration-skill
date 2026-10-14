---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "5"
question: "Are you skipping a step of the game's phase / sequence system (intro, countdown, cutscene) while restoring?"
sanitized: true
origin: "unreal:common-mistakes/skip-phase-must-fire-callback"
---

# A skipped game phase must still signal its completion

A restore skip (`07 §9.11`) written as a bare `return` never fires the phase-ended callback. Everything waiting
on that callback stalls silently, which looks like a hang before `OpenRoom`.

```cpp
if (IsRestoring() && IsSkippable(phase)) {
    onPhaseEnded(nullptr);   // signal completion, then return
    return;
}
```

Related: `learnings/architecture/skip-pre-gameplay-phases-in-player-flow.md` (the full skip pattern for warm-up and
countdown phases, including where the integration arms and clears the skip).
