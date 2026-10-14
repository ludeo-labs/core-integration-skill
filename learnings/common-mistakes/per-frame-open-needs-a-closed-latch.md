---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "3,5"
question: "Is the Creator room opened from a per-frame game tick rather than a one-shot level-start event? If so, does anything stop the very next tick from reopening it after a deliberate close?"
sanitized: true
origin: "unity:common-mistakes/per-frame-open-needs-a-closed-latch"
---

# A per-frame "open the room" call undoes your close on the next frame

Applies when the Creator-Flow `OpenRoom` (`05 §6.2`) is driven from a per-frame tick instead of a one-shot event.

Opening the room from a per-frame tick is attractive: opening is idempotent, so a per-frame call is free — and a run
whose readiness arrived a frame late still gets captured. Both halves are true. The conclusion is still wrong,
because **close is not idempotent against a tick that is still running.** The hook site — a level controller's
update — keeps ticking for a while *after* the player leaves, across the transition back to the menu. From the log:

```
OpenRoom → AddPlayer → RoomReady → Begin           ← correct
End(isAbort) / Room_Close   ← player heading back to the hub
OpenRoom ...                ← reopened ~1 frame later
Room_Close                  ← closed again by the same exit
OpenRoom ...                ← and a third time
RoomReady
<menu level loads>
Begin                       ← now capturing the MENU
```

Two harms: rooms opened and abandoned on the backend, and — worse — capture of non-gameplay, which room bracketing
exists to prevent (`03 §2.8`: one room per gameplay instance).

## The fix: identity, not a boolean

A `bool m_room_open` can't tell "this run is finished" from "nothing is open yet". Give the tick a **run identity**
and refuse to reopen one already closed:

```cpp
// game side — one line
LudeoHooks::RunTick(m_run_id);                    // unique per gameplay segment (bumped on every level load)

// LudeoManager
void LudeoManager::RunTick(uint64_t runId) {
    if (runId == m_finished_run_id) return;      // already closed this run — never reopen
    m_current_run_id = runId;
    if (!m_room_open && CanOpenCreatorRoom()) OpenRoom(nullptr);
}
// on every close path
m_finished_run_id = m_current_run_id;
```

The late-readiness self-heal survives: the retry uses the same `m_current_run_id`, which isn't the finished one.

Pick a key genuinely unique per gameplay segment — a counter bumped on each level load, or the controller instance
if it's recreated per load. A level **name or index** does not work: playing the same level twice must be two runs.

## How to spot it before a human does

Grep the run log for an `OpenRoom` following a `Room_Close` with no gameplay between, against the level-load trail.
The tell is a close-then-open pair inside one level, or — the loud one — `Begin` landing **after** the menu loads.
A compile gate can't catch any of this; it only shows in a real run, which is why the run gate is not optional.

Related: `learnings/common-mistakes/ending-a-recording-is-async-do-not-shut-down-on-the-next-line.md`.
