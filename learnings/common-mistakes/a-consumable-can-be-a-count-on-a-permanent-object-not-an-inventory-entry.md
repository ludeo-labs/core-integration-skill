---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "4"
question: "Does the game implement any pickup (potions, charges, consumables) as a count incremented on an object the player permanently owns, rather than as an inventory entry or a world object that transfers ownership?"
sanitized: true
origin: "unity:common-mistakes/a-consumable-can-be-a-count-on-a-permanent-object-not-an-inventory-entry"
---

# A consumable can be a count on a permanent object, not an inventory entry

**Precondition:** the game grants pickups by incrementing a counter rather than adding an item.

The census missed the player's health potions entirely, and the miss survived a full wave of restore verification.
There was no inventory list to enumerate and no pickup object that joined the player: the player **permanently
owns** one instance of each consumable as a child object, and "picking up a potion" increments a `count` field on
it. Every census lens that looks for *collections* (inventories, item lists, attachment points) or *ownership
transfer* (world pickup → player) sees nothing, because one integer changes.

The report — "I picked up a potion and it was not in the restored moment" — was misdiagnosed twice as a healing bug,
because "potion doesn't restore" pattern-matched to the heal path. Establish the mechanic first: is the reported
thing an object, an entry, or a counter?

## The rule

When censusing player state (phase 4), hunt the counter-shaped inventory explicitly: grep the pickup/grant paths for
increments (`count++`, `+= amount`, ammo-style add helpers) and capture those counts as attributes. They cost one
int each, are invisible to collection-shaped sweeps, and their absence is exactly what only a human replaying their
own moment notices.
