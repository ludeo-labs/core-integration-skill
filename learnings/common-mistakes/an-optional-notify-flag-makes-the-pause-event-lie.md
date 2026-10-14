---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "3"
question: "About to report pause/resume by subscribing to the game's pause EVENT? Read the pause function's signature first - if it takes a 'show the menu' / 'notify' style bool, some callers pass false and freeze the game without ever raising the event."
sanitized: true
origin: "unity:common-mistakes/an-optional-notify-flag-makes-the-pause-event-lie"
---

# An optional-notify flag makes the pause event lie — hook the function, not the event

**Precondition:** the game exposes both a pause function and a pause event, and you are choosing which to hook.

A game's pause handling looked ideal for the SDK's pause reporting: one pause function on the central controller, a
paired unpause, and an `OnPaused(bool)` event the UI already subscribed to. Subscribing would have covered every pause
— except the signature had a second job:

```cpp
// Neutral illustration of the shape — not client source
void GameController::PauseGame(bool showPauseMenu = true) {
    if (!m_paused) {
        m_sim.SetFixedStepEnabled(false); m_timeScale = 0.f; m_paused = true;
        if (showPauseMenu) FirePaused(true);       // the event is OPTIONAL
    } else { /* ...the inverse... */ }
}
```

Screens that pause the world but draw their own UI — a journal, an upgrade picker — call `PauseGame(false)`. They
freeze the game **without raising `OnPaused`**, so an event subscriber reports some pauses and silently misses others,
leaving the objective timer running through exactly the screens a player lingers on longest.

## Two more traps in the same function

1. **It is a toggle, not a setter.** Calling it to pause while already paused *unpauses*. A CR-011
   `PauseGameRequest` handler that calls it blind can resume a game the player deliberately stopped. Check state
   first, or drive the two halves explicitly — the handler must be idempotent.
2. **The paused flag clears on a delay.** Unpause restored the time scale immediately but scheduled the flag clear a
   fraction of a second later, so the flag reads "paused" for a beat after play resumed — any readiness or restore
   gate polling it sees a stale answer.

## The rule

**Hook the pause FUNCTION (and its unpause partner), not the pause event.** The function is the choke point every path
funnels through; the event is a presentation concern it may or may not raise. When mapping the pause primitive:

- read the **full signature** — a `bool` named for UI ("showMenu", "notify", "silent") means notification is optional;
- enumerate the callers and **which argument each passes**;
- check whether it is a **toggle**, and whether its state flag is written **synchronously**;
- confirm the SDK-requested pause (CR-011) routes through the same primitive as the player's, so `PauseLudeo` /
  `ResumeLudeo` are reported exactly once per transition (`phase 6 · task 2` Step 5).

Record all of it in `CODE_MAP.json` next to the primitive — the next phase reads the artifact, not the conversation.
Related: `learnings/common-mistakes/check-the-pause-primitive-for-terminal-callers.md`.
