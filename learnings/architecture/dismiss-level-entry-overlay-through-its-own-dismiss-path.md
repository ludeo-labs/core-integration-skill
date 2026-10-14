---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: "3,5"
question: "Does the game show a load-progress / intro / tip overlay on level entry that pauses the game until dismissed, and does it appear in cloud replays even if fast local loads skip past it?"
sanitized: true
origin: "unreal:architecture/suppress-nonludeoable-overlay-in-player-flow-by-replicating-its-dismiss"
---

# Dismiss a level-entry overlay in Player Flow by running its own dismiss path

**Applies when** a level-entry overlay (load progress, intro/briefing, "tip of the day") appears when the
playable level loads, often **pauses the game** while it is up, and shows in cloud replays. A cold load on the
streaming machine keeps it on screen, while fast local loads may skip it, so local testing can miss it entirely.

This is a **flow-blocking** start-of-run mechanism (`07 §9.11`). It doesn't corrupt the snapshot. It stands in
front of it, and if it pauses the game it can stall the restore before it reaches active gameplay.

## Why not "prevent it from showing"

The code that creates the overlay is often buried in a data-driven UI manager and hard to pin down. You don't
need to find it. The overlay is a known UI type, so on the restore path you can **dismiss it after it appears**,
whoever showed it.

## The pattern

While the restore waits to reach active gameplay (each poll, gated on `IsRestoring()`), find the overlay
instance and do **exactly what its Continue/close button does**:

```cpp
for (UiWidget* w : ui.ActiveWidgetsOfType(OverlayType)) {
    w->OnContinue();        // the button's own handler, so the game's continue/proceed logic runs
    ui.Remove(w);           // visual backstop
    removedAny = true;
}
if (removedAny && game.IsPausedByUi()) game.SetPaused(false);   // the overlay paused the game; undo it
```

Three parts matter:

1. **Run the dismiss, don't just hide the widget.** The continue handler often does game work (advances a
   load step, releases a gate). Hiding the widget alone can leave the flow stuck.
2. **Undo the pause.** If you only remove the widget, the game can stay paused, and a restore that needs time
   running to reach active gameplay hangs before `OpenRoom`.
3. **Do it in the wait loop.** The overlay can appear before your restore code runs, and it waits for a click.

Gate it on the restore/replay path only. In Creator Flow the overlay is part of the real player's experience.

## Finding the overlay

If you don't know which UI element it is, grep the localized string table for the exact text the user saw. The
string's source reference usually names the owning UI asset, which is faster than hunting through UI code.
