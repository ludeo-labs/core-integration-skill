---
category: common-mistakes
tier: generalizable
sourceGame: CoopShooter
phase: "5"
question: "Does the game escalate a global alert / phase / reinforcement state as a side effect of AI death or destruction (an alarm on an unanswered kill, a 'call it in' radio, panic spread, a reinforcement timer), while your restore destroys or spawns AI?"
sanitized: true
origin: "unreal:common-mistakes/restore-ai-destroy-trips-death-escalation-mechanic"
---

# A restore that destroys or spawns AI trips the game's own death side effects, including global ones

**Precondition:** AI death or destruction escalates shared session state, **and** the restore destroys or
replaces AI (removing default-spawned duplicates, spawning captured corpses). If AI death has no global side
effect in this game, this lesson doesn't apply.

## The trap

A restore is not a passive memcpy. Destroying an entity runs its **normal destruction path**, and those hooks can
fire live gameplay mechanics. On a co-op stealth game, the restore did two ordinary things: it removed
default-spawned duplicate guards, and it spawned corpses for guards the player had killed silently. **Both** ran
the guard's death cleanup, which incremented an "unanswered kill" counter and, past a threshold, raised a
**global alarm**. Every moment captured in clean stealth booted already alarmed. It was deterministic, not a
perception race. It also corrupted actions: the restore had already left stealth, so the player's genuine later
break never produced its `stealth → alerted` edge, and that action was never sent.

## Diagnosis: walk the stack at the choke point

Three theories were wrong (organic AI perception, a specific "raise alert" behavior task, the integration's own
state-restore line). What settled it was a **call-stack dump at the single global-state setter**, gated to the
`stealth → alerted` transition. It named the real caller in one shot: the integration's own restore-destroy path
running the game's death-to-alarm cascade. Enumerate every caller of the setter first, so you know the dump
catches all of them (`11 §10`).

## Fix: suppress the side effect across the restore window

Add a suppression flag on the owner of the global state, and early-out the escalation while it's set:

```cpp
bool AlertDirector::OnUnansweredKill() {
    if (suppressEscalation_) return false;                    // no count, no dispatch
    ...
}
void AlertDirector::SetSuppressEscalation(bool s) { suppressEscalation_ = s; }
void AlertDirector::ResetEscalationCount()        { unansweredKills_ = 0; }
```

- Turn suppression **on** before the first destroy/spawn: at the commit, or at the start of the apply.
- **Neutralize per-entity mechanic state** on restored corpses (the dead guard's radio), so they can't take part
  once suppression lifts.
- **Reset the counter and lift suppression at the end of the settle**, after the last restore sweep and before
  `OpenRoom`. Nothing is written after Play under the restore order (`07 §2.1`). If your design still sweeps after
  Play, that sweep is the bug.
- **Lift it on teardown too** (`EndCurrentLudeo`, every exit path), so an aborted restore can't leave the mechanic
  disabled for the next play.

Suppressing beats escalating and then reverting: a revert still emits a spurious transition, and can re-trip
while later sweeps run. Wrap the hooks in `#if LUDEO_SDK_ENABLED` (CR-001), so the off-build is untouched.
**Audit every destroy/spawn the restore performs for side effects on shared state**, like any other borrowed game
path (`07 §11.2`).
