---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game's level-change path early-return when the requested level is already the active one? Then a Ludeo selected while the player stands in its own level (\"play again\") makes the restore's load step silently do nothing."
sanitized: true
origin: "unity:common-mistakes/replaying-from-inside-the-same-level-needs-a-hop-out"
---

# Replay-again from inside the same level: the level won't reload in place — hop out first

Applies when the game's level-change helper refuses to load the level that is already active.

The Player Flow worked; then the player finished the Ludeo and pressed play again from the summary screen. The
second restore's "reach active gameplay on the captured level" step (`07 §2.1` step 4) targeted the level the player
was already standing in — and the game's level-change helper early-returns when the requested level is already
active. No load, no error, no log: the restore stalled waiting for a level-ready signal that never came ("clicking
play again breaks the game").

This is not an exotic path. Replaying the Ludeo you just played is the single most likely second interaction of the
whole feature, and it is a `07 §2.6` replay-to-replay re-entry.

**The fix that matches the flow:** when the restore sees the target level already active, **leave for the
hub / menu first** through the game's own back-to-hub transition (the pause-menu or run-end path — battle-tested, it
resets what the game wants reset), then let the normal reach-active-gameplay sequence run again. The wait step simply
doesn't advance during the hop: the transition makes the level-ready check false until the hub is up, and the next
pass enters the level fresh. Keep the hop inside the restore's bounded wait so a stalled transition still times out
loudly.

**Don't force an in-place reload of the active level.** The early-return exists because the game's transition
machinery (player carry-over, network level messages, loading screen) assumes a level **change**; reloading in place
walks around all of it into untested territory.

It composes with the teardown the restore already requires: the commit's `EndCurrentLudeo` (`07 §2.1` step 3) tears
the finished Ludeo down completely first → `SetRestoring(true)` → reach active gameplay sees same-level → hub →
level → freeze → apply. Make sure the `IsRestoring()` start-of-run skips (`07 §9.11`) also cover the hub's own
start-of-run logic, and that an ignored selection never triggers the hop (it is still pre-commit).

Test it explicitly: play a Ludeo to its end, then select the same Ludeo again, and a different Ludeo recorded in the
same level.
