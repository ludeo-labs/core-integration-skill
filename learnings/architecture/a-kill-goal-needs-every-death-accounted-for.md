---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "6,8"
question: "Can anything other than the player kill enemies — environment hazards, allies released by destructibles, kill planes, damage ticks — while the game's kill event fires only on player-attributed deaths?"
sanitized: true
origin: "unity:architecture/replay-goal-needs-every-death-credited"
---

# A kill goal needs every death accounted for, not just the player's

**Precondition:** the game's kill hook — the one `6b` wires `SendAction("Kill")` into — sits on an attribution path
that fires only when the damage source resolves to a player, and something else can also kill enemies.

## What happened

A Ludeo's kill goal is set against the creator's recorded kill actions, and the replay's enemy population is finite.
Every enemy the **environment** finishes during playback is a kill the player can never earn back — the goal
becomes arithmetically unreachable while every game system stays green (rooms clear, waves advance, nothing
errors). In one game a destructible released an allied creature that killed enemies; a destruction-heavy replay ran
17 kills short with no fault anywhere. Falls into the kill plane behaved the same: silently deleted, credited to
nobody.

## The fix pattern

- Hook the game's **single death choke point** — the state-machine entry that fires exactly once per death whatever
  the cause — and forward every death to the `LudeoManager`.
- **Judge one frame later.** The attribution path runs in the same frame as the death and the order between the two
  is not guaranteed; a death still uncredited on the next frame is a fact.
- **Exactly once.** Player-attributed kills mark a per-life credited set (route the existing kill hook through the
  manager so it marks before sending); the unattributed sweep skips marked ids; clear an id when its pooled
  instance despawns, and clear the whole set when a gameplay session begins.
- **Decide the action's meaning, then keep it identical in both flows.** Actions fire in Creator and Player Flow
  alike and are never gated on "is this a replay" (`06 §7`, `07 §2.3`). Either report unattributed deaths as their
  own action (e.g. `EnemyDied` beside `Kill`) so goals can be set on whichever the studio means, or count them as
  `Kill` in both flows. Ask the integrator which a goal should mean.

*(The source integration credited unattributed deaths during playback only, so the creator's count kept meaning
"kills the creator personally made". That breaks the both-flows rule above; the separate-action shape keeps the
creator's meaning without it.)*

## Verify

Replay a Ludeo where hazards or allies did some of the killing and compare the run's kill-type action count against
the recording's. A goal that cannot be completed by a player who kills everything still alive is this bug.
