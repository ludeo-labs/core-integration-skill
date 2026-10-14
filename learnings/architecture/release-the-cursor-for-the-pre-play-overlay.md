---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: "3,5"
question: "Does the game capture the mouse during gameplay (game-only input, hidden or locked cursor), or drive cursor and input mode through its own UI system that re-asserts them every frame?"
sanitized: true
origin: "unreal:architecture/sdk-overlay-input-no-callback-release-mouse-yourself"
---

# The pre-Play overlay gets no input callback — release the cursor yourself, the game's way

**Precondition:** the game captures the mouse in gameplay (typical for first-person games) and/or manages cursor and
input mode through its own system.

## Symptom

The Ludeo overlay is clearly visible over the restored, frozen moment, but its **Play** button can't be clicked — the
game is swallowing the mouse. It reproduces locally and on the cloud; locally you can alt-tab out of it, on the cloud
you can't, so it is a hard blocker.

## Three causes, all confirmed from logs

1. **No game-facing callback for the overlay's input.** `PauseGameRequest` / `ResumeGameRequest` did not fire when the
   pre-Play screen appeared (zero log occurrences); they are the **mid-play** overlay requests, cloud Player Flow only
   (CR-011). The SDK manages its overlay's mouse input internally, without notifying the game. There is nothing to hook
   "overlay shown → release mouse" onto.
2. **The screen appears in Player Flow, not in a menu.** The Play button shows once the room is opened with the
   `ludeoId` (`07 §2.1` step 6) — while the moment is held frozen. Release the cursor there, not in a menu or idle
   handler.
3. **A one-shot OS-level release doesn't stick.** Showing the cursor and switching the input mode once had no effect:
   the game re-asserted game-only input every frame through its own input system.

## Fix — use the game's own release path

Find what the game's **pause menu** calls to free the mouse — the pause menu already does this correctly. Here it was a
HUD function that showed a software cursor and sent the player entity an event to stop consuming look/move input. Call
**that** at the held-moment point, and its inverse when gameplay resumes on `Begin` (`RoomReady`); add the OS-level
release only as belt and braces.

```cpp
// Moment held behind the overlay, before OpenRoom(ludeoId)
hud.EnableUiInput();      // the pause menu's own release path
// TryBeginGameplaySession(), after Begin and the unfreeze
hud.DisableUiInput();
```

## Cosmetic caveat

The game's own cursor may render **behind** the overlay locally. The cloud overlay draws its own cursor and composites
differently, so confirm on the cloud (`phase 7`) before polishing. If needed, send only the player's input-release event
without switching the game's cursor, so only the overlay's cursor shows.

Related: `learnings/common-mistakes/verify-sdk-callback-fires-before-hooking.md` — count a callback in the log before
building on it.
