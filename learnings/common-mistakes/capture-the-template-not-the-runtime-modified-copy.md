---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "4,5"
question: "Does the game build per-instance runtime copies of asset/template data (stat modifiers on weapons, per-player loadout configs, customized cosmetics), so live pointers reference the modified copy rather than the template?"
sanitized: true
origin: "unreal:common-mistakes/capture-original-not-modified-data-when-engine-creates-per-instance-copies"
---

# When the game makes per-instance modified copies of template data, capture the template's identity

**Applies when** the loadout, equipment or character system derives **per-instance runtime copies** from data
templates: skill-modified weapon stats, per-player weapon configs, customized cosmetics. The live structures point
at the **modified copy**, not the template.

## The trap

Capture reads the live pointer and records its identifier. For a runtime copy, that identifier is scoped to one
runtime instance: a generated name, a pool index, an address-derived key, a path under the owning player's
object. **It doesn't resolve on replay.** The new player instance has no copy with that identifier.

## Incident

Weapons silently failed to equip on replay, while cosmetics, armor, transform, health and ammo all restored. The
loadout structs carried paired fields: the **active** (runtime-modified) data and the **original** (template)
data. The game's own accessor returned `original ? original : active`. Capture had recorded the active field. In
the exported capture, the weapon entries had instance-scoped identifiers while the cosmetic entries had clean
template ids. Cosmetics worked only because the game never modified them at runtime.

```cpp
// WRONG: identifier of the per-instance modified copy
const WeaponData* d = cfg.activeData;
// RIGHT: the template (mirror the game's own "original or active" accessor)
const WeaponData* d = cfg.originalData ? cfg.originalData : cfg.activeData;
writer.SetString("weapon_0_data", AssetIdOf(d).c_str());
```

**On restore:** assign the resolved template to the active field and let the game's own loadout-changed path
rebuild the per-instance modifications. Don't try to recreate the copy yourself.

## How to apply

1. In phase 4, survey loadout/equipment structs for paired fields (`x` / `originalX`, a transient copy beside a
   template reference) and for a "create/apply modifications" step on the loadout or player. Either is a strong
   signal.
2. Always capture via `original ? original : active`.
3. **Diagnose from the capture:** if equipped items fail to restore but simple state does, inspect the exported
   capture data. An instance-scoped identifier where a template id belongs is the tell.
