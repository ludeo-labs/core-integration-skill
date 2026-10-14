---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Is the capture register hook placed in a BASE entity class's init / first-update override so one site covers every subclass — and has every subclass override been verified to call the base implementation?"
sanitized: true
origin: "unity:common-mistakes/one-base-class-register-hook-misses-subclasses-that-skip-base-start"
---

# A register hook on a base class doesn't cover the subclasses that skip the base call

Applies when the register hook (`06 §3.2`) lives in a base entity class's virtual init that subclasses override.

The most attractive phase-4 census finding is a **single register hook serving every instance of a large family**:
a base `EntityController::OnStart()` that ~35 subclasses inherit, so one call covers level-placed instances, every
spawner and boss adds alike. The census records it as a strength.

**Verify the inheritance holds before trusting it.** A virtual override is not chained automatically — a subclass
whose `OnStart() override` omits `EntityController::OnStart()` silently replaces the base body. Games accumulate
these: a family with a different init order, a variant that re-implements the base body inline with one line
changed, a decorative subclass that only deactivates itself. Grep every override of the hooked method and read each
for the base call. In the observed project 4 of ~35 subclasses skipped it — ~11% of the family, invisible from the
base class.

## Two failure classes — only one is closable in the Ludeo layer

1. **Skips the base hook but still joins the game's own live list** (`AddEntity(this)`) — recoverable without
   touching it: a **throttled, add-only sweep** of the game's live list in `LudeoManager` picks it up within a
   fraction of a second. Cheaper and more removable than editing N game files.
2. **Skips the base hook AND never joins the live list** — invisible to both paths. Only a per-family hook or a
   level-data scan reaches it. Enumerate these explicitly, check them against the current wave's scope, and report
   later-wave ones now rather than discovering them at a restore gate. (The per-family hook has its own trap:
   `learnings/common-mistakes/the-per-class-register-hook-fires-before-capture-goes-live.md`.)

## The sweep must be ADD-ONLY

The live list a kill path **removes the entity from while its corpse persists** (`06 §3.4`–`§3.5`) is the list you
are sweeping. A sweep that treats "id vanished from the list" as a removal will `ludeo_DataWriter_DestroyObject`
every corpse and drop it from the replay. Removal stays bound to the real destroy signal; the sweep only **adds**.

This is not a blind per-tick scan of the world (`06 §2.8`), and it doesn't replace the precise hook — the hook
registers on the exact spawn frame (no missed first sample); the sweep is a bounded backstop for subclasses the hook
structurally can't reach. Keep both.

Related: `learnings/architecture/level-reset-registry-is-census-batch-iterator-and-reset-seam.md` — the game's own
registry as your enumerator, with the same caveat that registry membership isn't liveness.
