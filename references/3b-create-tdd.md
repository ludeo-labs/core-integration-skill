# Phase 3 · Task 2 — Create Technical Design Document

Produce a TDD (Technical Design Document) from the CODE_MAP and SDK integration points analysis. The TDD captures architecture assessment, integration strategy, and risk analysis before implementation planning begins.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 3 · task 2 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 3 · task 2** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## 📚 Context Files

**Action Required:** You must read the following files before starting. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/TDD_TEMPLATE.md` - The TDD template structure (use this as your output format)
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` - Critical rules that inform risk assessment
- `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` - SDK lifecycle concepts for the concept mapping
- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` - Object tracking and state capture patterns

## Prerequisites

> ⚠️ **REQUIRED:** Run these commands first:
> 1. `phase 2` → produces `ludeo-integration-plan/CODE_MAP.json`
> 2. `phase 3 · task 1` → produces `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json`
>
> This command reads those files. It does **NOT** analyze game code directly.

## Your Task

### 1. Read Input Files

- `ludeo-integration-plan/CODE_MAP.json` (from `phase 2`)
- `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` (from `phase 3 · task 1`)
- `ludeo-integration-docs/TDD_TEMPLATE.md` (output format)

### 2. Fill TDD Sections

Follow the template structure exactly. For each section:

#### Abstract
Write a brief overview of the integration approach based on CODE_MAP findings.

#### Game Overview
- **Studio:** Ask the user if not determinable from code
- **Engine:** From `CODE_MAP.codebase_summary`
- **Game Modes:** Infer from code (search for multiplayer, singleplayer, co-op patterns). Ask if unclear
- **Graphics API:** Ask the user if not determinable from code
- **3rd Parties:** From `CODE_MAP.build_system` dependencies

#### Integration Key Concepts
This is the strategic section. Based on the CODE_MAP analysis, define:
- How state will be captured (what mechanism: per-frame tick, event-driven, save system export, etc.)
- How reconstruction will work (load map from metadata, spawn entities, apply properties)
- Key architectural patterns that affect integration (ECS, component model, singletons, etc.)
- Any constraints from threading model or event system design

#### State Capture Solution
- Design the capture flow based on `CODE_MAP.event_systems` and `CODE_MAP.lifecycle_hooks`
- Create a mermaid sequence diagram showing the capture flow for this specific game
- **Object Lifecycle Management:** Based on `CODE_MAP.core_classes` — how will objects be detected, tracked, and marked as destroyed?
- **Non-Ludeoable Areas:** Identify from code the segments that should never become a Ludeo — shops/stalls, NPC dialogue, tutorials, safe zones, in-game menus. These are **not** a capture concern (tracking runs through them); they are marked by enter/exit **boundary actions** wired to global triggers on Ludeo's platform. Note the boundary hooks here so `phase 6` can emit the actions. See `06 §7.3`.
- **Actions Capture:** Based on `CODE_MAP.event_systems` — how will player actions be captured? Reference genre patterns if applicable

#### State Reconstruction Solution
- Design the reconstruction flow
- Create a mermaid sequence diagram for this game's reconstruction approach
- **Object Recreation Process:** How will objects be recreated from captured state? Note dependency resolution needs

#### Cloud Specifications
- **Game Mode:** Recommend based on game modes found
- **Settings, NPCs, Shaders, Game Start:** Flag as requiring human input — these are deployment decisions

#### Multiplayer Specifications
- If `CODE_MAP` shows multiplayer patterns, document the architecture
- If single-player only, mark as N/A
- Include client-server flow diagram if applicable

#### Risks & Open Questions
- **Technical Risks:** Evidence-based only — cite specific CODE_MAP findings. Check each Critical Requirement (CR-001 through CR-009) against the integration points and flag risks
- **Open Questions:** List unresolved items that need human input before implementation
- **Dependencies:** SDK features needed, infrastructure requirements
- **Functional Requirements:** SDK capabilities needed for this specific game's patterns

### 3. Flag Human-Required Sections

Mark any section you couldn't fill from code analysis with:
```
> ⚠️ **REQUIRES HUMAN INPUT:** [what's needed and why]
```

## Output

Save: `ludeo-integration-plan/TDD_<GameName>.md`

Use the game name from `CODE_MAP.codebase_summary`. Replace spaces with underscores.

## Important Notes

- Do NOT analyze the game codebase directly — use only CODE_MAP and SDK_INTEGRATION_POINTS
- Do NOT guess or fabricate information. If something can't be determined from the inputs, flag it for human input
- Replace the template's example diagrams with game-specific diagrams
- Remove HTML comments from the output — they are template instructions, not content
- Technical risks must cite evidence. Do NOT list speculative risks without concrete code findings

## Related Phases

- `phase 2` - Creates structural code map (run FIRST)
- `phase 3 · task 1` - Finds integration points (run SECOND)
- `phase 3 · task 6` - Classifies the save system; the **State Reconstruction** section here is provisional until that classification exists
- `phase 3 · task 3` - Creates implementation plan from TDD (run NEXT)

## Next Step

After creating the TDD, run `phase 3 · task 3` to create the detailed implementation plan. The detailed save-system classification (group + per-entity reconciliation/manual matrix) is produced by `phase 3 · task 6` and is required before `phase 4`; if the TDD's reconstruction notes rest on save-system assumptions, confirm them in `phase 3 · task 6`.
