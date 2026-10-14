---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "5"
question: "Is a restored value (health, armor, stamina, …) owned by an attribute/stat system with change handlers, instead of being a plain field with a setter?"
sanitized: true
origin: "unreal:common-mistakes/health-restoration-requires-gas-awareness, unreal:common-mistakes/gas-ensure-on-same-value-set, unreal:common-mistakes/player-flow-health-needs-instigator"
---

# Restoring values owned by an attribute system

**Precondition:** the value lives in an attribute/stat system (a component that owns base values, applies
modifiers and broadcasts change events), not in a field you can just assign.

A restore write into such a system is a synthetic gameplay event, and the system makes assumptions a restore
breaks. Integrations hit four failure shapes.

1. **No direct setter, so the restore was stubbed.** The health component exposes `GetHealth()` but no setter. The
   restore logged "health restoration deferred" and did nothing, so health never restored. Write the **base value
   through the attribute system** (its set-base-value path, or an instant "set to X" modifier). Never ship a log
   line in place of a write.
2. **The system isn't ready at apply time.** The attribute component initializes after the entity spawns, so the
   apply finds nothing to write into. Queue the value and write it in `ApplyDeferred()` on the settle's first tick
   (`07 §6`). If it is still not ready, extend the settle with a bounded wait on the system's ready signal.
3. **Same-value writes assert.** One game's change handler asserted `old != new` (a guard against "expensive
   no-op" broadcasts). The system broadcast even when the restored value equalled the spawn value (armor 0 → 0),
   so the assert fired. Compare first:
   ```cpp
   if (!NearlyEqual(attrs.GetBase(Attr::Armor), target)) attrs.SetBase(Attr::Armor, target);
   ```
4. **Handlers assume a cause.** Another game's health-changed handler dereferenced the damage *instigator*
   (team-attitude check, AI damage-sense report) without a null check. Normal damage always has an attacker; a
   restore write has none, so it crashed. If the modification struct has an instigator/source field, set it to the
   entity itself. Also read the handlers for other "there is always an attacker" assumptions.

**How to apply:** for each attribute you restore, find the owning system's write path, its ready signal and every
change handler, and decide the shape of the write before coding it. Then verify the value with a read-back of the
live attribute (`11 §10`).
