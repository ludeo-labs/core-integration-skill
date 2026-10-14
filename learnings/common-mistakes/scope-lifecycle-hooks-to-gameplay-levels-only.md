---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "3"
question: "Does the hook you attach the Creator-Flow OpenRoom (or other SDK lifecycle work) to also fire for non-gameplay levels: main menu, lobby, transition/loading levels?"
sanitized: true
origin: "unreal:common-mistakes/component-attaches-to-all-gamestate-including-menu"
---

# Scope lifecycle hooks to gameplay levels; menu and transition levels load too

**Applies when** the hook you chose for the Creator-Flow `ludeo_Session_OpenRoom` ("level loading starts",
CR-009) is generic. A world-created, level-load-started or game-mode-set callback fires for **every** level the
game loads, the main menu, lobby and transition levels included.

## What happened

The integration attached its per-level Ludeo logic in a generic "level/game-state created" callback. The main
menu is a level too, so during boot the integration opened a room, added a player and started SDK network
traffic while the game was still loading into its menu. The boot's async loading chain stalled and the loading
screen never finished. With every request completing through `ludeo_Tick` on the game thread, that extra traffic
competed with the game's own boot work.

The menu also produced an unscored room nobody would ever play, and its teardown raced the real level's
`OpenRoom`.

## The fix

Filter the hook to **gameplay** levels:

```cpp
void LudeoManager::OnLevelLoadStarted(const LevelInfo& level) {
    if (!level.IsGameplayLevel()) return;   // menu, lobby, transition, loading: no room
    if (IsRestoring()) return;              // Player Flow opens its room after the settle (CR-010)
    OpenRoom(nullptr);                      // Creator Flow
}
```

## How to apply

1. In phase 2, list every level/mode the game loads, and how the code tells gameplay apart from front-end (game
   mode, level type, a "has player" flag). Record it in `CODE_MAP.json`.
2. Base the filter on what only gameplay levels **contain** — a per-level gameplay manager, gameplay-only
   infrastructure, or the level descriptor's own "gameplay" type. Two tempting signals have each broken an
   integration: a rules/mode class, which a project-wide default can hand to menu and meta levels too
   (`learnings/architecture/classify-gameplay-levels-by-gameplay-infrastructure.md`), and a hard-coded level index or
   name list, which shifts when levels are added, removed or reordered
   (`learnings/architecture/bind-the-creator-openroom-to-the-level-loader-and-classify-levels-by-content.md`).
3. If several modes are gameplay, test for what they all carry, not for each mode by name.
4. **Red flag:** any SDK traffic (room open, player add) in the log before the main menu has appeared on a normal
   boot.
