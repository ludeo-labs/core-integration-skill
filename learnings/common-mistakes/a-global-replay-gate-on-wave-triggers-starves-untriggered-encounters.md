---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game populate rooms/encounters through a start trigger (first wave, proximity, door crossing) that must still fire for fights the player reaches during a replay's forward play?"
sanitized: true
origin: "unity:common-mistakes/a-global-replay-gate-on-wave-triggers-starves-untriggered-encounters"
---

# A global replay gate on wave triggers starves untriggered encounters

**Precondition:** encounters populate through a start trigger, and you are gating it to stop a fresh first wave
spawning on top of restored enemies.

The integration gated the encounter-start path on "a Ludeo is playing" — globally. That gate is right for exactly one
case (an encounter restored mid-fight) and wrong for every other:

1. **An encounter not yet triggered at the capture point** (the snapshot can predate the fight) sits empty; only later
   waves arrive, on a timer, undersized.
2. **Every room the player enters during the replay's forward play** never spawns at all — the moment plays out over
   a level gone inert.

Both showed in one replay: the first room spawned late and thin, the second spawned nothing. This is the
play-forward hazard `07 §11.1` codifies; the lesson is how it presents and how to verify the fix.

## The correct shape

- **Capture each encounter's own started flag**, not just its wave cursor. At the capture point that flag is the
  difference between "fight in progress — restore it" and "not triggered — leave it alone".
- **Restore only started encounters.** Restoring the started flag makes the game's *own* "already started" guard
  block its first-wave path — no Ludeo condition in game code.
- **Delete the global gate.** Untouched encounters — not started at capture, and every room reached later — start
  through the game's normal trigger, exactly as in the recording.
- **Restore the recorded flag, never synthesize it.** A restore-side one-liner here had been marking every captured
  encounter started unconditionally — a value the recording never held.

**Verify the untouched case too:** for an encounter deliberately left alone, check at the end of the settle that it
is still *untriggered*. Leaving something alone is also a decision the game can silently override.
