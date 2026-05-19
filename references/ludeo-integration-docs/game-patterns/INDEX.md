# Game Patterns Index

> **Purpose:** Genre-specific knowledge for Ludeo SDK integration
> **For:** AI agents — load only the pattern file(s) matching your game's genre
> **How to use:** Read this index, identify the game's genre(s), load 1-2 relevant files

---

## Available Genre Patterns

| File | Genre | Key Actions | Status |
|------|-------|-------------|--------|
| [shooter.md](./shooter.md) | FPS / TPS / Arena Shooter | Kill, Death, Headshot, Pickup, Reload | Active |
| [rts.md](./rts.md) | Real-Time Strategy | BuildUnit, BuildStructure, Research, Capture | Active |

## How the Agent Should Use These Files

1. **Determine genre** — web search the game name, or ask the user if not findable
2. **Load 1-2 matching files** — hybrid games may need multiple
3. **Use the action catalog** as a shopping list — search the codebase for each
4. **Use the search keywords** to grep for relevant code patterns
5. **Use the tracking checklist** to validate completeness after object tracking is implemented

## File Structure (All Genre Files Follow This)

Each genre file has three sections:

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

## Adding a New Genre

Create a new `.md` file following the same three-section structure. Add it to the table above. No other changes needed.

## Important Notes

- Genre files describe WHAT to look for, not HOW to find it (that's the command's job)
- Keywords are hints, not exhaustive — every codebase names things differently
- Games often blend genres — load multiple files and merge the action catalogs
- When in doubt about genre, start with the closest match and adjust
