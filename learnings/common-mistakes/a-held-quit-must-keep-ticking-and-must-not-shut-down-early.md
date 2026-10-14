---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "3,7"
question: "Does the integration hold the game's exit while the run's End and room close complete (05 §7.4) — and does it hide the window meanwhile, or can a second quit request arrive during the hold?"
sanitized: true
origin: "unity:engine-quirks/hiding-the-window-during-a-held-quit-needs-run-in-background, unity:engine-quirks/re-asking-a-held-quit-starts-the-plugins-deinit-anyway"
---

# A held quit must keep the loop ticking and must not shut the SDK down early

Applies when the quit path drives the teardown to completion before `ludeo_Shutdown` (`05 §7.4`: `End` → keep pumping
the queue and `ludeo_Tick()` in a bounded loop until the room-closed callback). Waiting is right — that last upload is
what keeps the capture. Two ways the wait itself goes wrong:

## 1. Hiding the window can stop the loop that must finish the wait

Exit looked broken: after the click the game stayed on screen for ~15 s while the run's last upload finished on a slow
network. The fix was to hide and mute the window at the first quit request and let the SDK finish out of sight.

The first version then hung forever. A hidden window counts as **unfocused**, and the game stopped its frame loop on
focus loss — so nothing pumped `ludeo_Tick()`, the room-closed callback never arrived, and the follow-up quit step
(which ran from a frame) never ran. The process sat hidden indefinitely.

Before hiding, make sure the loop keeps running unfocused (or drive the bounded teardown loop yourself, outside the
game's focus-gated update):

```cpp
void LudeoManager::HideForQuit() {
    Game::SetRunWhenUnfocused(true);   // before hiding: the teardown needs ticks
    Audio::MuteAll();
    ShowWindow(m_hwnd, SW_HIDE);
}
```

## 2. A repeated quit request must not start shutdown while the hold is active

Because nobody can click Exit on a hidden window, a timer re-issued the quit every 3 s. Each re-issue ran the full quit
path — including the shutdown step — whatever the hold said. When the player quit right after the results screen,
while the normal `End` was still in flight, the re-issue shut the SDK down first; the `End`'s completion then arrived
into a torn-down session and crashed inside the SDK during shutdown. A quit after the `End` had finished never showed
it.

**Fix:** one owner for shutdown. While the hold is active, a second quit request only records that a quit is wanted;
`ludeo_Shutdown` runs once — when the room-closed callback fires, or when the bounded give-up timeout expires (log
it). Never from a retry.

## Verify

- Quit **within a second** of a run ending (results screen) and while mid-run; grep the log for exceptions or errors
  logged during shutdown.
- Confirm the log reaches the room-closed callback and then shutdown, in that order, and that no game process is left
  running afterwards.
- Test with the window hidden, not only visible.
