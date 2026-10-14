---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Does the game decide whether to play an intro/cinematic by checking a skip flag during level load?"
sanitized: true
origin: "unreal:common-mistakes/intro-skip-timing-must-beat-game-check"
---

# An intro skip must be set before the game's intro system reads it

**Precondition:** the game reads a skip flag during level load.

The skip was set in the integration's per-entity init hook. By then, the game's intro check had already run three
times in that frame and read "not skipped".

Set it at the commit instead (`07 §2.1` step 3), where `SetRestoring(true)` runs **before** the level load. Gate
the intro check on `IsRestoring()` (`07 §9.11`), or write the game's own flag at that same point. Then verify with
a log at the game's check.
