---
category: architecture
tier: universal
sourceGame: ActionGame
phase: "3,5,6"
question: null
sanitized: true
origin: "unreal:architecture/engine-ludeo-gates-must-cascade-to-callers"
---

# When you gate a game-code field or method, gate every reference to it too

## The rule

Every field, method, export decoration or include that the integration adds to **game code** sits behind
`#if LUDEO_SDK_ENABLED` (CR-001) — and so must **every reference to that symbol in every translation unit**, including
the integration's own files. Turning the define off must give a build that (a) compiles and links cleanly and (b)
carries no Ludeo-introduced symbols: same classes, same export table.

## The cascade

A new field forces every reader into the gate:

```cpp
// MatchState.h
#if LUDEO_SDK_ENABLED
bool skipSetupPhase = false;
#endif

// MatchState.cpp (same module)
#if LUDEO_SDK_ENABLED
if (skipSetupPhase && missionActive) { /* ... */ }
#endif

// LudeoStateAdapter.cpp (integration code — a different file, same rule)
#if LUDEO_SDK_ENABLED
matchState.skipSetupPhase = true;
#endif
```

## The export gotcha

If the integration lives in another module (DLL / shared library) and calls into game code, the called method needs
the module's export decoration. That decoration must be gated as well, or the disabled build ships a library with an
extra exported symbol:

```cpp
// Wrong — the export exists in the disabled build too
static GAME_API DialogManager* Get();

// Right — the export table is identical with the define off
#if LUDEO_SDK_ENABLED
static GAME_API DialogManager* Get();
#else
static DialogManager* Get();
#endif

#if LUDEO_SDK_ENABLED
GAME_API void SuppressForLudeoBoot();
GAME_API void ResumeAfterLudeoBoot();
#endif
```

## The include gotcha

An `#include` added only for gated code should be gated too. It is optional when the header compiles cleanly either
way, but it keeps the disabled build's include graph unchanged.

## How to audit

Before each commit that edits game code:

1. Grep the game and integration sources for every symbol you added (`grep -rn "Ludeo\|skipSetupPhase\|SuppressForLudeo"`).
2. For each hit outside a gate, ask: does it reference something that exists only when the define is on? If yes, gate it.
3. **Build with `LUDEO_SDK_ENABLED=0`** — don't reason about it, compile it (CR-001's checklist asks for both builds).
   A surviving reference fails here, not in a customer's shipping build.
