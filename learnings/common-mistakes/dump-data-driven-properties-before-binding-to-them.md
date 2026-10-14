---
category: common-mistakes
tier: generalizable
sourceGame: VoyagerV2
phase: "4"
question: "Are entity properties defined in data or script (property bags, script tables, a reflection system) rather than as C++ members you can read in source?"
sanitized: true
origin: "unreal:common-mistakes/property-dump-before-reflection"
---

# Dump data-driven properties at runtime before binding capture to them

**Precondition:** the properties you capture are looked up by name at runtime.

Don't guess names. On the first registration of each tracked type, log every property on its gameplay components
(name, type, owner), then read the log. One game turned up these surprises:

- Health was a `double`, not a `float`.
- Energy was named `EnergyValue`.
- The weapon was `EquippedWeapon`, on the inventory component.
- The weapon component had `IsFiringPressed` and `IsAiming`, both useful for actions.
- An `IsAlive` bool was more reliable than `health > 0`.
