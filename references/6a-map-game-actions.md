# Phase 6 · Task 1 — Map Game Actions

Analyze the game codebase to identify where Ludeo actions (`LUDEO_ACTION()`) should be placed, based on the game's genre and gameplay event patterns.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 6 · task 1 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 6 · task 1** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Prerequisites

**From the intake** (`ludeo-integration-plan/integration.json` → `intake`; [`know-your-game.md`](know-your-game.md)) — `profile.keyActions` and `profile.ludeoConcept` are the actions a creator will build goals
on — make sure each is mapped.

> ⚠️ **REQUIRED:** Run `phase 2` first.
> This command reads `ludeo-integration-plan/CODE_MAP.json` for the game name and codebase structure.
>
> ⚠️ **REQUIRED:** `phase 5` complete — a captured moment replays. Actions run last so each one can be
> verified firing in **both** the Creator flow and the Player flow; without a working replay you can
> only ever check half of that.
>
> **Recommended:** If `ludeo-integration-plan/TDD_<GameName>.md` exists, read its **Actions Capture** section — it defines the capture strategy and attribution approach already agreed upon.

## 📚 Context Files

**Action Required:** You must read the following files. Do not assume they are in context. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/research-context/02C-RESEARCH-ACTIONS.md` - Actions research template (output format)
- `ludeo-integration-docs/game-patterns/INDEX.md` - Genre pattern index

**Genre pattern files** are loaded dynamically in Step 2 below.

## Your Task

### Step 1: Read CODE_MAP and Extract Game Name

Read `ludeo-integration-plan/CODE_MAP.json`. Extract:
- `game_name` from `codebase_summary`
- `core_classes` (useful for understanding code structure)
- Source file directories (where to search)

### Step 2: Determine Genre

**Primary method — web search:**
Search the web for `"<game_name>" game genre` (e.g., `"Red Eclipse" game genre`). Use the result to identify one or more genres.

**Fallback — if web search fails** (unreleased game, internal project, no results):
Ask the user: "I couldn't determine the genre for `<game_name>`. What genre is this game? (e.g., shooter, rts, platformer, racing, rpg, survival/sandbox)"

**Once genre is known:**
1. Read `ludeo-integration-docs/game-patterns/INDEX.md`
2. **Check the structural axis first.** If `CODE_MAP.session_boundaries` has the sub-structure `{ model, start_sites[], exit_sites[], pause_overlay[] }` (open-world / streaming / sandbox / state-machine-driven — no per-level scenes), load `game-patterns/open-world.md` in addition to the genre file(s). It is **structural**, not genre — it tells you that "one run = one Gameplay Session," which means actions accumulate across the whole live run rather than resetting per level. The genre file still provides the action catalog.
3. Load the matching genre pattern file(s) from `ludeo-integration-docs/game-patterns/`
4. For hybrid games, load multiple pattern files and merge their action catalogs and search keywords

If no genre pattern file exists for this game's genre, inform the user:
> "No genre pattern file exists for `<genre>`. I'll use a general search strategy. Consider creating `ludeo-integration-docs/game-patterns/<genre>.md` for future integrations."

Then proceed with a broad search spanning common genres: combat (kill, death, damage, score), collection (pickup, collect, loot), progression (objective, complete, quest, levelUp, win, lose), and crafting/building (craft, build, gather) for RPG/survival-leaning games.

### Step 3: Search Codebase for Action Patterns

Using the **search keywords** from the genre pattern file(s), grep the game's source directories.

**Search strategy:**
1. For each keyword group in the genre file (e.g., "Combat / Damage / Kill"), grep for the listed keywords in function names and method names
2. Focus on:
   - Function definitions (not just references)
   - Event handlers (`On*`, `Handle*`, callbacks)
   - Functions that clearly represent a gameplay moment
3. Filter out:
   - Engine/framework internals
   - UI/rendering code
   - Utility/helper functions
   - Getters/setters for continuous state (these are tracking, not actions)

**Key distinction:** You're looking for **discrete events** (something happened), not **state changes** (something is now X). A `OnPlayerKilled()` is an action. A `SetHealth(50)` is tracking. When in doubt, keep it — the mapping step will filter.

### Step 4: Map Findings to Ludeo Actions

For each found gameplay event function:
1. Match it against the genre's **action catalog**
2. Assign a Ludeo action name (PascalCase, following naming conventions in 02C)
3. Assess objective and scoring potential
4. If an event doesn't match any cataloged action but looks gameplay-relevant, add it as a game-specific action

Also check for **gaps**: review the genre action catalog for expected actions that were NOT found in the code. Flag these as:
> "Expected `<ActionName>` for this genre but no matching code found. This may be named differently or handled in a non-obvious way. Manual review recommended."

**Also map the non-gameplay standard actions** under a dedicated **Non-Gameplay Actions** category. Two pairs, both with **fixed standard names** — they only work once a matching Global Trigger exists on Ludeo's platform, and a trigger event can be bound to one action per environment, so per-area names (`ShopEntered`, `DialogueStarted`, …) cannot all be connected:

- **Non-ludeoable areas** (shops/stalls, NPC dialogue, tutorials, safe zones/hubs, in-game menus) — every enter site → `StartNoneLudeable`, every exit site → `StopNoneLudeable`. Tracking keeps running; the backend excludes the window. Flag any area **without a clear exit** — a dangling `StartNoneLudeable` never re-enables Ludeo creation. See `06-TRACKING-PATTERNS.md §7.3`.
- **Pause / resume** — `PauseLudeo` / `ResumeLudeo`, for **every** pause. Find the game's **pause primitive** — the one freeze function every pause path funnels through (`Game::SetPaused(bool)`, `Simulation::Freeze()`, …) — and map *that*, not the ESC key handler and not the function that shows the pause menu: the SDK's `PauseGameRequest` handler will be routed through this primitive, and a primitive that also opens the game's menu would stack that menu under the Ludeo overlay. If freeze and menu-show are the same function, note it — `phase 6 · task 2` then needs a freeze-only path for the SDK handler. Enumerate its callers so nothing is missed: the pause menu, cutscenes, dialogue boxes, loading screens, focus loss, **and the SDK's `PauseGameRequest` handler** (CR-011) — that handler freezes the simulation but freezing does **not** stop the Ludeo objective timer; only the `PauseLudeo` action reaching its trigger does. Record every **unpause** path too — a `PauseLudeo` with no reachable `ResumeLudeo` leaves the timer stopped for the rest of the run. Note whether the SDK handler and the primitive would *both* emit: the pause must be reported once per transition. If the game has no pause at all, say so — do not invent one.

Pick the pair by **what should happen to the clock**: non-ludeoable keeps the objective timer running and the backend keeps the span's data; pause/resume stops the timer and the backend saves nothing. Both pairs belong in every integration. They are session/area events, so they are **not** player-guarded, and they fire in both the Creator and Player flows.

### Step 5: Produce Output

Write `ludeo-integration-plan/GAME_ACTIONS_MAP.md`:

```markdown
# Game Actions Map — <GameName>

**Genre:** <genre(s)>
**Genre patterns used:** <pattern file(s)>
**Total actions found:** X
**Total gaps:** Y

## Actions by Category

### Combat

| Action Name | Description | Source Function | File:Line | Confidence | Objective Potential | Scoring Potential |
|-------------|-------------|----------------|-----------|------------|---------------------|-------------------|
| Kill | Player kills an enemy | CombatManager::OnEnemyKilled | src/combat/CombatManager.cpp:245 | high | Kill 10 enemies | 100 pts |
| Headshot | Kill via headshot | CombatManager::OnEnemyKilled (headshot branch) | src/combat/CombatManager.cpp:252 | high | Get 5 headshots | +50 bonus |

### [Other Categories...]

### Non-Gameplay Actions

| Action Name | Site | Source Function | File:Line | Confidence | Notes |
|-------------|------|----------------|-----------|------------|-------|
| StartNoneLudeable | Enter shop | ShopUI::Open | src/ui/ShopUI.cpp:88 | high | needs a matching StopNoneLudeable on every exit path |
| StopNoneLudeable | Exit shop | ShopUI::Close | src/ui/ShopUI.cpp:140 | high | closes the window |
| PauseLudeo | Any pause | Game::SetPaused(true) | src/core/Game.cpp:310 | high | the pause primitive. Callers: PauseMenu::Show, Cutscene::Play, LoadingScreen::Show, OnFocusLost, **LudeoManager::OnPauseGameRequest** |
| ResumeLudeo | Any unpause | Game::SetPaused(false) | src/core/Game.cpp:318 | high | every unpause path — a dangling PauseLudeo leaves the timer stopped |

## Gaps

| Expected Action | Reason |
|-----------------|--------|
| MultiKill | No multi-kill detection found in code. Manual review recommended. |
```

**Confidence levels:**
- `high` — clear match between code and genre action (e.g., `OnPlayerKilled` → `Kill`)
- `medium` — likely match but naming is indirect (e.g., `ProcessHit` with death check → `Kill`)
- `low` — possible match, needs manual review (e.g., generic event that might be an action)

## Output

| File | Purpose |
|------|---------|
| `ludeo-integration-plan/GAME_ACTIONS_MAP.md` | Action map for user review and implementation commands |

## Important Notes

- **Actions are discrete events**, not continuous state. `OnKill` = action. `SetHealth` = tracking (not this command's scope).
- **PascalCase naming** for all Ludeo action names (e.g., `Kill`, `CollectCoin`, `ObjectiveComplete`)
- **Multiple genre files** can be loaded for hybrid games — merge and deduplicate
- **Game-specific actions** are expected — not everything will match the genre catalog
- **Gaps are valuable** — they tell the user what's missing, not that something is wrong
- **Non-ludeoable areas are an action category, not a tracking pause.** Shops, NPC dialogue, tutorials, safe zones, and in-game menus are marked by `StartNoneLudeable`/`StopNoneLudeable` wired to a global trigger on the platform — capture keeps running through them. See `06 §7.3`.
- **Every pause emits `PauseLudeo`/`ResumeLudeo`**, the SDK's overlay pause included — freezing the game does not stop the objective timer. Use the standard names exactly; they are what the Global Triggers are created on.
- The output of this command feeds into future implementation commands

## Related Phases

- `phase 2` - Creates CODE_MAP (run FIRST)
- `phase 3 · task 1` - Lifecycle integration points (phase 1)

## Next Steps

After running this command:
1. Review `GAME_ACTIONS_MAP.md` with the user
2. Confirm/adjust action names and priorities
3. Run `phase 6 · task 2` to implement `LUDEO_ACTION()` calls at each identified location
