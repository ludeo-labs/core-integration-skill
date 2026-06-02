# Game Patterns Index

> **Purpose:** Genre-specific knowledge for Ludeo SDK integration
> **For:** AI agents — load only the pattern file(s) matching your game's genre
> **How to use:** Read this index, identify the game's genre(s), load 1-2 relevant files

---

## Pattern Files Come in Two Shapes

- **Genre patterns** (shooter, rts, racing) describe *what* a Gameplay Session captures — actions, search keywords, tracking checklists.
- **Structural patterns** (open-world) describe *how* a Gameplay Session is bounded when the genre catalog isn't enough — typically because the game has no per-level scenes.

A streaming-world RPG loads **both**: `open-world.md` for the session boundary, plus the relevant genre file(s) for actions/tracking.

## Available Patterns

| File | Shape | Applies to | Load when |
|------|-------|------------|-----------|
| [shooter.md](./shooter.md) | Genre | FPS / TPS / Arena Shooter | Guns, projectiles, health/damage combat, PvE or PvP |
| [rts.md](./rts.md) | Genre | Real-Time Strategy | Unit production, base building, resources |
| [racing.md](./racing.md) | Genre | Racing / Kart / Sim Racing | Laps, race finish, overtakes |
| [open-world.md](./open-world.md) | Structural | Open-world RPG / sandbox / MMO / streaming world | No per-level scenes; session boundaries are state-machine or event-driven, not `LoadLevel`/`LoadScene`/`StartMatch` |

## How the Agent Should Use These Files

1. **Check the structural axis first.** If the game has no per-level scenes (open-world RPG, sandbox, MMO, streaming world), load [open-world.md](./open-world.md) before any genre file — it answers "where does a Gameplay Session begin and end" for these games.
2. **Determine genre** — web search the game name, or ask the user if not findable.
3. **Load 1-2 matching genre files** — hybrid games may need multiple.
4. **Use the action catalog** as a shopping list — search the codebase for each.
5. **Use the search keywords** to grep for relevant code patterns.
6. **Use the tracking checklist** to validate completeness after object tracking is implemented.

## File Structure (Genre Files)

Genre files (`shooter.md`, `rts.md`, `racing.md`) follow a three-section structure:

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

**Structural files** (`open-world.md`) have a different shape — they document session-boundary doctrine, the OpenRoom bind-point trade-offs, and pause/restoration interactions for games where the genre catalog alone isn't enough.

## Adding a New Genre or Structural Pattern

For a new **genre**, create a `.md` file following the three-section genre structure above. For a new **structural pattern** (e.g. arcade-style "1 life = 1 session", roguelike "1 run = 1 session"), follow the shape of `open-world.md`. Add it to the table above with the correct shape tag. No other changes needed.

## Important Notes

- Genre files describe WHAT to look for, not HOW to find it (that's the command's job)
- Keywords are hints, not exhaustive — every codebase names things differently
- Games often blend genres — load multiple files and merge the action catalogs
- When in doubt about genre, start with the closest match and adjust
