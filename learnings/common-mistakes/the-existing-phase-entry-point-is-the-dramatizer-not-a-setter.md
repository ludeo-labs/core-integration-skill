---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Is the restore planning to set a boss phase / stage / form index by calling the game's existing AdvancePhase()-style entry point, on the grounds that a public entry point already exists?"
sanitized: true
origin: "unity:common-mistakes/the-existing-phase-entry-point-is-the-dramatizer-not-a-setter"
---

# The public "advance phase" entry point is the dramatizer, not a setter — audit every override before reusing it

Applies when a restore plan reuses an existing public phase-transition method instead of adding a seam.

`game-patterns/bosses.md §4.2` offers a cheap path: *if a public entry point exists, call it from the restore instead
of adding a game-code seam.* A scoping pass finds `virtual void AdvancePhase()` on the boss base class, records
"public entry point exists", and moves on. **Read every override first.** In the observed project all four
implementations were disqualified, each differently:

| Implementation | What `AdvancePhase()` actually does |
|---|---|
| base class | sets the field **and** starts a phase-change state that fires an animation and holds the state machine until it ends |
| boss A | base's animation **plus** forces a specific attack state and re-rolls a random spawn timer |
| boss B | plays a full cutscene — and **never sets the phase field**; that happens later, in the cutscene's completion callback |
| boss C | sets the field and nothing else — silent only because it *forgot* to call the base implementation |

The one safe implementation is safe **by accident**, via the same skipped-base-call hazard as
`learnings/common-mistakes/one-base-class-register-hook-misses-subclasses-that-skip-the-base-call.md`. Boss B is the
dangerous one: calling it from the restore launches a cutscene *and* leaves the phase unset, so the bug presents as
"restore hung", not "phase wrong".

## Two disqualifiers even when the body looks clean

1. **It hard-codes the destination.** "Advance" means "go to the next phase"; it can't express a captured phase 3,
   or phase 1 at all. Restore needs an arbitrary assignment.
2. **It isn't idempotent.** Re-entering it on a boss already in that phase replays the animation or cutscene.

## Ask for `SetPhaseSilent(Phase)` — and make it non-virtual

A four-line, side-effect-free field write next to the existing getter. **Non-virtual on purpose:** the whole failure
above is subclasses overriding the phase entry point with dramatics; a virtual seam reopens it for the next boss.

## The corollary that decides the other rows

A silent setter restores the *field* and none of the phase's **visible consequences** — here, arriving in phase 2
also removed a shield mesh, zeroed a dissolve timer and forced an aggro flag, all from the cutscene's completion
callback. Don't replay the transition to get them. **Capture each consequence as its own resolved attribute**
(`shield_active`, `dissolve_pct`, `engaged`) — cheaper, order-independent, and the only version that also works for a
boss captured *mid*-transition (`bosses.md §4.3`–`§4.6`).

**Generalization:** any state whose only public writer is a **verb** (`Advance`, `Trigger`, `Complete`, `Unlock`,
`NextWave`) is a transition: a setter plus side effects plus a destination the caller doesn't choose. Restore wants
the setter half. When a plan records "public entry point exists, no game edit needed", check: **does it write only the
field, for an arbitrary value, idempotently?** Three noes is the normal answer.
