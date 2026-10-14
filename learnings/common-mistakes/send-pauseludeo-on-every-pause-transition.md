---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "6"
question: null
sanitized: true
origin: "unreal:common-mistakes/report-every-pause-detect-state-not-per-callback"
---

# Send `PauseLudeo` for every pause: detect the state change, don't wire it per callback

## What happened

The agent sent `PauseLudeo` from inside the `PauseGameRequest` handler. The action is required for that pause, but
the wiring was wrong. Hanging it off the callback covers only SDK-initiated pauses. It misses every pause the game
starts itself (pause menu, cutscene, loading screen, focus loss), and it double-sends when a state detector is
also running.

## The action is not optional

Freezing the game doesn't stop the Ludeo objective timer. The backend stops the clock only when `PauseLudeo`
reaches its Pause/Resume Global Trigger (`06 §7.3`, CR-011). The platform doesn't infer the pause from having
requested it. So answering `PauseGameRequest` is **necessary but not sufficient**: freeze **and** send.

## The pattern

Send on the **game's actual pause-state transition**, detected by a poll that runs while the game is paused.
The detector doesn't care where a pause came from, so one emit site covers the overlay request, the pause menu,
cutscenes and focus loss:

- **SDK → game:** `PauseGameRequest` freezes the simulation through the game's pause primitive. Don't open the
  game's own pause menu; the overlay is already up.
- **Game → SDK:** the detector sees *paused* and sends `PauseLudeo`; on *resumed* it sends `ResumeLudeo`. Each
  pause is sent once.

Guard it with a span flag (`phase 6 · task 2` Step 5), so a pause seen through two paths is sent once and a resume
never fires without a matching start. The goal is **every pause, exactly once**, not "skip the ones the SDK asked
for".

**Caveat:** if the game pauses without flipping the signal the detector polls (a custom paused flag, a time-scale
of zero), the detector never fires and the overlay pause is never sent. In that case send it from the handler and
suppress the duplicate (`learnings/common-mistakes/find-the-games-authoritative-pause-path.md`).
