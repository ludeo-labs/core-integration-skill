---
category: engine-quirks
tier: generalizable
sourceGame: ActionGame
phase: "1,3,5"
question: "Does the game compile at a language standard older than C++17 (no /std:c++17 or -std=c++17, or an explicit C++14 setting)?"
sanitized: true
origin: "unreal:engine-quirks/cpp17-init-statement-requires-std-17"
---

# Check the game's C++ standard before writing C++17 syntax into game files

**Precondition:** the game (or the module you edit) builds at C++14 or older — MSVC's default unless the project
sets `/std:c++17`; common in older engines.

## Problem

```cpp
if (const MatchState* ms = world.GetMatchState(); ms && ms->skipSetupPhase) { /* ... */ }
```

On a C++14 target MSVC rejects it:

```
error C2429: language feature 'init-statements in if/switch' requires compiler flag '/std:c++17'
```

It fails only in the one translation unit that uses it, so it's easy to write and meet later.

## Mitigation

```cpp
const MatchState* ms = world.GetMatchState();
if (ms && ms->skipSetupPhase) { /* ... */ }
```

## How to apply

In `phase 1`, read the standard from the build files (CMake `CMAKE_CXX_STANDARD`, MSBuild `<LanguageStandard>`,
Makefile `-std=`) per configuration and record it. Below C++17, avoid in game files and integration headers:
init-statements, structured bindings, `std::optional`/`variant`/`string_view`, `if constexpr`, inline variables,
nested namespace definitions. The compile-fix loop (`phase 3 · task 5`) catches slips, but knowing up front avoids
the detour.
