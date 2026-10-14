---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Are you restoring a stat (health, resource, timer) by assigning through the same setter gameplay uses? Check that setter for interceptor hooks - damage gates, invulnerability windows, clamps, die-state guards. Any of them can silently drop your write, and your own checks will not notice if they read the same mirror they wrote."
sanitized: true
origin: "unity:common-mistakes/a-restore-write-can-be-silently-vetoed-by-gameplay-rules"
---

# A restore write can be silently vetoed by gameplay rules

**Precondition:** the stat system routes writes through validation hooks.

Stat systems commonly route writes through a check callback that can veto the change — installed by buffs like
spawn-protection invulnerability, die-state guards, clamping rules. Those rules are right for gameplay and wrong for
restoration, which is not gameplay: it is the authoritative re-statement of recorded fact.

Every wounded enemy restored at full health for a whole day of testing. The write executed, threw nothing, and did
nothing: the spawn-protection buff vetoes any health-*lowering* write while its condition holds, and at restore time
— right after the enemy was spawned — it still held. Seventeen enemies across two replays, all silently full.

## How it hides

- The veto is silent by design: a rejected write is the rules working, not an error.
- A verification that reads back the field it wrote (a mirror, a cached copy) compares the write to itself and stays
  green. Only a check that reads the **live** value the game plays with catches it
  (`learnings/architecture/make-the-restore-verify-every-value-it-writes.md`).

## The fix shape

Find the stat API's authoritative write — most systems have one precisely because rules must sometimes be bypassed
(`SetValueWithoutCheck`, `ForceSet`, a direct assignment) — and use it for every restored value. If none exists,
remove the interceptor around the write and reinstate it after.

**Corollary:** a deferred init can recompute a derived value *from* the stat you just wrote (`maxHealth =
health` on the next tick), turning the restored current value into the maximum. Re-assert restored stats once after
that init window has passed — the end of the settle is the natural point (CR-010 step 5), still before `OpenRoom`.
