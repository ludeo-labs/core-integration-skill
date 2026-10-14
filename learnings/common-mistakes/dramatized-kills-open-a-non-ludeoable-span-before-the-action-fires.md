---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "6"
question: "Does the game dramatize its most important beats (boss kill, player death, finisher) with a cinematic state change — and does that state write happen BEFORE the kill/death call the action would be emitted from?"
sanitized: true
origin: "unity:common-mistakes/dramatized-kills-open-a-non-ludeoable-span-before-the-action-fires"
---

# A dramatized kill sets the cinematic state first, so the action lands inside the window the backend excludes

**Precondition:** non-ludeoable spans are driven off the game's state changes, and big beats enter a cinematic state.

`StartNoneLudeable`/`StopNoneLudeable` follow the game's state-change notification, and the Global Trigger mapping
tells the backend to **exclude** those windows (`06 §7.3`). Actions are mapped separately. The two interact in a way
neither step sees alone: **games dramatize their biggest beats by entering a cinematic state *before* the code that
would emit the action.**

```cpp
void Boss::KillSequence() {                  // runs over several frames
    PlaySound(m_deathSound);
    SetState(GameState::Cinematic);          // ← non-ludeoable span OPENS here
    ApplySlowMo(m_dramaticScale);
    WaitRealtime(m_effectDuration);
    Kill();                                  // ← the obvious emit point, now INSIDE the span
}
```

So `BossKill` — the highest-value action in the game — is emitted into a window configured to be thrown away. The same
shape appeared on the player's death path and on a mid-boss whose kill deferred into an outro cutscene. **It is
silent:** the emit, the span and the mapping are each correct, and the beat still doesn't score.

## The variant code reading did not find

A **finisher** move was a scripted cinematic behind a wrapper: `Finisher::Activate(victim)` zeroed the victim's life,
set the cinematic state, and scheduled `FinishFinisher()` after the timeline — then restored `Playing`. The natural
emit point, the function named "finish", sat inside the window, in a class containing **no state write at all**
(designer-authored event lists in level data fired the rest). Only the runtime log showed it, as a bracket:

```
SendAction("StartNoneLudeable")
  … several seconds of finisher timeline …
SendAction("EnemyKilled")  SendAction("EnemyFatality")
SendAction("StopNoneLudeable")
```

**Verify at the gate, not only in the map:** for each action line in the gate log, check it does not fall between a
`StartNoneLudeable` and its `StopNoneLudeable`. Two minutes; no amount of code reading substitutes.

## Why it is easy to miss

The ordinary kill path touches no state, so the action set looks fine at the gate — only the dramatized subset is
swallowed, the rarest captures to test. And phase 6 reads non-ludeoable boundaries from the phase-3 artifact rather
than re-scanning them, so nobody looks at the *ordering* between a span and an action.

## The fix

For every kept action ask: **does anything on the path to this call site write a non-playing game state first?** Then
**emit before the state write** — at the top of the dramatizing function or wrapper (the victim's life is already
decided). The beat belongs to live gameplay; the cinematic celebrating it is what should be excluded. **Don't**
suppress the span around kills — that hands the backend cutscene time as scoreable gameplay. Related:
`learnings/architecture/non-ludeoable-spans-as-a-state-machine-not-paired-calls.md`.
