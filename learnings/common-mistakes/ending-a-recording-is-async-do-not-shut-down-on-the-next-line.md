---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: "3"
question: null
sanitized: true
origin: "unity:common-mistakes/ending-a-recording-is-async-do-not-shut-down-on-the-next-line"
---

# Ending a gameplay session is a network round-trip — releasing on the next line cancels it

The obvious quit path is wrong:

```cpp
void Game::OnQuitRequested() {
    LudeoManager::Instance().EndGameplaySession(/*isAbort=*/true);   // ludeo_GameplaySession_End
    LudeoManager::Instance().Shutdown();                             // ludeo_Session_Release, ludeo_Shutdown
}
```

`ludeo_GameplaySession_End` is **asynchronous** (CR-003): it posts to the backend and calls back on completion.
Releasing the session on the next line makes the SDK cancel every request still in flight. Observed in the SDK log:

```
Async function ludeo_GameplaySession_End (callbackId 4)
HTTP ... POST .../gameplays/end
Async function ludeo_Session_Release                  ← the shutdown, 3 ms later
Core:Warning 4 Interfaces still alive at shutdown: Session, Room, DataWriter, GameplaySession
Core:Error   Client still holding a handle to a Room instance
Core:Error   ludeo_GameplaySession_End failed with LudeoResult::Canceled
```

The same call took **190–620 ms** elsewhere in that session; three milliseconds was never enough. **It fails silently
where it matters:** the call *is* issued, the code *looks* like it satisfies CR-007, nothing throws. Only the SDK log
says `Canceled`.

## The fix has two parts — the first alone is not enough

1. **Chain teardown to the completion callbacks**, never the next statement: `End` → remove player → `ludeo_Room_Close`
   → then release and shut down.
2. **Keep the process alive until it lands.** On quit there may be no next frame to deliver those callbacks, so pump
   the operation queue and `ludeo_Tick()` in a **bounded** loop (a few seconds) until the room-closed callback fires,
   then release and shut down; on timeout, log it and shut down anyway — never hang the exit (`05 §7.4`). If the
   window-close path lets the engine destroy itself first, intercept the close request and defer the actual exit.

**Don't rely on the quit path as the main place to close a recording.** Also hook the game's own "player chose to quit"
site, which fires before the engine starts tearing down and has real time to work with.

## How to catch it

Static review and a clean compile both pass. **Grep the run log for `Canceled`, `still alive at shutdown` and
`still holding a handle` after any session-teardown work** — those three strings are the signature.
