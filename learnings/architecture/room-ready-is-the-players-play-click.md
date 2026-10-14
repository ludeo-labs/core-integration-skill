---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "3,5"
question: null
sanitized: true
origin: "unity:architecture/room-ready-is-the-players-play-click"
---

# In Player Flow, `RoomReady` is the viewer's Play click — time-outs and diagnostics must respect that

CR-010 states the contract: `RoomReady` is withheld by the platform until the viewer presses Play, so the moment must
be fully built, settled and frozen behind the overlay before then. One integration lost several days by reading
`RoomReady` as a room-lifecycle event instead. What the contract implies in practice:

```
LudeoSelected -> GetLudeo -> validate -> commit -> reach active gameplay
  -> freeze -> apply -> settle -> freeze -> OpenRoom(ludeoId) -> AddPlayer
  -> WAIT, FROZEN — unbounded: the viewer is reading the pre-play screen
  -> viewer clicks Play  ==>  RoomReady  -> Begin -> unfreeze
```

## Consequences that are easy to get wrong

- **`RoomReady` can arrive minutes after `AddPlayer`.** A timeout armed on "room opened → `RoomReady`" false-fires
  and tears down a perfectly good moment. Bound only the `OpenRoom` + `AddPlayer` leg — cancel that timer in
  `OnPlayerAdded` — and leave the wait for the click unbounded. (Every *other* restore wait stays bounded.)
- **There is no other notification for the click.** No `PlayerReady` exists in this SDK, and `ResumeGameRequest` is
  the mid-play overlay resume (CR-011). Anything that must happen "when the viewer presses Play" belongs in the
  `RoomReady` → `TryBeginGameplaySession()` path.
- **Everything must already be in place when the click lands** — level built, moment applied, world frozen. The
  click is a starting gun, not a preparation trigger. Nothing is loaded or written after Play.
- **`Begin` before the first moving frame.** Recording must be live before the world moves; unfreeze only after
  `Begin` has been issued (`05 §6.6`).

## Overlay behaviour worth knowing when the screen appears at the wrong time

Observed from the overlay's own logs: the pre-play screen's **content** (goals, time limit) is bound to a platform
"gameplay ready" event that carries the room id, so it cannot exist before `OpenRoom` + `AddPlayer`; clicks before it
are dropped with a "no roomId yet" message. The screen's **visibility** was observed bound to `LudeoSelected` itself,
before the game's own handler ran — at the time, an overlay-side defect against the intended room-and-player trigger,
and nothing the game can influence. If the viewer sees the pre-play screen over a loading level, check which half you
are looking at before changing the game's order.

Related: `learnings/common-mistakes/roomready-is-the-press-play-signal-so-applying-there-hides-the-moment.md` (what must
already be on screen when the click lands), `learnings/architecture/roomready-is-a-platform-signal-never-force-begin.md`
(diagnosing a missing `RoomReady`).
