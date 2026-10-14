---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "5,7"
question: "Does the game run its own post-spawn initialization — equip the loadout, attach cosmetics, set a default stance — whose timing differs between development and shipping builds, and does the restore wait on it by a wall-clock delay rather than by the game's own completion signal?"
sanitized: true
origin: "unreal:architecture/restore-must-precede-natural-equip-flow"
---

# A wall-clock deferral before the restore passes in a dev build and loses the init race in shipping

**Precondition:** the game equips the loadout, attaches cosmetics or applies default stances on its own after the
player spawns, and the restore's timing relative to that pipeline is set by a delay ("wait N seconds for the level to
settle") instead of by the game's signals.

## What happened

A "5 s after gameplay starts" deferral was added before the apply, to fix a *different* problem (level-script NPC
spawns and briefing voice-over on an unsettled world). In development builds the loadout assets were already cached,
so the game's own equip ran instantly and the late restore then overwrote it — the replay looked right. In a shipping
build the loadout streamed in, the game's later post-loadout init treated the restored values as a fresh start and
installed its defaults again, and restore writes that depended on preconditions inside the equip path silently no-oped.
Result: the captured primary weapon showed as the secondary, and a cosmetic attached to the wrong body view. It went
unnoticed for two days because shipping builds weren't tested on every change; bisecting ruled out three other
suspects before landing on the deferral.

## The rule

1. **Never time the restore by the clock.** Reaching active gameplay (`07 §2.1` step 4) ends on the game's own
   completion signals — loadout loaded, equip done, native spawn finished
   (`learnings/architecture/active-gameplay-gate-must-wait-for-async-loads.md`) — then freeze → apply. The game's defaults are
   installed by then, and the apply overwrites them; anything an initializer would clobber again goes through
   `ApplyDeferred()` (`07 §6`).
2. **Prefer the game's own setters** (`SetEquippedSlot(n)`) over raw field writes plus synthetic change handlers: the
   setter knows the pipeline's preconditions.
3. **Don't fix the original problem with time either.** Stray level-script spawns and voice-over are start-of-run
   mechanisms: gate their triggers on `IsRestoring()` (`07 §9.11`, `07 §11.1`) rather than delaying the restore or
   sweeping entities after Play — nothing is written after Play (CR-010).
4. **Test a packaged/shipping build early** in every stage that touches restore timing or player visual state.
   Development-build timing is not representative.
