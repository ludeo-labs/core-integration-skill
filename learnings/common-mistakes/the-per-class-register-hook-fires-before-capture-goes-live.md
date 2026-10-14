---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Is a register hook being added in an entity's own init / first-update to reach a family that the batch registration pass can't see — and does the capture registry DISCARD register notifications that arrive before capture goes live?"
sanitized: true
origin: "unity:common-mistakes/the-per-class-register-hook-fires-before-capture-goes-live"
---

# A per-class register hook in an entity's init fires before capture goes live — a registry that drops early notifications makes it a silent no-op

Applies when a hook rescues a family the batch pass can't enumerate, and the registry ignores pre-live notifications.

`learnings/common-mistakes/one-base-class-register-hook-misses-subclasses-that-skip-the-base-call.md` prescribes a
per-class hook for subclasses that skip the base hook **and** never join the game's live list. That's correct and
incomplete: adding the line isn't enough, and the way it fails is invisible.

## The ordering nobody writes down

Registration nearly always has two phases: a **batch pass** when capture goes live, registering everything already
alive by enumerating the game's own registry (`06 §6`), and a **per-object hook** for things that appear later. The
hook is written to no-op before the batch pass, with reasoning that looks obviously right:

```cpp
void LudeoManager::NotifyEntitySpawned(Entity* e) {
    if (!m_capture_live) return;      // "the batch pass will pick it up"
    Track(e);
}
```

"The batch pass will pick it up" holds **only for entities the batch pass can see** — and it enumerates the game's
live list, the exact list this family never joins. So for the one family the hook exists to rescue:

- its init runs at **level load**, long before the room is open → `m_capture_live` is false;
- the notification is discarded;
- the batch pass can't see it; a backstop sweep of the same list can't either.

Untracked all run, exactly as before the fix. Nothing errors; the register-count log is unchanged (it counts what
was registered, not what was offered). Review passes — the hook is visibly there, and the early-return is correct in
isolation. They're only wrong **together**, in different files.

## The fix: remember, don't discard

```cpp
if (!m_capture_live) {
    if (e && m_pending.size() < kPendingCap && !Contains(m_pending, e)) m_pending.push_back(e);
    return;
}
```

Drain `m_pending` at the end of the batch pass. For families that also join the live list this is redundant —
harmless, because `Track()` is idempotent on identity. Store a handle the engine can validate (not a raw pointer that
may dangle by drain time), and **bound** the list: a level load announces everything before the room opens, and if no
run begins there's no end to clear it. Then guard the queue's lifetime:
`learnings/common-mistakes/the-batch-passes-own-reset-clears-the-pending-queue-it-must-drain.md`.

**Generalization:** whenever an early-return's comment is "the other path will catch this", check that the other path
can see **this specific** object, not objects in general.

## Test at the gate, not by reading

Log **per-family** counts at the batch pass (bosses, minions, the rescued family), not one total — "enemies=23" is
consistent with the family present or absent. Log any **accepted** gap by name every run; an absence recorded only in
a plan document gets rediscovered at a restore gate.
