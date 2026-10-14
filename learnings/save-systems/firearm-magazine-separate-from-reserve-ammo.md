---
category: save-systems
tier: generalizable
sourceGame: EndlessFPS
phase: "5"
question: "Does the game keep a firearm's loaded magazine as separate state from the reserve ammo held in the inventory?"
sanitized: true
origin: "unreal:save-systems/firearm-magazine-separate-from-reserve-ammo"
---

# A firearm's loaded magazine is separate state from the inventory's reserve ammo

**Precondition:** the weapon system splits ammo into a reserve count (an inventory item's quantity) and the rounds
loaded in the weapon.

## The misconception

After restoring the inventory — including the ammo item's reserve quantity — and re-equipping the gun, the weapon
was **empty**: the player had to reload before the first shot. "The weapon is restored but not loaded."

## Why

Most shooter weapon systems hold two pieces of state:

- **Reserve ammo** — a count on an inventory ammo item (what the capture recorded as the item's quantity).
- **Loaded magazine** — held by the weapon instance, often exposed only through a getter with no setter. A freshly
  created or freshly equipped weapon starts with an **empty** magazine.

Restoring the inventory restores the reserve, not the magazine.

## Fix

Capture the loaded count per weapon (`loaded_ammo`), alongside the reserve. On restore, after the inventory is
rebuilt and the weapon equipped:

- if the weapon exposes a setter, write the loaded count directly;
- otherwise drive the weapon's **synchronous reload-from-reserve** function — the no-animation, returns-success
  variant the game uses internally — and top the reserve up first by the loaded count, so the totals match the
  capture. Shell-by-shell weapons (shotguns) load one round per call: loop until it reports full or the reserve
  is empty, with an iteration cap.

```cpp
// Pass 2 / ApplyDeferred(), after inventory + equip
inventory.AddReserve(ammoType, captured.loadedAmmo);         // so the reload doesn't eat captured reserve
for (int i = 0; i < 64 && weapon.ReloadFromReserve(); ++i)   // returns false when full or reserve empty
    if (!weapon.LoadsOneRoundPerCall()) break;
```

Avoid the **animated** player-reload path: it's timer/animation-driven, won't progress while the restore holds the
game frozen, and finishes a beat into gameplay — or after Play — instead of on the first frame.

## How to apply

For any game with magazine-fed weapons, census the loaded count as its own field in `phase 4` and verify on the
first replay: the HUD's magazine counter matches the captured moment, and the first trigger pull fires.
