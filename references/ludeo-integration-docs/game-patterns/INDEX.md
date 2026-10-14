# Game Patterns Index

> **Purpose:** Genre-specific knowledge for Ludeo SDK integration
> **For:** AI agents — load only the pattern file(s) matching your game's genre
> **How to use:** Read this index, identify the game's genre(s), load 1-2 relevant files

---

## Pattern Files Come in Three Shapes

- **Genre patterns** (shooter, rts, racing, rpg, survival-sandbox, turn-based) describe *what* a Gameplay Session captures — actions, search keywords, tracking checklists. [`common.md`](./common.md) is the genre-checklist form of the **universal capture baseline** every genre shares (look/aim vs body rotation, armor/shield pool, defeat state, stance, appearance); the genre files add only what is genre-specific on top of it.
- **Structural patterns** (open-world, procedural) describe *how* the world is bounded and identified when the genre catalog isn't enough — because the game has no per-level scenes (`open-world.md` + `open-world-tracking.md`), or because its levels are **containers whose content is assembled at load from data + RNG** (`procedural-world.md`).
- **Gameplay-structure patterns** (bosses) describe a *scripted, stateful sequence inside the game* whose state is established by one-shot triggers and cutscenes — so a naive "track it like any enemy" replay looks right on frame 1 and cannot play through (`bosses.md`). They are about restoring *into the middle of* a sequence, not about world bounds or genre catalogs.

A streaming-world RPG loads **both** open-world shapes plus the relevant genre file(s). A roguelike loads `procedural-world.md` plus its combat genre file(s); a roguelike with boss floors adds `bosses.md`. The structural and gameplay-structure axes are **orthogonal** — a game can be procedural *and* level-based, procedural *and* streaming, and have bosses on top of either; load whatever applies.

## Available Patterns

| File | Shape | Applies to | Load when |
|------|-------|------------|-----------|
| [common.md](./common.md) | Genre (universal baseline) | Every genre | **Always**, alongside the genre file(s) — the player/avatar items every game captures (look/aim vs body rotation, armor/shield pool, defeat state, stance, appearance, derived FOV) |
| [shooter.md](./shooter.md) | Genre | FPS / TPS / Arena Shooter | Guns, projectiles, health/damage combat, PvE or PvP |
| [rts.md](./rts.md) | Genre | Real-Time Strategy | Unit production, base building, resources |
| [racing.md](./racing.md) | Genre | Racing / Kart / Sim Racing | Laps, race finish, overtakes |
| [rpg.md](./rpg.md) | Genre | Action RPG / open-world RPG / JRPG / MMORPG / looter | Character stats/leveling, quests, inventory/equipment, dialogue, factions |
| [survival-sandbox.md](./survival-sandbox.md) | Genre | Survival / crafting / sandbox / base-builder | Gathering, crafting/building, hunger/thirst meters, placing/destroying world structures |
| [turn-based.md](./turn-based.md) | Genre (**provisional**) | Turn-based tactics / SRPG / grid or initiative combat / roguelike tactics | Discrete turns or initiative order, action points, grid movement, unit-by-unit actions. Carries turn-boundary capture cadence and restore-timing rules |
| [bosses.md](./bosses.md) | Gameplay-structure | Any game with boss / named / scripted-encounter enemies (action, RPG, shooter, soulslike, roguelike, bullet-hell) | A fight is a scripted, stateful sequence — phases/forms, a locked arena, summoned adds, a one-shot spawn trigger, an intro cutscene. Load **in addition to** the genre file(s) |
| [open-world.md](./open-world.md) | Structural (boundaries) | Open-world RPG / sandbox / MMO / streaming world | No per-level scenes; session boundaries are state-machine or event-driven, not `LoadLevel`/`LoadScene`/`StartMatch` |
| [open-world-tracking.md](./open-world-tracking.md) | Structural (tracking) | Same — when mapping/implementing object tracking | The world streams in/out; you need the streaming-world tracking delta over `06` |
| [procedural-world.md](./procedural-world.md) | Structural (assembly + identity) | Roguelike / roguelite / procedural dungeon / wave-survival / daily-seed | The level is a **container**; run content is assembled at load from data + RNG, so capturing "which level" can't relocate the moment and reload **re-rolls** content. Load when a run/level *builder* or *pool* + RNG/seed drives level content |

## How the Agent Should Use These Files

1. **Check the structural axes first (there are two, and they're orthogonal).**
   - *No per-level scenes?* (open-world RPG, sandbox, MMO, streaming world) → load [open-world.md](./open-world.md) before any genre file (it answers "where does a Gameplay Session begin and end"), and when you reach object tracking also load [open-world-tracking.md](./open-world-tracking.md) (presence ≠ existence, world/cell state, identity across streaming).
   - *Levels are containers whose content is assembled at load from data + RNG?* (roguelike, procedural dungeon, wave-survival — a level/run *builder* or *pool* + RNG/seed drives content; `CODE_MAP.session_boundaries.assembly` is `"procedural"`) → load [procedural-world.md](./procedural-world.md). Capturing "which level" can't relocate the moment and reload re-rolls content, so you capture the **generation inputs** instead.
   - A game can hit **both** (a streaming procedural world) or **neither** (a plain level-based game). Load whatever applies, *in addition to* the genre file(s).
2. **Check the gameplay-structure axis.** Does the game have bosses or other scripted encounters (a locked arena, phases/forms, summoned adds, a one-shot spawn trigger)? → load [bosses.md](./bosses.md) *in addition to* the genre file(s). It is orthogonal to the two structural axes above.
3. **Determine genre** — web search the game name, or ask the user if not findable.
4. **Load [common.md](./common.md) and 1-2 matching genre files** — hybrid games may need multiple. Common mappings: open-world RPG (Skyrim-like) → `rpg.md`; survival/sandbox (Valheim/Minecraft) → `survival-sandbox.md`; open-world action (GTA/Red Dead) → `shooter.md` + `racing.md` (driving) + `rpg.md` (progression); MMORPG → `rpg.md`. Turn-based tactics / SRPG / grid combat → `turn-based.md` (provisional — confirm against the game). Always pair these with the structural files from step 1 when the game streams.
5. **Use the action catalog** as a shopping list — search the codebase for each.
6. **Use the search keywords** to grep for relevant code patterns.
7. **Use the tracking checklist** to validate completeness after object tracking is implemented. Checklist items are tagged **CRITICAL** (restore or the moment is visibly wrong), **IMPORTANT** (fidelity) or **OPTIONAL** (situational) — implement in that order, and don't skip a visible-but-constant item such as appearance.

## File Structure (Genre Files)

Genre files (`shooter.md`, `rts.md`, `racing.md`, `rpg.md`, `survival-sandbox.md`, `turn-based.md`) follow a three-section structure (`common.md` is the shared baseline checklist those files build on):

### Section 1: Actions Catalog
- Action names, descriptions, Ludeo objective/scoring potential
- Grouped by category (combat, progression, etc.)

### Section 2: Search Keywords
- Function/variable name fragments to grep for in the codebase
- Grouped by action category
- These are starting points — the agent should also discover game-specific patterns

### Section 3: Tracking Checklist (Scaffolding)
- What objects and properties typically matter for this genre
- Used as a validation checklist, not a search guide
- Tiered by restoration priority (**CRITICAL** / **IMPORTANT** / **OPTIONAL**)
- Reserved for future object tracking commands

**Structural files** (`open-world.md`, `open-world-tracking.md`, `procedural-world.md`) have a different shape — `open-world.md` documents session-boundary doctrine (the OpenRoom bind-point trade-offs, pause/restoration interactions); `open-world-tracking.md` is the streaming-world tracking delta over `06` (presence ≠ existence, world/cell object types, identity across stream cycles); `procedural-world.md` is the non-deterministic-assembly doctrine (level ≠ content, capture the generation inputs, re-drive the generator + suppress the re-roll on restore). They are loaded *in addition to* a genre file, not instead of one.

**Gameplay-structure files** (`bosses.md`) are a third shape: a framework of doctrine rather than a catalog — why the sequence's state is established by one-shot triggers, where its "phase" actually lives, restoring into a phase, restoring every one-shot latch, re-arming the processes a spawn trigger started, and minion classification flags — plus a tracking checklist, actions and known unknowns. Also loaded *in addition to* a genre file.

## Adding a New Genre or Structural Pattern

For a new **genre**, create a `.md` file following the three-section genre structure above. For a new **structural pattern** (e.g. arcade-style "1 life = 1 session", roguelike "1 run = 1 session"), follow the shape of `open-world.md`. For a new **gameplay-structure pattern** (a scripted, stateful sequence such as a puzzle set-piece or a heist), follow the shape of `bosses.md`. Add it to the table above with the correct shape tag. No other changes needed.

## Important Notes

- Genre files describe WHAT to look for, not HOW to find it (that's the command's job)
- Keywords are hints, not exhaustive — every codebase names things differently
- Games often blend genres — load multiple files and merge the action catalogs
- When in doubt about genre, start with the closest match and adjust
