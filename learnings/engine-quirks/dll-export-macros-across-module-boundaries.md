---
category: engine-quirks
tier: generalizable
sourceGame: multiple
phase: "3,5"
question: "Is the game built as several DLL modules with export macros (MSVC __declspec(dllexport)/dllimport), and does integration code in one module call game code in another?"
sanitized: true
origin: "unreal:engine-quirks/c2487-redundant-dll-interface, unreal:engine-quirks/lyra-unexported-symbols"
---

# Calling game code across a DLL boundary: export what you call — once, at the right level

**Precondition:** game code is split into DLL modules, each with an export macro (`GAME_API` below), and the
integration lives in — or calls into — a different module than the game classes it uses.

## Problem 1 — unexported methods: LNK2019

Game classes often export only the methods other modules already needed. When the integration module calls a
method that isn't exported, the header compiles and the link fails:

```
error LNK2019: unresolved external symbol "... PhaseManager::WhenPhaseStarts(...)"
```

**Fix:** add the module's export macro to that method's declaration (or to the class). It is a **game-code
change** — list it in the TDD's game-modifications table. During `phase 2`, enumerate every game method the
integration will call across a module boundary and check each for an export; that list is cheaper to produce up
front than to discover one link error at a time. Common candidates: phase/state manager subscriptions, game-mode
events, spawn/registry managers, inventory and save entry points.

## Problem 2 — exporting twice: C2487

If the class is already exported at class scope, adding the macro to one of its methods is an error in MSVC:

```cpp
class GAME_API MissionState : public GameState {
    GAME_API void Ludeo_SetWave(int wave);   // ❌ C2487: member of dll interface class
    void Ludeo_SetWave(int wave);             // ✅ the class export already covers it
};

class TrafficManager {                        // not exported at class scope
    GAME_API int Ludeo_GetWave() const;       // ✅ per-method export needed here
};
```

## How to apply

Before adding an export macro, look at the class line:

```bash
grep -nE "^\s*class\s+\w+_API\s+<ClassName>\b" path/to/header.h
```

- Class line carries the macro → don't add it per method.
- It doesn't → add it to each method the integration calls (or, if many, to the class — a bigger, more visible
  game change; ask first).
- Inline methods defined in the header need no export at all — another way to avoid touching the class's export
  surface for a small accessor.
