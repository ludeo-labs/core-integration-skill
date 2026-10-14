---
category: common-mistakes
tier: universal
sourceGame: PlatformerSample
phase: "3,5"
question: null
sanitized: true
origin: "unity:common-mistakes/roomready-is-the-press-play-signal-so-applying-there-hides-the-moment"
---

# `RoomReady` is the press-Play signal — anything the viewer must see before Play can't be gated on it

CR-010 fixes the order: the restored moment is built, settled and frozen **before** `OpenRoom(ludeoId)`, and
`RoomReady` only resumes it. This lesson is the evidence for why, and the traps that survive even a correct order.

## The thing that is easy to not know

On the Player Flow, **`RoomReady` doesn't fire when the room is ready. It fires when the viewer presses Play** on the
overlay; the platform withholds it until then. Any restore log shows it once you look:

```
14:36:0x  AddPlayer: Success
                              <-- ~13,500 log lines: a person reading the overlay
14:36:2x  RoomReady
```

If you measured a multi-second `AddPlayer → RoomReady` gap and filed it as "SDK latency", it wasn't latency. It was
the viewer. Don't "optimize" it, and don't put a timeout on it that tears the restore down.

## What breaks when work hangs off `RoomReady`

An integration that applied at `RoomReady` and dropped its loading cover in `Begin`'s callback put **both after the
press**: the viewer stared at a flat black cover behind the overlay and pressed Play on nothing. The ordering
checklist passed — "the first frame after my cover drops is the finished scene" — while the real requirement failed:
**the first frame revealed behind the overlay** must be the finished moment. The product is *look at the moment,
then take control of it*.

## Traps that survive the correct order

1. **Drop every cover before `OpenRoom`**, not in `Begin`'s callback. Once the room opens, the overlay can present
   Play over whatever is on screen; a cover still up at that instant hides the moment.
2. **The last write before the freeze is the last thing before the viewer sees the scene.** Anything that settles
   after it — an async spawn, a deferred re-assert, a camera blend (`07 §8.4`) — is a **visible pop** behind the
   overlay, not a log detail. It belongs in the settle (`ApplyDeferred()`), before the second freeze.
3. **`Begin` stays gated on `applied`** (`TryBeginGameplaySession()` needs `player_added`, `room_ready` and
   `applied`). `Begin` starts SDK recording; Begin-before-apply records the default state as the playthrough's
   opening — the one ordering error that silently corrupts data.

## Where else this reasoning applies

Any choice that reads as "ordering-equivalent, pick either" where one branch is gated on a **human action** rather
than machine readiness. An ordering checklist can't see the difference; only asking *"what's on screen, and who is
waiting for whom?"* can.

Related: `learnings/architecture/room-ready-is-the-players-play-click.md` (time-outs and overlay behaviour around the
click), `learnings/common-mistakes/never-force-begin-without-roomready.md`.
