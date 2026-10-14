---
category: save-systems
tier: generalizable
sourceGame: multiple
phase: "5"
question: "Does the player's inventory get built through the game's own add-item/equip functions — a fresh spawn holds only a default loadout (or nothing), and items enter through an add path that creates or spawns the item, assigns a slot and fires the HUD/equip events?"
sanitized: true
origin: "unreal:save-systems/weapon-restore-via-manual-classpath-writes, unreal:save-systems/reconstruct-inventory-via-game-additem"
---

# Rebuild an inventory as type ids, replayed through the game's own add/equip functions

**Precondition:** the restore's fresh spawn gives the player only a default loadout (say, a melee weapon); guns,
ammo and consumables are picked up during play, and items enter the inventory through an add-item function that
creates (or spawns) the item, assigns a slot, registers it and fires the events the HUD and equip logic listen to.
Common shapes: an item list with quantities, or a list of references to live item entities (each weapon its own
spawned object).

## The traps

- **Setting quantities on items that aren't there.** Capturing each item's type + quantity and, on restore,
  writing the quantity onto "the matching existing item" **silently no-ops** — the items don't exist yet. The HUD
  shows the default loadout; the captured weapons and ammo never appear. A write can only change state that exists;
  it can't create inventory entries or fire the add-item cascade.
- **Writing the references.** A pointer is not a stable identity (`06 §4`, `11 §6.5`).
- **Tracking every item as its own Ludeo object** — registering every item class, following its spawn lifecycle,
  resolving owner references in Pass 2 — is a lot of work when the moment only needs "holds the shotgun and the
  rifle, rifle equipped".
- **Hand-building items** and pushing them into the container skips owner, id, slot, registration and events, and
  leaves the inventory half-wired.

## The pattern

**Capture** (Creator Flow, on the player's tracked object) the whole inventory, not just quantity-bearing items:
each entry's **type key** (whatever the game's own factory spawns from — a class name, an item-table id, a template
path; stable across runs), plus its quantity and slot where they matter, and which entry is equipped.

```cpp
ludeo_DataWriter_SetInt32("item_count", (int32_t)inv.size());
for (size_t i = 0; i < inv.size(); ++i) {                        // "item_0_type", "item_0_qty", ...
    ludeo_DataWriter_SetString(TypeAttr(i), inv[i]->TypeId());    // the item's type key, not a pointer
    ludeo_DataWriter_SetInt32(QtyAttr(i), inv[i]->Quantity());
}
ludeo_DataWriter_SetInt32("equipped_index", IndexOf(inv, player.Equipped()));
```

**Restore** (Pass 2, or `ApplyDeferred()` if the add/equip handlers need live subsystems — `07 §6`), after the
player exists:

1. **Clean before re-add.** The game's spawn added its default loadout before the apply ran, and those items aren't
   all in the capture. Remove them through the game's **own remove-item** function — emptying the backing array by
   hand desyncs the HUD and equip state (the reset-to-baseline step of `07 §5.4`). Otherwise the restored items
   stack on top of the loadout.
2. **Re-add each captured item through the game's add-item function** (spawning it through the game's own factory
   first if items are entities), at its captured slot, then set its captured quantity on the instance the function
   returns.
3. **Re-equip** through the game's equip function, after all items exist; then restore weapon state such as the
   loaded magazine (`learnings/save-systems/firearm-magazine-separate-from-reserve-ammo.md`).

```cpp
inventory.RemoveAll([](Item&) { return true; });                     // game's own removal, per item
for (const CapturedItem& c : captured.items)
    if (Item* it = inventory.AddItem(ItemTypes::Find(c.typeId), c.slot))   // game's own add path
        it->SetQuantity(c.quantity);
inventory.Equip(inventory.FindBySlot(captured.equippedSlot));
```

Audit the add path's side effects (pickup sounds, "new item" toasts, pickup actions, counters) and suppress the ones
the snapshot already accounts for while `IsRestoring()` (`07 §11.2`).

## Trade-offs to state in `RESTORATION_PLAN.md`

- Only what you capture per slot comes back. Per-item state (ammo in the magazine, durability) restores at defaults
  unless you add per-slot attributes for it — decide which of those a playable moment needs.
- Per-slot attribute names are fine, but keep each name's type fixed: an attribute's type locks on first write
  (`11 §1`).
- Before assuming the inventory restores by setting values, check what a fresh spawn actually contains. If it is
  only a loadout, plan the inventory as a rebuild.
- Verify by restoring a moment with a non-default loadout and a non-first equipped item; the post-settle check
  (`11 §10`) should read the live inventory, not the values you wrote.
