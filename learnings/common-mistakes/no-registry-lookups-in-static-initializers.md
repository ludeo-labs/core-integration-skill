---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "3"
question: "Does integration code look up runtime-registered ids (tags, interned names, event ids, type registries) in a static or global initializer?"
sanitized: true
origin: "unreal:engine-quirks/no-request-gameplay-tag-in-static-init"
---

# Don't resolve registry ids in static initializers — resolve them lazily

**Precondition:** a static resolves a runtime-registered id.

Static initializers run at load time, before the game fills its registries from config. A lookup there asserts
("id not found"), returns an invalid id, or registers a different one that never matches.

```cpp
// ❌ const PhaseId kPlaying = PhaseRegistry::Find("Game.Phase.Playing");
const PhaseId& Playing() {
    static const PhaseId id = PhaseRegistry::Find("Game.Phase.Playing");  // first use, at runtime
    return id;
}
```

Literals and `constexpr` constants are fine as statics; only lookups of runtime-filled state are the hazard.
