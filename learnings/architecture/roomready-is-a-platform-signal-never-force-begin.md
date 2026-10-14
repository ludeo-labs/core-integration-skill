---
category: architecture
tier: universal
sourceGame: multiple
phase: "3,5"
question: null
sanitized: true
origin: "unreal:architecture/onroomready-is-the-viewer-connected-gate"
---

# RoomReady is the platform's signal, not "the room calls succeeded" — never force Begin past it

## What RoomReady is

`RoomReady` (registered with `ludeo_Session_AddNotifyRoomReady` at session creation) comes from the platform side. It
is **not** any of the nearer success points that can complete seconds earlier — or with nobody on the other end:

- `ludeo_Session_OpenRoom` succeeding (its callback, the room-start request returning 201);
- `ludeo_Room_AddPlayer` succeeding (its callback, the join request returning 201);
- the platform's "gameplay ready" request returning 201.

Seeing those succeed and concluding "the room is ready, begin" is the classic mistake. In Player Flow the platform
**withholds `RoomReady` until the viewer presses Play** (`05 §6.11`); on the cloud, the wait before that includes the
viewer's stream connecting. A long `AddPlayer → RoomReady` gap is a person, not SDK latency.

## The begin gate

`Begin` needs `player_added` **and** `room_ready` (and, in Player Flow, `applied`); the callbacks arrive in either
order, so `TryBeginGameplaySession()` runs from both (`05 §6.6`). If `RoomReady` never arrives, keep waiting — the
platform bounds a session that never connects — and log the elapsed wait for diagnosis. **Never** force-begin, retry,
or arm a timeout on the `AddPlayer → RoomReady` wait (`learnings/common-mistakes/never-force-begin-without-roomready.md`);
bound only the `OpenRoom` + `AddPlayer` leg
(`learnings/architecture/room-ready-is-the-players-play-click.md`).

**Diagnostic tell:** a log with `OpenRoom` / `AddPlayer` / "gameplay ready" all 201, a multi-second gap with only SDK
ticks, then `Begin` — and no `RoomReady` line in between. That `Begin` did not come from a real room-ready; something
forced it. The fix is in the integration's gate (or the platform's viewer connection), not in the game.

## Local runs get it too

Locally — a dev build, a `--ludeo=<id>` launch, the web "play local" — `RoomReady` arrives as well, delivered through
the SDK overlay. There is no "local replay has no viewer, so it can never become ready" case. An agent built exactly
that theory once; the human's correction: it always arrives, it comes from the overlay, it works in every other game.

## When it is missing on a later room

If the first room got `RoomReady` and a later one doesn't:

1. **Audit the previous room's teardown first.** Did `End` → remove player → `ludeo_Room_Close` all complete, with a log
   line each? A teardown that stopped midway — its continuations owned by an object the level destroyed — leaks a
   zombie room that breaks notification routing for the next one
   (`learnings/architecture/session-lifetime-work-needs-session-lifetime-owner.md`).
2. Only once the lifecycle is proven clean, look at the platform or connectivity.

Register the notification once, at session creation, on the session-lifetime owner — never per room
(`learnings/architecture/session-lifetime-work-needs-session-lifetime-owner.md`).
