---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5,7"
question: "Report that the replay starts 'slightly behind' where the moment shows? Before touching the capture code, DATE the served snapshot against the level's authored start values — and check the capture was registering at all."
sanitized: true
origin: "unity:common-mistakes/date-the-served-snapshot-before-blaming-the-capture"
---

# "The restore starts a few steps back" — date the snapshot before debugging the writer

**Precondition:** the restored moment is close to, but behind, what the highlight shows.

Reported: on every replay the player is a few steps behind where the moment shows — most visible near the level
start, where "behind" means off the left edge of the screen. The obvious reading, a one-frame lag in the position
write, is wrong, and chasing it wastes the session.

**Date the snapshot instead.** Three restored attributes from one restore log line answered it:

| Attribute | Restored | Means |
|---|---|---|
| level elapsed time | `0.0s` | the run's first second |
| coin counter | `0` | nothing collected yet |
| player position | `(135.67, 7.77)` | the authored spawn `(135.8, 11)`, after landing |

Not a lag: the served state was the **opening state of the capture run**. A moment captured seconds in looks "a few
steps back"; one captured a minute in would be unrecognisable. The same signature explained an older report that a
restored health value "always starts at maximum".

## Check, in this order

1. **Did the layer register at all?** One run had no capture-registered line and no capture heartbeat — nothing was
   tracked, so freshness was moot. A room that opens while an intro cutscene is on top can leave the level before it
   ever becomes playable.
2. **How fresh can the backend's copy be?** Whatever the backend holds when a highlight is marked is at most one
   writer flush old. Check the SDK headers for a send-interval setting on the data writer (none is listed in
   `12-SDK-API-REFERENCE.md`); if your version has one, set it explicitly at room open and log its `LudeoResult`.

## Dead ends, recorded so the next integration skips them

- The SDK logs that no callback is registered for a snapshot request at activation. It reads like the missing hook,
  but no such notification exists in the documented C API — don't chase it.
- A capture heartbeat is worth its cost **only if it logs values you can match against the restore**. Ours logged
  health and counters but not position, so the position claim couldn't be dated from the capture side. Log position,
  and prefer a timestamp the restore can echo back.

## Keep the log

If the game (or your launch script) truncates its log on every launch, the comparison log from the run before a crash
is lost. Copy it aside before relaunching, or launch with a timestamped log path.
