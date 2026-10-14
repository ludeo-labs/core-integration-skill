---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: "3"
question: "Does the integration decide 'this is a gameplay level' (Creator OpenRoom, tracking start) from a game-rules or game-state class that non-gameplay levels can also end up with — for example through an engine-wide default applied to every level without an explicit override?"
sanitized: true
origin: "unreal:architecture/global-default-gamemode-breaks-class-world-filter"
---

# Classify gameplay levels by the infrastructure only they carry, not by a rules class a default can leak into

**Precondition:** the engine assigns each level a rules/state class, with a project-wide default for levels that
don't override it — and that default is the gameplay class.

## What happened

The plan was to start Ludeo work only in battle levels, identified by "the level's rules class is the gameplay one".
Scanning the levels showed:

- the main menu level overrode the class — filtered out correctly;
- the campaign/meta level had **no override**, so it inherited the project default — the gameplay class — and spawned
  the gameplay state object **although no battle ever runs there**. The class filter would have opened a Creator room
  (`05 §6.2`) on the campaign map.

## The fix

Gameplay levels carry infrastructure the gameplay cannot run without — a grid manager, a turn manager, a wave director.
Menus and meta levels have none. Classify on that:

```cpp
bool IsBattleLevel(const Level& level) {
    return level.FindFirstEntityOfType("GridManager") != nullptr;   // gameplay-only infrastructure
}
```

Matching by type **name** keeps the check free of compile-time coupling to the gameplay module.

Mind the timing: the Creator `OpenRoom` goes out when the level **starts loading** (CR-009), before its entities
exist. If the hook must decide at load start, answer the same question from the level's data or descriptor (does its
entity list name the infrastructure type?) rather than from the live world.

## How to verify cheaply

Check **every** level, not just the one you're testing: scan the level data files for the infrastructure type —
gameplay levels must hit, menu and meta levels must not — and list which levels override the default rules class and
which inherit it.

Related: `learnings/common-mistakes/scope-lifecycle-hooks-to-gameplay-levels-only.md`,
`learnings/architecture/bind-the-creator-openroom-to-the-level-loader-and-classify-levels-by-content.md`.
