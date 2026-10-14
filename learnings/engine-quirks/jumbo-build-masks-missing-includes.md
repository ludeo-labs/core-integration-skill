---
category: engine-quirks
tier: generalizable
sourceGame: ActionRoguelike
phase: "3"
question: "Does the game's build batch several .cpp files into one translation unit (a jumbo build — CMake UNITY_BUILD, FASTBuild, a custom bundling step)?"
sanitized: true
origin: "unreal:engine-quirks/adaptive-build-exposes-missing-includes"
---

# Jumbo builds mask missing includes

**Precondition:** the build concatenates `.cpp` files into combined translation units.

**Symptom:** after your change, a file you barely touched fails with *cannot open include file* or *incomplete
type* on old lines.

**Cause:** it always lacked an `#include` and borrowed one from a neighbour in its batch. Anything that regroups
batches exposes it — some build tools compile locally modified files alone.

**Fix:** add the missing `#include` to that file; don't disable batching.
