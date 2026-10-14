---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5"
question: "Does the capture registry queue register notifications that arrive before capture goes live ('remember, don't discard') — and does the batch registration pass call a Reset()/Clear() on the registry before it drains that queue?"
sanitized: true
origin: "unity:common-mistakes/the-batch-passes-own-reset-clears-the-pending-queue-it-must-drain"
---

# The batch pass's own `Reset()` clears the pending queue it exists to drain

Applies when pre-live register notifications are queued for the batch pass to drain
(`learnings/common-mistakes/the-per-class-register-hook-fires-before-capture-goes-live.md`).

Implement "remember, don't discard" and you'll almost certainly write this next, because a capture registry must be
re-entrant across runs (a restart, a second replay):

```cpp
void CaptureRegistry::RegisterAll() {
    if (m_live) return;
    Reset();                  // <-- clears counters, the tracked-key set ... AND m_pending
    m_live = true;
    RegisterFromGameRegistry();
    DrainPending();           // <-- drains a list that is now empty, every time
}
```

`Reset()` is correct alone: a new run mustn't inherit the last run's counters or tracked keys. `DrainPending()` is
correct alone. **Together they restore the exact bug the queue was added to prevent**, with identical symptoms: the
entity is untracked all run, nothing errors, and the register-count log is unchanged because it counts what was
registered, not what was offered.

## Why it survives review

Two files, each correct. The reviewer checks that the hook records (it does) and that the batch pass drains (it does).
Nobody diffs what `Reset()` touches against what `DrainPending()` reads — `Reset()` reads as hygiene, not as part of
the protocol. And the obvious test misses it: a notification sent **after** capture goes live takes the live branch
and registers fine. The queue only matters on the pre-live path, before there's a room to debug.

## The fix: split resets by lifetime

The queue has a **different lifetime** from everything else in the registry. Counters and tracked keys are per-**run**;
the queue is per-**level-load**, and its whole point is to survive from level load into the batch pass — across the
very boundary `Reset()` marks.

```cpp
void CaptureRegistry::ResetRunState() { /* counters, tracked keys, caches — NOT m_pending */ }  // top of RegisterAll
void CaptureRegistry::Teardown()      { ResetRunState(); m_pending.clear(); }                 // EndCurrentLudeo / run end
```

Clearing the queue only at teardown keeps its bound honest: bound it because a level load announces everything
before the room opens, and if no run ever begins there's no end to clear it — a cap plus a teardown clear covers
both; a clear at the start of the batch pass covers neither.

**Generalization:** when you add a buffer that deliberately spans a lifecycle boundary, audit every existing
`Reset` / `Clear` / `Init` that straddles that boundary — it will have swept the buffer into a per-phase reset by
default. Same shape: queued events cleared by a session reset, deferred cues cleared by a level-change handler, a
pending-input buffer cleared by a state machine's `Enter()`.
