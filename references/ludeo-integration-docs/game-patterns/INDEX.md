# Game Patterns Index

> **Purpose:** Genre-specific knowledge for Ludeo SDK integration
> **For:** AI agents — load only the pattern file(s) matching your game's genre
> **How to use:** Read this index, identify the game's genre(s), load 1-2 relevant files

---

## Pattern Files Come in Two Shapes

- **Genre patterns** (shooter, rts, racing) describe *what* a Gameplay Session captures — actions, search keywords, tracking checklists.
- **Structural patterns** (open-world, procedural) describe *how* the world is bounded and identified when the genre catalog isn't enough — because the game has no per-level scenes (`open-world.md` + `open-world-tracking.md`), or because its levels are **containers whose content is assembled at load from data + RNG** (`procedural-world.md`).

A streaming-world RPG loads **both** open-world shapes plus the relevant genre file(s). A roguelike loads `procedural-world.md` plus its combat genre file(s). The structural axes are **orthogonal** — a game can be procedural *and* level-based, or procedural *and* streaming; load whatever applies.

## Available Patterns

| File | Shape | Applies to | Load when |
|------|-------|------------|-----------|
| [shooter.md](./shooter.md) | Genre | FPS / TPS / Arena Shooter | Guns, projectiles, health/damage combat, PvE or PvP |
| [rts.md](./rts.md) | Genre | Real-Time Strategy | Unit production, base building, resources |
| [racing.md](./racing.md) | Genre | Racing / Kart / Sim Racing | Laps, race finish, overtakes |
| [rpg.md](./rpg.md) | Genre | Action RPG / open-world RPG / JRPG / MMORPG / looter | Character stats/leveling, quests, inventory/equipment, dialogue, factions |
| [survival-sandbox.md](./survival-sandbox.md) | Genre | Survival / crafting / sandbox / base-builder | Gathering, crafting/building, hunger/thirst meters, placing/destroying world structures |
| [open-world.md](./open-world.md) | Structural (boundaries) | Open-world RPG / sandbox / MMO / streaming world | No per-level scenes; session boundaries are state-machine or event-driven, not `LoadLevel`/`LoadScene`/`StartMatch` |
| [open-world-tracking.md](./open-world-tracking.md) | Structural (tracking) | Same — when mapping/implementing object tracking | The world streams in/out; you need the streaming-world tracking delta over `06` |
| [procedural-world.md](./procedural-world.md) | Structural (assembly + identity) | Roguelike / roguelite / procedural dungeon / wave-survival / daily-seed | The level is a **container**; run content is assembled at load from data + RNG, so capturing "which level" can't relocate the moment and reload **re-rolls** content. Load when a run/level *builder* or *pool* + RNG/seed drives level content |

## How the Agent Should Use These Files

1. **Check the structural axes first (there are two, and they're orthogonal).**
   - *No per-level scenes?* (open-world RPG, sandbox, MMO, streaming world) → load [open-world.md](./open-world.md) before any genre file (it answers "where does a Gameplay Session begin and end"), and when you reach object tracking also load [open-world-tracking.md](./open-world-tracking.md) (presence ≠ existence, world/cell state, identity across streaming).
   - *Levels are containers whose content is assembled at load from data + RNG?* (roguelike, procedural dungeon, wave-survival — a level/run *builder* or *pool* + RNG/seed drives content; `CODE_MAP.session_boundaries.assembly` is `"procedural"`) → load [procedural-world.md](./procedural-world.md). Capturing "which level" can't relocate the moment and reload re-rolls content, so you capture the **generation inputs** instead.
   - A game can hit **both** (a streaming procedural world) or **neither** (a plain level-based game). Load whatever applies, *in addition to* the genre file(s).
2. **Determine genre** — web search the game name, or ask the user if not findable.
3. **Load 1-2 matching genre files** — hybrid games may need multiple. Common mappings: open-world RPG (Skyrim-like) → `rpg.md`; survival/sandbox (Valheim/Minecraft) → `survival-sandbox.md`; open-world action (GTA/Red Dead) → `shooter.md` + `racing.md` (driving) + `rpg.md` (progression); MMORPG → `rpg.md`. Always pair these with the structural files from step 1 when the game streams.
4. **Use the action catalog** as a shopping list — search the codebase for each.
5. **Use the search keywords** to grep for relevant code patterns.
6. **Use the tracking checklist** to validate completeness after object tracking is implemented.

## File Structure (Genre Files)

Genre files (`shooter.md`, `rts.md`, `racing.md`, `rpg.md`, `survival-sandbox.md`) follow a three-section structure:

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
- Reserved for future object tracking commands

**Structural files** (`open-world.md`, `open-world-tracking.md`, `procedural-world.md`) have a different shape — `open-world.md` documents session-boundary doctrine (the OpenRoom bind-point trade-offs, pause/restoration interactions); `open-world-tracking.md` is the streaming-world tracking delta over `06` (presence ≠ existence, world/cell object types, identity across stream cycles); `procedural-world.md` is the non-deterministic-assembly doctrine (level ≠ content, capture the generation inputs, re-drive the generator + suppress the re-roll on restore). They are loaded *in addition to* a genre file, not instead of one.

## Adding a New Genre or Structural Pattern

For a new **genre**, create a `.md` file following the three-section genre structure above. For a new **structural pattern** (e.g. arcade-style "1 life = 1 session", roguelike "1 run = 1 session"), follow the shape of `open-world.md`. Add it to the table above with the correct shape tag. No other changes needed.

## Important Notes

- Genre files describe WHAT to look for, not HOW to find it (that's the command's job)
- Keywords are hints, not exhaustive — every codebase names things differently
- Games often blend genres — load multiple files and merge the action catalogs
- When in doubt about genre, start with the closest match and adjust
