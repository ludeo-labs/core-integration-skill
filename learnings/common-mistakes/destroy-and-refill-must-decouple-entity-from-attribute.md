---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Does the restore destroy entities (in-flight projectiles, held weapons, a throwable in hand) before applying, AND refill an attribute (ammo, inventory count, throwable count) whose value decides whether the game re-creates that entity?"
sanitized: true
origin: "unreal:common-mistakes/destroy-and-refill-must-decouple-actor-from-attribute"
---

# Destroy-and-refill: keep "the entity exists" separate from "the attribute is correct"

**Applies when** the restore path both:

1. **destroys** entities before applying (stale projectiles, the held weapon, the throwable in hand, typical
   when a replay resets in place), and
2. **refills** an attribute that decides whether the game creates that entity on demand (throwable count drives
   "prepare next throwable", ammo drives equip).

## The mistake

The existence check was nested inside the value check:

```cpp
if (!NearlyEqual(cur.inventory, captured.inventory)) {
    SetInventory(captured.inventory);
    if (CurrentHeldItem() == nullptr) PrepareNewHeldItem();   // buried inside the guard
}
```

- **Replay 1:** the previous session left the inventory below the captured value, so the branch runs, the item is
  prepared, and everything works.
- **Replay 2** (same Ludeo, in place, the player didn't use the item in replay 1): the destroy sweep removed the
  held item, but the inventory already equals the captured value, so the **whole block is skipped**, including
  the re-prepare. The UI shows a full count, there's nothing in hand, and input does nothing.

The symptom points elsewhere ("input not registering", "ability stuck"), and it reproduces only when the player
did **not** use the resource in the previous replay. That's why it gets marked resolved too early.

## How to apply

1. **Two independent checks at the same scope:**

   ```cpp
   if (!NearlyEqual(cur.inventory, captured.inventory)) SetInventory(captured.inventory);
   if (CurrentHeldItem() == nullptr)                    PrepareNewHeldItem();   // regardless
   ```

2. **Copy the game's own call sites.** Pickup, ammo and throwable handlers in the game usually call the bare
   `if (none held) prepare()` with no attribute guard around it. Use their structure; don't invent one.
3. **Test the "no use" path:** capture, replay without using the resource, then replay again. Back-to-back replays
   are where in-place state leaks show up (`07 §2.6`, §5.4).
4. **Grep for the shape elsewhere:** any refill block with an existence/create call nested inside a value guard
   (weapon ammo, placeable counts, companion state, inventory).
