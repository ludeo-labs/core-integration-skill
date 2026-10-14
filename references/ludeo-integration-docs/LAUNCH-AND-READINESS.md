# LAUNCH-AND-READINESS.md — Launch Models & the SDK-Readiness Gate

> **Purpose:** The startup shape a game needs when there is no main menu to hide the SDK's async activation  
> **When to load:** Planning or implementing the lifecycle (`phase 3 · task 3` / `phase 3 · task 4`) for a game that
> **boots straight into gameplay**, has a **fast or auto-starting menu**, or is **launched into a preselected Ludeo**.
> A classic click-through main menu needs only §1 and §6.  
> **Prerequisites:** [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) §4–§5, [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) §2.1

This is a lifecycle-*shape* rule, not a genre pattern: it decides where `ludeo_Session_Activate` and the first room
sit relative to the game's own boot and auto-start. It can't be read from the code alone, and if missed it surfaces late
as "the first room never records" or "the cloud machine never reports ready."

---

## Contents

1. [Decide the launch model](#1-decide-the-launch-model)
2. [The menu was an implicit waiting room](#2-the-menu-was-an-implicit-waiting-room)
3. [The readiness gate and the idle "ready" state](#3-the-readiness-gate-and-the-idle-ready-state)
4. [Preselected-Ludeo launch — suppress the game's own auto-start](#4-preselected-ludeo-launch--suppress-the-games-own-auto-start)
5. [SDK activation competes with game boot](#5-sdk-activation-competes-with-game-boot)
6. [The cloud needs an idle, ready state before any room opens](#6-the-cloud-needs-an-idle-ready-state-before-any-room-opens)
7. [Validation checklist](#7-validation-checklist)

---

## 1. Decide the launch model

Ask, and cross-check against the default level / boot-flow code:

- **On launch, does the game drop the player straight into a playable level, or through a frontend first** (main menu,
  lobby, press-start)? If there is a menu, is it a deliberate click-through, or does "Play" load and start immediately?
- **Does the game ever auto-continue, skip the intro, or boot directly into a session** (a "continue" path, a debug
  auto-enter)? These skip the menu's implicit wait the same way a menu-less boot does.

| Launch model | Needs |
|---|---|
| **Menu-gated** — a click-through menu | Nothing extra; §6 still applies (the menu *is* the idle state) |
| **Fast menu / auto-start** — "Play" loads and starts at once, auto-continue, skipped intro | Readiness gate on the start trigger (§3) |
| **Boot-straight** — the first level the game loads is gameplay | Readiness gate + idle "ready" state built from the game's own pause/in-game menu (§3, §6) |
| **Launched preselected** — `--ludeo=<id>` / `activationLudeoId` locally, a cloud Player-Flow session in production | Auto-start suppression (§4), on top of whichever row above applies |

Record the answer in the lifecycle plan (`phase 3 · task 3`) so `phase 3 · task 4` wires the right shape.

## 2. The menu was an implicit waiting room

A classic main menu quietly does three jobs for the SDK:

1. **It absorbs the async `Activate`.** `ludeo_Initialize()` and `ludeo_Session_Create()` are synchronous;
   `ludeo_Session_Activate()` is not — its result arrives in `OnSessionActivatedCallback` (`05 §5`). While the player
   reads the menu, activation finishes.
2. **It is the idle, ready surface.** No room is open and nothing records, so on a cloud machine the streamer can attach
   and the machine can report ready before the platform sends a Ludeo (§6).
3. **It is where the create-vs-play branch resolves.** A `LudeoSelected` that arrives at the menu drives the Player Flow
   from a quiet state with no run to tear down — `07 §2`'s "no Ludeo run active yet" case. If nothing arrives, the
   player's own "Play" starts a Creator run.

A boot-straight game has none of these. **The SDK never blocks**: nothing waits for activation, and a Creator
`OpenRoom` dispatched before the activate callback returned `Success` has no active session to open against
(`11 §6.7`). The result is no room, no `RoomReady` and no `Begin`, usually with no error anyone notices. You replace
the menu's implicit wait with **integration code**: the readiness gate and an explicit idle state.

## 3. The readiness gate and the idle "ready" state

**Don't gate the level load — gate the first interactive frame.** Load the game's first level immediately; that load
*is* the latency-hiding window the menu used to provide. Hold only what would start a run: player control, the game's
own run start (timers, waves, spawners) and the Creator `OpenRoom`.

**Then idle, and open a room only on an explicit trigger.** Once the level is fully loaded (not mid-stream —
CR-010 "Freeze vs suppress"), enter the **idle "ready" state**: freeze the sim, show the game's own pause or in-game
menu over the level, suppress auto-spawners, and set `m_awaiting_start`. That state stays up until one of two triggers:

| Trigger | Flow |
|---|---|
| `LudeoSelected` (platform, or the launch-arg dispatch in §4) | Player Flow — `07 §2.1`. Idle ends at the **commit** (step 3), not in the handler (step 1 touches nothing); an ignored selection leaves the idle state up |
| The player starts (closes the idle menu / presses start) **and the gate has released** | Creator Flow — force-unpause, start the run; the `05 §6.2` hook opens `OpenRoom(nullptr)` if the session is active, else the run plays uncaptured |

The idle freeze is its **own** pause source. Give it its own bit next to the CR-010 restore bit and the CR-011 overlay
bit, so that the engine is paused if any bit is set. Never fold it into one shared `m_paused` (CR-011 "INDEPENDENT").

### 3.1 The gate is bounded, with a fallthrough — or the game is unlaunchable offline

The gate is a **bounded** wait. It releases on any of:

1. **Activate succeeded** → the session is active, and the next start trigger opens a Creator room.
2. **Activate failed** → start **uncaptured**. The game plays normally (CR-001: a missing or failed SDK never blocks the player).
3. **No activate callback within the timeout** (offline, auth failure, no Steam — e.g. 15 s, the same order as the
   reader timeout in `07 §2.2.1`) → start **uncaptured**.

An unbounded gate hangs the game at the idle menu forever on an offline machine. If `Activate` succeeds **after** the
timeout, mark the session active, but don't open a room mid-run: Ludeo becomes available from the next start trigger.

```cpp
// Readiness gate — integration code on LudeoManager, not an SDK feature. Always releases.
enum class LudeoReadiness { Pending, Ready, Unavailable };

void LudeoManager::Initialize() {
    // ... ludeo_Initialize → ludeo_Session_Create → RegisterNotifications (05 §4) ...
    m_pending_local_ludeo_id = ParseLaunchLudeoId();          // --ludeo=<id>, else activationLudeoId (phase 5 · task 3 Step 3)
    m_launching_into_ludeo   = !m_pending_local_ludeo_id.empty();
    m_readiness              = LudeoReadiness::Pending;
    m_readiness_deadline     = Now() + kActivateTimeout;
    ActivateSession();                                         // async — result in OnSessionActivatedCallback (05 §5)
}

void LudeoManager::OnSessionActivatedCallback(const LudeoSessionActivateCallbackParams* data) {
    if (data->resultCode != LudeoResult::Success) { ReleaseGate(LudeoReadiness::Unavailable); return; }
    m_session_active = true;
    if (m_readiness != LudeoReadiness::Pending) {              // gate already fell through: no room mid-run
        LUDEO_LOG("[Ludeo] activated late — available from the next start");
        m_pending_local_ludeo_id.clear(); m_launching_into_ludeo = false;
        return;
    }
    ReleaseGate(LudeoReadiness::Ready);
    if (!m_pending_local_ludeo_id.empty()) {                   // preselected launch: dispatch once, now (§4)
        const std::string id = m_pending_local_ludeo_id;
        m_pending_local_ludeo_id.clear();
        QueueOperation([this, id] { OnLudeoSelected(id); });   // the SDK's own handler → 07 §2.1 step 1 — queued:
                                                               // GetLudeo must not be issued inside Activate's dispatch (03 §8.3)
    }
}

void LudeoManager::ReleaseGate(LudeoReadiness r) {
    m_readiness = r;
    if (r == LudeoReadiness::Unavailable) { m_pending_local_ludeo_id.clear(); m_launching_into_ludeo = false; }
}

void LudeoManager::Update() {                                  // per frame, next to the CR-010 candidate timeout
    if (m_readiness == LudeoReadiness::Pending && Now() > m_readiness_deadline)
        ReleaseGate(LudeoReadiness::Unavailable);              // offline / no auth / no callback → uncaptured
}

// The game's start trigger asks this before leaving the idle state.
bool LudeoManager::CanStartRun() const {
    return m_readiness != LudeoReadiness::Pending && !m_launching_into_ludeo;
}
```

Wrap all of it in `#if LUDEO_SDK_ENABLED` (CR-001). With the SDK compiled out, `CanStartRun()` is simply `true` and
the game boots as it always did.

## 4. Preselected-Ludeo launch — suppress the game's own auto-start

When the game is launched to play a Ludeo, it must **not** run its normal boot-into-a-run: no Creator run, no Creator
room, no player control. Otherwise it records the boot as a new Ludeo, or races the restore for the world.

- **Where the id comes from.** Locally: `--ludeo=<id>` or `activationLudeoId` in `ludeo.ini` (`phase 5 · task 3` Step 3). The
  id is parsed at startup, stashed in `m_pending_local_ludeo_id`, and dispatched to the same `OnLudeoSelected`
  handler **only after `Activate` succeeds**. In the cloud, the platform sends `LudeoSelected` itself — and only once
  the machine idles in a ready state (§6). Shipped builds keep `activationLudeoId` empty (`phase 7`).
- **Suppress from parse time, not from `LudeoSelected`.** The launch id is known before activation completes, so
  `m_launching_into_ludeo` blocks the start trigger (`CanStartRun()`) from the moment it is parsed. `SetRestoring(true)`
  can't do this job: it is only set at the commit (`07 §2.1` step 3), after validation, and the game's auto-start
  would already have fired by then. From the commit on, `IsRestoring()` and the restore's own input hold and freezes
  take over (`07 §9.11`).
- **Clear the suppression on every outcome.** Commit → the restore owns the game; clear the flag. Selection
  **ignored** (`GetLudeo` failed, the reader never populated, the entry identity isn't playable — `07 §2.2.1`) → clear
  the flag, and the game falls through to its normal idle/start. Activation failed or timed out → `ReleaseGate`
  clears it (§3.1). A flag that is never cleared leaves the game stuck at the idle menu.
- **The world may already be live.** A boot-straight game has its default level loaded and idling when `LudeoSelected`
  commits. Step 4 ("reach active gameplay on the captured level") must **reset or reload** that level into a fresh run
  on the captured entry, not assume a fresh boot. Because the suppression kept a Creator run from starting, there is
  no room to tear down: this is still `07 §2`'s "no Ludeo run active yet" case.

## 5. SDK activation competes with game boot

`ludeo_Tick()` runs on the game thread (CR-005) and processes **all** pending SDK network responses and their callbacks
there. During activation the SDK walks a chain of backend requests (authentication, configuration, the attribute and
action schema, activation complete). Slow responses can make individual ticks hold the game thread for a long time.
A game whose own boot is a multi-step **async** chain — a state machine, asset-load callbacks, delegate chains that
fire "next frame" — can stall behind it, and the loading screen hangs indefinitely, **only with the SDK enabled**.

**Diagnose:** log the duration and frequency of `ludeo_Tick()` during boot. Ticks far apart (under one per second) or
individual ticks lasting seconds while the boot chain waits mean the SDK is starving the game thread.

**Mitigate, cheapest first:**

1. **Keep rooms and per-tick tracking out of boot and menu states.** No room opens until an explicit start trigger
   (§3, §6), and the tracking adapter doesn't run outside gameplay. This removes most SDK traffic from the boot window.
2. **Defer activation** until the game's boot chain reaches its menu or idle state: call `ActivateSession()` from that
   "boot done" hook instead of straight after `ludeo_Initialize()`. Activation is still before any gameplay and still
   after the window exists (`05 §5`), and the launch-arg dispatch still waits for the activate callback (§3.1). This
   is the one documented exception to `05 §5`'s "activate immediately after initialization". Use it only when the
   stall is observed.
3. **Report it to the SDK owners** with the tick timings — a tick that blocks for seconds is an SDK-side issue.

**Never "fix" it by skipping or throttling `ludeo_Tick()`** — that breaks every callback (CR-005).

## 6. The cloud needs an idle, ready state before any room opens

On a cloud machine the platform launches the game. A **streamer/overlay** must then attach, and the machine must
report **ready**, before the platform sends a Ludeo (`LudeoSelected`). If the integration opens a room and starts a
gameplay session **at boot** — a Creator room the moment the first level is ready — the machine never shows that
idle state. The streamer never connects, the machine never reports ready, and no Ludeo ever arrives.
**Local runs don't show this** (there is no streamer to wait for), so a local smoke test passes; it fails only in
the `phase 7` cloud run.

So, at boot, separate **"session activated / level loaded"** from **"room opened / gameplay started"**:

- **Menu-gated game:** the menu is the idle state. Don't open a room until the player starts a level.
- **Boot-straight game:** the idle state is the game's **own pause or in-game menu over the loaded level** (§3). The
  same build runs locally and in the cloud, so don't auto-fire the start trigger at gate release on the assumption
  that the build "never runs in the cloud" — an uploaded build does.

Gotchas:

- **Key the start trigger on the menu/UI state** ("idle menu closed"), not on a generic pause flag, and
  **force-unpause** on start rather than relying on the menu's own resume path to clear every pause source.
- **Arm the "menu closed → start" detector only once the menu is confirmed up**, or the first frame — before the
  menu appears — false-starts.
- **Don't enter the idle freeze during async loading or streaming.** Enter it only after the level has fully loaded.
  A freeze over a load that waits on frames deadlocks (CR-010 "Freeze vs suppress").
- **Leave idle at the commit of a validated selection** — clear the idle bit, hide the menu, hand spawner suppression
  to `IsRestoring()` — so the Player Flow's load isn't fighting a frozen world. An ignored selection leaves idle up.
- **Nothing records during idle:** no room is open, and per-tick tracking and SDK writes stay gated on the run having
  started.

## 7. Validation checklist

- [ ] Launch model recorded in the lifecycle plan (§1); boot-straight / fast-menu / preselected games have the gate.
- [ ] The level **load** is not gated — only the first interactive frame, the game's run start and the Creator `OpenRoom`.
- [ ] No room opens at boot. The game idles in a ready state (menu, or the game's own pause/in-game menu) until an
      explicit trigger: the player starts (Creator) or a `LudeoSelected` commits (Player, `07 §2.1`).
- [ ] The gate is **bounded**: activation failure or timeout falls through to an **uncaptured** game; an offline launch
      never hangs at the idle menu. A late `Activate` success opens no room mid-run.
- [ ] The idle freeze is its own pause bit (CR-011 independence) and is never entered mid-load.
- [ ] Preselected launch: the game's auto-start is suppressed from parse time; the launch id is dispatched once, only
      after `Activate` succeeds; the suppression clears on commit, on an ignored selection and on gate fallthrough.
- [ ] Preselected launch on a boot-straight game: step 4 resets/reloads the already-loaded level to the captured entry.
- [ ] Boot with the SDK enabled reaches the menu/idle state as fast as with it disabled. If not, `ludeo_Tick()`
      timings were logged and §5 applied — without skipping ticks.
- [ ] `phase 7` cloud run: the machine reports ready and a Ludeo arrives. A boot-time room would block this, and no
      local test can catch that.

---

## 🔗 Cross-References

- [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) §5 (activation), §6.2 (Creator `OpenRoom` hook), §6.12 (flow spines)
- [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) §2.1 (Player Flow order), §2.2.1 (reader readiness), §2.5 (launch-arg trigger), §9.11 (start-of-run suppression)
- [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) CR-001, CR-005, CR-010 (freeze vs suppress), CR-011 (independent pause bits)
- [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) §6.7 (SDK call before `Activate`)
- `phase 5 · task 3` Step 3 ([5d-implement-restoration-flow.md](../5d-implement-restoration-flow.md)) — the `--ludeo=<id>` / `activationLudeoId` launch path
