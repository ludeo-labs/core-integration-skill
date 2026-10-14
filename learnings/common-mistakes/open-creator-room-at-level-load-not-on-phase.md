---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "3"
question: "Does the game have a warmup / pre-round / intro phase between level load and active play, tempting you to delay the Creator-Flow OpenRoom until a 'gameplay start' phase?"
sanitized: true
origin: "unreal:common-mistakes/open-creator-room-at-level-load-not-on-phase"
---

# Open the Creator room at level load; room timing is not why `RoomReady` is missing

**Precondition:** the game has a phase between level load and active play.

> **Correction first.** An earlier version of this lesson claimed that a Creator room opened *late* "never receives
> `RoomReady`". That was a misdiagnosis. Opening early or late made no difference: both runs logged
> `unknown event_name "…"` and no `RoomReady`. The cause was a stale SDK build (`11 §9`,
> `learnings/common-mistakes/sdk-build-version-must-match-current-backend.md`).

## The rule (consistency, not a fix)

Open the Creator room when the level starts loading (CR-009), skipping only non-gameplay maps, and decoupled from
any warmup or round phase. `Begin` stays gated on `player_added && room_ready` (`05 §6.6`). Whether a warmup
belongs in captured play is a separate decision: if it must not become a Ludeo, mark it with the non-ludeoable
pair (`06 §7.3`). Don't move `OpenRoom`.

`AddPlayer` stays callback-driven (CR-009): `OnRoomOpenedCallback` queues it (`03 §8.3`). Because the room opens at
load start, the game's player object may not exist yet — so don't resolve "the local player" synchronously at room
open. If the player id comes from a per-player object created when the player joins, keep a pending-players queue:
the room-opened handler adds the players already known, and a player who joins after the room is open is added
(queued, outside any SDK dispatch) once both the room and the id exist (`05 §6.4`: add every participating player).

## What this does and doesn't fix

- **Does:** keeps the room lifecycle tied to the level, not to a gameplay phase, and adds the player promptly.
- **Doesn't:** make `RoomReady` fire. If it never arrives, especially with an `unknown event_name` warning after
  `AddPlayer`, check the SDK build against the backend before touching room timing, and never force `Begin`
  (`learnings/common-mistakes/never-force-begin-without-roomready.md`).
