---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Did an earlier wave put a state on the transient/normalize list *because nothing in the restore could advance the entity out of it* — and does the wave you are implementing now restore the thing that advances it?"
sanitized: true
origin: "unity:common-mistakes/a-transient-state-classification-expires-when-a-later-wave-restores-its-driver"
---

# A transient-state classification expires when a later wave restores its driver

**Precondition:** the restore plan normalizes some states to idle (`07 §1.2`), and waves keep widening what the
restore drives.

`07 §1.2` is sound: normalize transient action phases, because the code that ends them never runs in a restore. But the
classification is not permanent — and the entry most likely to go stale is the one justified not by "this state is
transient" but by "**nothing in our restore can get the entity out of it**."

## The shape

A wave-based arena controller pre-creates its whole roster at level load and parks every member in a **holding
state** — on a spawn perch, movement off, hit-reception disabled — then releases members one at a time, tracked by a
`spawnIndex` cursor. Wave 1 suppressed that controller outright (`07 §11.1`), so nothing could release a parked
member; wave 1 therefore added the holding state to the transient list, with an honest comment saying exactly that.

Wave 2 restored the encounter properly: the controller's cursor, roster membership with kill callbacks re-attached,
and a narrowed activation guard. **Every premise of the wave-1 entry was now false — and the entry was still there.**
A capture at `spawnIndex = 0` restored with every parked member normalized to its initial state, which for that
family is active pursuit. Integrator report: *"there were more enemies than there should be."*

## Why it is hard to attribute

Frame 1 is perfect — members come back on their perches, positions/HP/references all correct, the object **count**
right; they leave the perches only after Play. And the restore's own log printed `normalized: Enemy:Holding->Initial`
among a dozen legitimate normalizations, reading as success.

## The audit

| Why the entry exists | Expires? |
|---|---|
| ended by a timer / animation event the restore never runs | **no** — keep it |
| advanced by a *manager* whose progression this wave doesn't restore | **yes** — re-check every later wave |
| advanced by a trigger this wave suppresses | **yes** — re-check when the suppression narrows |

When a wave restores a manager's cursor, re-attaches a roster, or narrows a suppression guard, **diff the transient
list against it in the same wave** — and write the reason next to every entry when you add it.

## The fix

Decide *before* the transient resolver runs. Re-establish the holding state through the game's own public entry point
(it does several things a re-implementation misses), passing values that **preserve the restored pose**. Keep
normalization as a fallback guarded by a fact — "does the restored manager actually hold this entity in its release
collection?" — and log loudly when it falls back. If the entity's own first-update hook re-enters its initial state,
re-apply in `ApplyDeferred()`. A dead entity is never re-parked.

**Diagnostic:** a temporary restore-only heartbeat after Play printing redundant state against ground truth —
`spawnIndex=0 · rosterLive=3 · holding=3 expected=3`. `holding` below `expected` is this defect. Related:
`learnings/common-mistakes/a-flag-cleared-only-from-a-data-asset-looks-like-dead-code-to-a-source-grep.md`.
