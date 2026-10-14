---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: "3,6"
question: null
sanitized: true
origin: "unreal:common-mistakes/close-dangling-nonludeable-on-endgameplay"
---

# Close any open pause or non-ludeoable span before ending the gameplay session

If the session ends while a span is open, send its **end** action before `ludeo_GameplaySession_End`. Otherwise
the recording has a dangling start marker, and for a pause span the objective timer stays stopped.

Close each span **by its own type** (`06 §7.3`): a pause closes with `ResumeLudeo`, in either flow.
`StopNoneLudeable` is the non-ludeoable pair and doesn't restart the timer.

```cpp
void LudeoManager::EndGameplay() {
    // before the session leaves the active state: SendAction drops anything outside one (06 §7.1)
    if (m_pauseSpanOpen)        { SendAction("ResumeLudeo");      m_pauseSpanOpen = false; }
    if (m_nonLudeoableSpanOpen) { SendAction("StopNoneLudeable"); m_nonLudeoableSpanOpen = false; }
    m_wasPausedLastFrame = false; m_menuOverlayOpen = false;
    // … then End → remove player → ludeo_Room_Close (05 §6.7–6.9)
}
```

**Reset the span flags here and in `EndCurrentLudeo`** (`07 §2.6`). A flag left `true` makes the next run's first
pause hit the once-per-transition guard, so it's never sent.
