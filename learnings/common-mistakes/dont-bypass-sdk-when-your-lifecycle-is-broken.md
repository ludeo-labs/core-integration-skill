---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "3,5"
question: null
sanitized: true
origin: "unreal:common-mistakes/dont-bypass-sdk-when-your-lifecycle-is-broken"
---

# An SDK notification that worked once and then stops: fix your lifecycle, don't bypass the SDK

## What happened

On the first Ludeo played, the SDK sent `PauseGameRequest` when the overlay opened and the handler froze the game
correctly. On the **second** Ludeo, picked from the overlay without quitting, `PauseGameRequest` never arrived.
The agent proposed "stop relying on the SDK's pause request and pause ourselves when we detect the overlay".

The user rejected it, rightly:

1. The notification works reliably in other games.
2. If it doesn't arrive in this game, something on **our** side has broken the SDK's state.
3. A game-side workaround hides the real bug and moves the integration away from the canonical pattern.

## The real bug

The replay → replay path started the async end chain (`ludeo_GameplaySession_End` → remove player →
`ludeo_Room_Close`) and then immediately destroyed the object that owned the pending callbacks. The old room
never finished closing on the SDK side, and later overlay notifications went to that zombie room instead of the
new one.

**Fix:** let the chain complete before starting the next restore. The core's `end_current_ludeo(then)` runs the
new restore only in `then`, after the close completes (`07 §2.6`), with each step queued rather than issued from
inside the previous callback (CR-009, `03 §8.3`). Keep the `LudeoManager` and its callback registrations alive
across the transition.

## The rule

When an SDK notification works in one scenario and not in another **in your game**, assume you broke the SDK's
state.

1. Confirm the mechanism works at all here (it worked the first time).
2. Identify what differs between the working and failing scenarios: usually replay 1 vs replay 2, a level
   reload, or a back-to-menu in between.
3. Look on your side: an object destroyed mid-teardown, a registration lost, a room or session not closed, a
   stale flag (`07 §2.6` lists the usual ones).

Never propose "bypass the SDK and do it ourselves" as the fix. The same applies to `RoomReady`: never call `Begin`
without it.
