---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "3,5"
question: null
sanitized: true
origin: "unity:architecture/stamp-your-trace-with-the-sdks-own-clock-format"
---

# Stamp every integration log line with the SDK's own clock format

The Ludeo SDK's native log lines carry a **UTC clock** in a fixed shape — `HH:MM:SS:mmm` followed by the subsystem:

```
15:49:47:766:VideoEncoding:Log ...
15:35:52:901:Http:Error ...
```

If the integration's `LUDEO_LOG` lines carry no timestamp (or a local-time one in another format), the two halves of
the story cannot be put on one timeline: `[Ludeo] Reported 'BossKill'.` happened "somewhere after the line above it".

Build the clock into the integration's log helper on day one, in the **SDK's exact format**, and send every level
through it:

```cpp
inline std::string LudeoStamp() {                       // UTC, HH:MM:SS:mmm — matches the SDK's lines
    using namespace std::chrono;
    const auto now = system_clock::now();
    const auto ms  = duration_cast<milliseconds>(now.time_since_epoch()) % 1000;
    const std::time_t t = system_clock::to_time_t(now);
    std::tm utc{}; gmtime_s(&utc, &t);                  // gmtime_r on POSIX
    char buf[16]; std::snprintf(buf, sizeof buf, "%02d:%02d:%02d:%03d",
                                utc.tm_hour, utc.tm_min, utc.tm_sec, (int)ms.count());
    return buf;
}
// LUDEO_LOG / LUDEO_WARN / LUDEO_ERROR all prefix "[Ludeo] " + LudeoStamp()
```

**UTC, not local** — a trace that mixes the two is worse than one with no clock, because it looks comparable and is
not.

## Why before you need it

You will not feel the absence until someone asks a timing question, and by then the log that would have answered it
is written. In one engagement the gap blocked two investigations in a single day: when a recorder froze, and whether a
restored value landed before or after a game system overwrote it. Dating an unstamped line by its position between
two SDK lines works, slowly — and its resolution collapses exactly where needed: a burst of a hundred integration
lines between two SDK lines all resolve to one instant, losing the ordering you were asking about.

## Route every level through it

One warning printed directly in a restore checkpoint produces an unstamped line in the middle of a clean trace — and
warnings are the lines you come back to. Give the helper warn and error levels from the start, keep one `[Ludeo]`
prefix on every line so one grep separates the integration from the SDK and the game, and make sure the SDK's lines
and yours land in the same file (or can be merged by timestamp).

## Snapshot the log while it exists

If the game's log is overwritten on each launch, the log covering an interesting session exists in one place until
someone copies it. Copy it out before anything relaunches the game — including asking the integrator to try again.
