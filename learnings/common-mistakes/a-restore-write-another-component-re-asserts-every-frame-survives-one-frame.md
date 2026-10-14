---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5"
question: "Did the restore write an entity's active/enabled state or a mode flag — and does any OTHER system re-assert that same value from its own per-frame update every frame?"
sanitized: true
origin: "unity:common-mistakes/a-restore-write-another-component-re-asserts-every-frame-survives-one-frame"
---

# A restore write that another system re-asserts every frame survives less than one frame

**Precondition:** some other system writes the same field unconditionally from its per-frame update.

The apply is synchronous and frozen, so nothing interferes *inside* it — which is why this failure confuses. The
write lands, the apply's own read-back confirms it, the end-of-apply log confirms it — and the next frame puts it back.

Observed: the restore deactivated a cutscene driver so it could not re-fire a moment the creator had already seen. A
different manager's late update re-activated it every frame, unguarded (`m_logCamera->SetActive(m_enableTooltips);`),
and the update after that fired the cutscene. Under the core order that first frame is the **settle**, so the moment
behind the overlay was already wrong before Play.

## Why the diagnostics agree with you until they don't

Every log the apply produces runs inside the apply, before any update. So the write-back says correct, the
end-of-apply diagnostic says correct, and the symptom happens anyway. **If an end-of-apply check and an end-of-settle
check disagree about the same field, stop looking for who failed to write it and look for who re-writes it.** That
disagreement is the signature.

## The missed precondition: "inert" was decided from the wrong branch

The re-asserting system had been analysed and **cleared** as inert in this level, because the branch the plan row
named was dead there. The unguarded line that mattered sat *below* that branch in the same function. Clearing a
system is a claim about every branch of every function it runs, not the one your row names — read the whole function.

## Fixes, cheapest first

1. **Disable the re-asserting system's update** for the replay (its enable flag, not its owner entity) — it stops the
   loop without discarding its other work, and the next level load resets it.
2. **Reach a terminal state the re-assertion can't undo** — many drivers have an early-return branch (a null/sentinel
   input) that stands them down before the branch that fires.
3. Editing the re-asserting system is usually off the approved edit surface.

Gate the fix on the same restored value that motivated the write, so a creator who had *not* seen the moment still
gets it. **Grep for the field you wrote: if any other file writes it from a per-frame update with no state guard, your
restore write is temporary.** Common hosts: UI panels mirrored by a manager, AI toggles driven by a settings
singleton, input maps re-applied by a watcher, the time scale itself.
