---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5"
question: "Did you add an early-return restore branch to the game's level-entry (or run-start) dispatcher? List every branch BELOW yours — you have bypassed all of them, including any that initialise the level's antagonist."
sanitized: true
origin: "unity:common-mistakes/your-replay-branch-bypasses-the-rest-of-the-entry-switch"
---

# An early-return restore branch silently skips every later case in the entry switch

Applies when the restore skips the game's level-entry presentation with an early branch. The restored level must start
without the intro walk-in, so a branch goes near the top of the game's level-entry method — the usual start-of-run
skip gated on `IsRestoring()` (`07 §9.11`):

```cpp
void LevelDirector::OnLevelEntered()
{
    if (MustPlayIntro()) return;

    if (LudeoManager::Instance().IsRestoring()) { RepeatedLevelStart(); return; }   // restore takes the quiet path

    if (IsBossLevel())     { /* ... */ BossStart(boss); return; }                   // never reached on a restore
    if (AlreadyVisited())  { RepeatedLevelStart(); return; }
    NewLevelStart();
}
```

The branch is right about what it wanted — no walk-in, no cutscene, no repositioning the player off the restored
transform. It is silently wrong about everything the *later* branches do.

In this game `BossStart` was the **only** caller of `Boss::Init()`. On a restore of a boss level the boss never
initialised, reported as "the boss does not move and does not attack":

- its fight state (phase counter, velocity, unfrozen flag, life count) was never set and none of its attack routines
  started — the log had **zero** lines from the boss;
- `Init()` was also what deactivated the boss's authored stand-in doubles. Left active, their animation events called
  into the boss every loop and dereferenced a null pointer that only a player hit ever assigns — 52 errors in one
  replay.

## The check

After adding a restore branch to any dispatcher, **read every branch below it and ask what the restore now loses**.
The ones that bite are per-level-type cases — boss, tutorial, timed levels — each initialising something the generic
path does not. Record them in `RESTORATION_PLAN.md`.

## Take only the initialisation, not the whole case

Don't call the game's boss-start wholesale: here it also teleported every player to the level's authored spawn, which
would stomp the restored position (`07 §11.3` — keep the presentation, skip the reposition). Call the initialiser
alone:

```cpp
if (LudeoManager::Instance().IsRestoring())
{
    RepeatedLevelStart();
    if (IsBossLevel()) if (Boss* boss = World::FindFirst<Boss>()) boss->Init();
    return;
}
```

**Ordering makes this safe:** the initialiser resets position and life count to authored values, but level entry runs
while the restore reaches active gameplay, and the apply comes *after* it (CR-010, `07 §2.1`), so the captured values
win. Verify that with the restore's own log line rather than assuming it — see
`learnings/architecture/make-the-restore-verify-every-value-it-writes.md`.
