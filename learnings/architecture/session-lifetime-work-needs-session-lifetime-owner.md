---
category: architecture
tier: generalizable
sourceGame: multiple
phase: "3,5"
question: "Does the integration hang any session-lifetime SDK work — notification handlers, or the continuations of the End → RemovePlayer → Room_Close teardown chain — on an object that lives only as long as a level or scene?"
sanitized: true
origin: "unreal:architecture/detached-teardown-for-game-initiated-travel, unreal:architecture/bind-session-notifications-once-at-subsystem-not-per-room"
---

# Session-lifetime SDK work must be owned by a session-lifetime object

**Precondition:** the integration has a per-level object (a level component, a scene node, the game-mode instance)
that is destroyed on level change, and some SDK work is routed through it. With all SDK work on the `LudeoManager`
singleton (`05 §1`) this cannot happen — the lesson is why to keep it that way.

## The bug class (seen in two integrations)

The teardown chain is asynchronous: `ludeo_GameplaySession_End` → its callback → `RemovePlayer` → its
callback → `ludeo_Room_Close`. If the chain's continuations live on the per-level object, a **game-initiated** exit —
quit to menu, level change, restart — destroys that object in the same frame the chain starts. The first request goes
out; its completion arrives for an object that no longer exists (a dropped continuation, or in C++ a dangling
`clientData` pointer), and the chain stops.

Consequences, log-verified:

- SDK shutdown reports the room, its data writer and its gameplay session still alive.
- The **next** room on the session never receives `RoomReady` — the zombie room breaks notification routing, and the
  replay hangs at the `Begin` gate.

The same mismatch bites notifications: registering `RoomReady` (or `LudeoSelected`, pause/resume, back-to-menu) per
room on a per-level object and unregistering it on level teardown straddles exactly the window where one Ludeo is
switched for another. The first room works; a later room's notification reaches no live handler.

## The rule

Work whose lifetime exceeds the level must be owned by an object whose lifetime exceeds the level.

- **Teardown:** the per-level object only *reports* "the level is ending"; `LudeoManager::EndCurrentLudeo()` owns the
  room handles and drives the chain with its own callbacks (`05 §6.7–§6.9`). On the quit path, pump it to completion
  before `ludeo_Shutdown` (`05 §7.4`).
- **Notifications:** register every `ludeo_Session_AddNotify*` **once at session creation** (`05 §4`, "Registering
  Notifications"), on `LudeoManager`, and resolve whichever level object is live *at callback time*. Reset per-room
  **state** (`room_ready`, `player_added`) per room; never re-own the **registration**.
- Every handler queues its SDK work (`03 §8.3`), so nothing re-enters the SDK from inside a dispatch.

## Verify

Quit to the menu mid-run: the log shows `End` → player removed → room closed, all three. Then play a Ludeo: its
`RoomReady` arrives normally. If a later room's notification is missing, audit the previous room's teardown before
anything else — see `learnings/common-mistakes/dont-bypass-sdk-when-your-lifecycle-is-broken.md`.
