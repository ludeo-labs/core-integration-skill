---
category: architecture
tier: generalizable
sourceGame: multiple
phase: "5,8"
question: "Does reaching active gameplay leave persistent visual state — decals, active particle emitters, HUD widgets, an intro screen, lingering post-processing — that the restore would otherwise layer the captured moment on top of?"
sanitized: true
origin: "unreal:architecture/reset-persistent-visuals-to-baseline-before-restore"
---

# Reset persistent visuals to a baseline before the apply

**Precondition:** the level load (or the previous run, on a matched instance) paints visuals the captured moment
didn't have. `07 §5.4` already requires resetting matched instances to a baseline; this lesson is the visual half.

## Problem

A fresh load stamps its own visuals — scorch or blood decals from a scripted intro, an ambient emitter, the default
HUD values, a full-screen intro widget — and the restore applies the captured state **on top**. Result: doubled
decals, an emitter that shouldn't exist in this moment, a HUD showing fresh-load numbers, an intro widget still up
over the restored gameplay. It is the visual twin of the duplicate-entities bug: apply-over-default instead of
reset-then-apply.

## Fix

At the top of the apply, clear residual visual state to a known baseline — scoped to the restore so normal play is
untouched:

```cpp
void LudeoStateAdapter::ResetVisualBaseline() {
    world.DestroyAll<Decal>();                  // decals the load stamped
    world.ForEach<AmbientEmitter>([](auto& e) { e.Deactivate(); });
    hud.ClearTransientWidgets();                // intro / fresh-load widgets
}
```

Then apply; anything the moment really had comes back through the normal restore path, through the game's setters so
its cosmetics fire (`learnings/architecture/apply-through-the-games-own-cascade-path.md`).

## Scope by load-bearing vs cosmetic

- **Load-bearing residue** — a widget that captures input, an effect that implies live state → clear it in the core
  restore (phase 5): leaving it changes behaviour.
- **Purely cosmetic residue** — a stray decal, a background emitter → may wait for phase 8 polish, but record it so it
  isn't forgotten.

## How to apply

List what the load leaves behind visually (decals, persistent emitters, widgets, post-process effects); per item,
decide reset-to-baseline or restore-explicitly. Clear before the apply; restore what the moment actually had after.
