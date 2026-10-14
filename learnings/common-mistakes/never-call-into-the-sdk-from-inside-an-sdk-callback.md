---
category: common-mistakes
tier: universal
sourceGame: PlatformerSample
phase: "3,5"
question: null
sanitized: true
origin: "unity:common-mistakes/never-call-into-the-sdk-from-inside-an-sdk-callback"
---

# Never issue an SDK call from inside an SDK callback — and audit every edge, not the one that crashed

The natural teardown shape closes the room the moment the session end lands:

```cpp
void OnGameplayEnded(const LudeoGameplaySessionEndCallbackParams* data) {
    LUDEO_LOG("End: %d", data->resultCode);
    CloseRoom(onDone);          // <-- issued from INSIDE the SDK's callback dispatch
}
```

It satisfies "every exit closes its room" and works most of the time. Then the process dies with no exception and no
crash log — the Windows Application event log shows `ucrtbase.dll`, exception `0xc0000409`, data `7`
(`FAST_FAIL_FATAL_APP_EXIT`, a native `abort()`). The SDK reacts to the session end by shutting down its video
encoder; a call issued inside that dispatch lands on the same tick. Two runs of the same death in one session: one
survived with 17 ms between encoder shutdown and our close; the crashed one entered the close inside the dispatch
and aborted at encoder shutdown. **Stated limit:** the native cause isn't visible from outside; what is established
is the edge, and removing the edge removed the crash. Don't claim more in a commit message.

## The rule — `03 §8.3`, CR-009

Queue the next SDK call (`LudeoManager::QueueOperation`) so it runs on the next `Tick`, outside the dispatch. Keep a
synchronous path for quit, where there is no next tick (`05 §7.4`).

## One trampoline is not the rule — audit every edge

The fix shipped and the crash came back on a different edge: selecting a Ludeo while a capture was recording
reached the teardown from inside the `ludeo_Session_GetLudeo` callback, so `ludeo_GameplaySession_End` was issued
from that dispatch. Enumerate every place the layer runs inside a dispatch and issues an SDK call:

- teardown chained off `End` (the one everybody finds) → `RemovePlayer` → `ludeo_Room_Close`;
- `LudeoSelected` issuing `GetLudeo`; the `GetLudeo` callback committing (tearing down a live run first, `07 §2.1`);
- back-to-menu / pause notifications reaching the same teardown;
- the activate callback dispatching a preselected Ludeo or opening the Creator room;
- `RoomReady` and `AddPlayer` callbacks reaching `ludeo_GameplaySession_Begin`.

## The edge that doesn't look like an SDK call

A completion continuation (`onDone`) handed out of a callback is an SDK call site — on the Player Flow it opens the
next room. Queue the visible call but invoke the continuation inline and you've moved the violation one link down.
Queue both.

## Defer the SDK call, not the bookkeeping

Teardown entry points carry an idempotence guard because exit hooks double-fire. Latch the flags synchronously and
queue only the SDK calls — deferring the whole body reopens the double-teardown the guard prevents:

```cpp
if (m_teardown_done) { QueueOperation(onDone); return; }
m_teardown_done = true;                       // the second call this frame must see it
ClearRunFlags();
QueueOperation([this, onDone] { StopTrackingAll(); EndGameplay(/*isAbort*/ true, onDone); });
```

## How to catch it

A run log whose **last line is the SDK's encoder shutdown**, with your completion log missing. Check the event log
for `0xc0000409` before assuming the player closed the game. Compare WER fault buckets across runs: the same bucket
every time (synchronous chain, ~0 ms gap) reproduces on demand; intermittent ones are a real race where "it worked
when I tested it" proves nothing.
