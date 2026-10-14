---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Do dead enemies stay visible (corpses, wrecks) while the game removes the logical entity within a frame or two of death, and does the team want corpses on screen in the replay?"
sanitized: true
origin: "unreal:common-mistakes/dead-bodies-need-kill-time-capture"
---

# Corpse capture needs a kill-time buffer; iterating dead entities at capture time finds none

**Applies when** the game destroys the logical enemy entity within a frame or two of death (the ragdoll or wreck
is a separate visual, or is cleaned up quickly), and the replay should show recent corpses.

## The mistake

The first design captured corpses in the same per-tick pass as everything else: iterate the enemies, collect the
dead ones' type and transform, write a "dead bodies" attribute. The count was **0 on every tick**, even in heavy
combat. The logical entity was already gone by the next capture tick, so iteration only ever saw live enemies. The
capture was right in principle; the observation window was wrong.

## The rule

**Record corpse data at the moment of death**, into a bounded FIFO the integration owns:

```cpp
// every capture tick, per tracked enemy: refresh a last-known cache
e.lastType = entity->TypeId(); e.lastTransform = entity->Transform();

// in the kill detector, on the alive → dead transition
//   path A: entity still present and now dead       → cache is current
//   path B: entity already removed since last tick  → last tick's cache is still usable
corpses.push_back({ e.lastType, e.lastTransform });
if (corpses.size() > kMaxCorpses) corpses.pop_front();          // e.g. 50

// every capture tick, on the metadata object: always write it, even when empty
WriteCorpseList(writer, corpses);
```

Path B matters: if the entity can disappear between two polls, the detector must treat "tracked last tick, gone
now" as a death, using the cached state. **Always write the attribute, even when it's empty.** Reading an
attribute that is absent from the capture asserts (`11 §6.8`).

The cap keeps the attribute bounded on long sessions; a few dozen recent bodies covers most picked frames.

## Caveat: the picked frame

Even with a correct buffer, a replay can legitimately show no corpses. The restore reproduces the buffer **at the
picked frame**, and a frame before any kills holds none. That's not a bug.

## Verify

Log each capture (observed vs removed-before-observed, running total). If the total stays at 0 during combat,
the kill transition isn't firing. Debug that, not the serialization.

Related: `learnings/save-systems/captured-dead-entities-restore-as-corpses-via-death-path.md` (the other case: the
killed entity stays in the world as the same object, so the snapshot already holds it dead).
