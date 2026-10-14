---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "3"
question: "Is session activation, the per-level install, or the OpenRoom-on-level-load hook bound to a game 'level loaded' event that the integration subscribes to during startup — and does the boot / front-end level load before (or by a different path than) that subscription?"
sanitized: true
origin: "unity:engine-quirks/sceneloaded-does-not-fire-for-the-initial-scene-from-beforesceneload"
---

# The level-loaded hook may never fire for the first level

Applies when integration work is bound to the game's level-loaded notification. The phase-3 plan bound "activate the
session" and the per-level install to that notification, subscribed from the integration's startup code, with a
comment asserting it *"fires for the first level too"*.

It did not. The run log was unambiguous:

```
[Ludeo] 10:29:34.207 Initialize + session create: Success; Activate deferred to the first level load
[Ludeo] 10:29:34.220 Startup complete, waiting for the first level load
   ... 19 seconds of main menu, no level-load line ...
[Ludeo] 10:29:53.859 level loaded 'FirstLevel'
[Ludeo] 10:29:53.862 Activate: issuing from 'FirstLevel'
```

The front-end level loaded and ran for 19 s without the notification; the first one was the level the player picked.
Consequences: `ludeo_Session_Activate` fired from inside a level instead of the menu (a readiness cover then hid the
level for ~1 s), and in Player Flow the restore would have started from a gameplay level instead of the menu — the
ordering `learnings/architecture/activate-late-or-the-cloud-selects-before-the-game-can-load.md` warns about. The
same gap would skip the Creator-Flow "`OpenRoom` when the level starts loading" hook (CR-009) for whatever level boots
first.

Typical causes in a custom engine: the boot level is loaded synchronously by startup code before subsystems
subscribe, or through a different path than the level-transition system that raises the event. Treat "does the first
level raise it?" as a fact to verify from a log, never from a comment.

## The fix that does not depend on the answer

Handle the current level explicitly once startup is done, keep the notification for later loads, and guard against a
version that *does* fire it so nothing is handled twice:

```cpp
void LudeoManager::OnStartupComplete() {
    Levels::OnLevelLoaded().Subscribe([this](const Level& l) { HandleLevel(l); });
    if (const Level* current = Levels::Current()) HandleLevel(*current);   // the one already loaded
}

void LudeoManager::HandleLevel(const Level& level) {
    if (level.LoadSerial() == m_last_handled_serial) return;   // already handled, either path
    m_last_handled_serial = level.LoadSerial();
    // classify the level, activate once, per-level install ...
}
```

## How it was caught

Only by the trace: the integration logged every level-load notification with the level's name, and logged the level
each Ludeo call was issued **from**. Without either line this would have read as "activation works, just a slightly
long loading screen". Log both.
