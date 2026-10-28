---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: "6"
question: "Does the game route its full-screen UI through a single 'active screen' / UI-state value on the HUD or a UI manager — one value per overlay, plus a resting gameplay value?"
sanitized: true
origin: "unreal:architecture/hud-active-screen-enum-as-nongameplay-signal"
---

# A single "active screen" value covers every UI overlay at once

**Precondition:** the HUD or UI manager tracks which full-screen UI is up in one variable — an enum whose resting
value means "gameplay / none" and whose other values name overlays (inventory, in-game menu, document, examine,
puzzle, save/load, …).

## Why it helps

Phase 6 must mark non-gameplay UI with the standard actions, by trigger type (`06 §7.3`): **every** non-gameplay screen takes
`StartNoneLudeable` / `StopNoneLudeable`, and a screen that also **pauses** the game takes `PauseLudeo` / `ResumeLudeo`
around it (pause first, non-ludeoable nested inside). Asked to cover "the pause menu and the inventory", hunting for a separate
flag per overlay is fragile — each lives in a different widget, and you won't know them all.

If the game already collapses "which full-screen UI is up" into one value, that value is a complete signal: **non-
resting means an overlay is open**, including overlays you never enumerated.

## How to apply

```cpp
// Polled each frame by the integration
const int screen = hud.CurrentActiveScreen();
const bool anyScreenUp     = screen != kGameplayScreen;                                // → StartNoneLudeable / StopNoneLudeable
const bool pausingScreenUp = anyScreenUp && IsPausingScreen(screen);                   // → PauseLudeo / ResumeLudeo, opened first
```

Map **each enumerator** to its trigger type, report only transitions (one start and one end per span, on every exit
path), and fold the pausing case into the same pause report the game's other pauses use.

## Caveats

- **Confirm the resting value.** It is usually the enum's default (0), but verify against the declaration and at runtime
  — open an overlay and check that the expected action fires.
- **Broader than asked.** Non-resting also catches document, examine and puzzle screens. Harmless for most scopes; if a
  screen must stay ludeoable, exclude its enumerator explicitly.
- Record the variable, its values and the mapping in `GAME_ACTIONS_MAP.md`.
