---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "3"
question: "Is any SDK readiness or Begin timeout implemented by accumulating per-frame delta time, or armed once to cover both the session activation wait and the OpenRoom → AddPlayer → RoomReady → Begin chain?"
sanitized: true
origin: "unity:engine-quirks/bounded-waits-need-absolute-deadlines-not-accumulated-deltatime"
---

# Bounded SDK waits: absolute deadlines, one per wait, and a fallthrough that sticks

Applies when the integration bounds its waits on the SDK (an unbounded one leaves an offline player stuck behind a
cover with no way to move). Three things about *how* you bound them matter, and all three failed in one run at the
phase-3 compile-and-run gate.

## 1. Accumulated frame delta credits time that passed before the timer existed

```cpp
// ✗ fires early, sometimes drastically
m_elapsed += frameDeltaSeconds;            // the first frame after a level load spans the whole load
if (m_elapsed >= kTimeout) Expire();
```

Arm this when a level finishes loading and the first frame's delta covers the entire load — often unclamped real
time. Several seconds of "elapsed" are credited before the timer existed: an 8-second timeout expired about a second
after it was armed.

```cpp
// ✓ cannot double-count
m_deadline = std::chrono::steady_clock::now() + kTimeout;                    // arm
if (m_deadline && std::chrono::steady_clock::now() >= *m_deadline) { m_deadline.reset(); Expire(); }   // per frame
```

## 2. One timeout must not bound two unrelated waits

| Wait | Typical | Bound from |
| --- | --- | --- |
| `ludeo_Session_Activate` → its callback (and any consent step) | **seconds** — measured 3–7 s | startup |
| `ludeo_Session_OpenRoom` → `ludeo_Room_AddPlayer` → `RoomReady` → `ludeo_GameplaySession_Begin` (Creator Flow) | well under a second | the moment `OpenRoom` is issued |

A single "Begin didn't land" timer armed at level start lets the first wait consume the second's budget. A healthy
session then trips it — and it is worse than a plain timeout, because everything afterwards still succeeds: control
goes back to the player, the log says the run is uncaptured, then `Begin` lands anyway and capture starts **mid-run**.
Arm the activation deadline at startup and the Begin deadline where `OpenRoom` is called. (In Player Flow `RoomReady`
is the viewer pressing Play — never put a short bound on it; `07 §2.1`.)

## 3. A declared fallthrough must be final

Once a bounded wait expires and control is handed back, the run must **stay** uncaptured; a late callback otherwise
starts a Ludeo in the middle of the action, which is worse than none. Latch it, and check the latch **in the begin gate
itself**, not only where the room is opened:

```cpp
void LudeoManager::TryBeginGameplaySession() {
    if (m_capture_declined_this_run) { LogOnce("[Ludeo] Begin suppressed: run already declined"); return; }
    // ... normal gates ...
}
```

Clear the latch when a new run starts, and close any room that was opened but never begun (CR-007's teardown), so the
next run does not stack on it.

## Size the bound from evidence

Read the SDK's own timestamped log lines for the activation call and its callback across several runs. On one project
that was 3.1 / 3.9 / 6.7 s — an 8-second bound was close enough to normal to misfire; 15 s was the honest floor. A
generous bound costs only on the developer's direct-into-a-level path.
