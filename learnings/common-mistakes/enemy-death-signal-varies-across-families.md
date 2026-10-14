---
category: common-mistakes
tier: generalizable
sourceGame: EndlessFPS
phase: "6"
question: "Does the game have several enemy families (regular mobs, bosses, special creatures, often from different packs or authors), and does Kill detection poll a single health/death field across all of them?"
sanitized: true
origin: "unreal:common-mistakes/enemy-death-signal-varies-across-families"
---

# Don't assume every enemy family exposes the same health/death field

**Applies when** Kills are detected by polling enemy state, and the enemies come from several families with
independently written logic: regular mobs, bosses, special creatures, content from different packs or teams.

## The mistake

The Kill poll read one field, `health`, on every enemy and fired when it crossed `<= 0`. Whole families never
fired:

- regular mobs had a numeric health plus a dead flag, and worked;
- the **boss** had **no plain health at all**. Its HP lived in phase logic ("change phase after N hits"), and it
  exposed only a dead flag and a death event;
- some leaf types declared only their own behavior fields and **inherited** health and dead-flag from a shared
  base (or a script-side parent) that a quick look at the leaf missed.

Result: "the boss kill never shows up".

## The fix

Read a **death signal** through a fallback chain, not one specific field:

```cpp
std::optional<bool> ReadEnemyDead(const Enemy& e) {
    if (auto f = e.DeadFlag())  return *f;            // the explicit dead flag first; names vary per family
    if (auto h = e.Health())    return *h <= 0.0;     // numeric health second (check the stored type)
    return std::nullopt;                              // no reachable signal: can't detect
}
```

Fire the Kill on a `false → true` transition for an enemy that's still present. A family with **no** reachable
signal simply never fires, so there are no false positives. Running the poll over all families is safe, and a
runtime test shows which families fire.

## Confirm reachability per family

- Don't conclude "this family has no death signal" from its own class or script alone. Walk the **full
  inheritance/parent chain**, including script- or data-defined parents.
- Read where the dead flag or health is actually written (the death path) to confirm the field means what you
  think.
- Check the field's **stored type** before reading it: a value you assume is a float can be stored as a double
  or an int, and a wrong-width read returns garbage or zero (symptom: health always reads as full, so Kill never
  fires).

Then test-kill one enemy of **every** family in a run and grep the log for each `Kill`.
