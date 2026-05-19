# Ludeo SDK Integration Skill

An open Agent Skill that walks an AI coding agent through integrating the [Ludeo](https://ludeo.com) SDK into a C++, Unity, or Unreal game — from build setup all the way through action mapping and runtime verification.

Works with **Claude Code, Cursor, GitHub Copilot, Codex, Windsurf, Cline, Continue, Gemini CLI**, and 45+ other agents that support the open agent-skills spec.

## Install

In your game's repo, run:

```bash
npx skills add ludeo-labs/core-integration-skill
```

The CLI auto-detects which AI coding agents you have installed and asks where to put the skill. To target specific agents non-interactively:

```bash
npx skills add ludeo-labs/core-integration-skill -a claude-code -a cursor -y
```

To install globally (available to every project on your machine):

```bash
npx skills add ludeo-labs/core-integration-skill -g -y
```

The `skills` CLI is documented at <https://github.com/vercel-labs/skills>.

## Run

Open your game repo in your AI agent and ask it:

> Integrate Ludeo into my game using the `ludeo-integration` skill.

The agent reads `SKILL.md`, picks up the 8-phase workflow, and walks you through each phase. It pauses for confirmation between phases.

You can also jump to a specific phase:

> Continue with phase 5 of the `ludeo-integration` skill.

## What's inside

| Path | Purpose |
| --- | --- |
| `SKILL.md` | Skill orchestrator with YAML frontmatter and the phase-flow narrative |
| `references/` | Phase workflow docs + reference material loaded on demand |
| `learnings/` | Append-only corrections captured from real integrations |
| `tools/` | Runtime helpers the skill invokes |
| `scripts/` | `validate-skill.mjs`, `bump-skill-version.mjs` (used by CI / release pipeline) |
| `.github/` | Validation + release workflows |

Sequential 8-phase workflow under [`references/`](references):

| Phase | File | Purpose |
| --- | --- | --- |
| 0 | `references/0-build-game-with-sdk.md` | Build environment, conditional compilation, baseline + SDK builds |
| 1 | `references/1-map-game-code.md` | Produce `CODE_MAP.json` of the game's architecture |
| 2 | `references/2-find-sdk-integration-points.md` | Identify where SDK calls go |
| 3 | `references/3-implement-sdk-lifecycle.md` | Plan lifecycle wiring |
| 4 | `references/4-implement-phase0-plan.md` | Implement lifecycle wiring |
| 5 | `references/5-compile-and-fix.md` | Compile, fix, verify |
| 6 | `references/6-map-game-actions.md` | Find action points in game code |
| 7 | `references/7-implement-game-actions.md` | Insert action calls |

Reference material lives alongside the workflow files:

- `references/ludeo-integration-docs/` — primary integration guides (build, lifecycle, tracking, API reference, research templates, genre playbooks).
- `references/utilities/` — supporting docs (master integration plan, PM guide, prompt prototype).

## Supported agents

Tested with: Claude Code, Cursor, GitHub Copilot, Codex, Windsurf, Cline, Continue, Gemini CLI, OpenCode, Roo Code, Kilo Code, Augment, Goose, Aider.

The full list of 50+ supported agents is in the [`vercel-labs/skills` README](https://github.com/vercel-labs/skills#supported-agents).

## Versioning

Stable versions are tagged on GitHub (`v0.1.0`, `v0.2.0`, …). Pin a specific version to keep your team on a known-good release:

```bash
npx skills add ludeo-labs/core-integration-skill#v0.1.0
```

## Updating

```bash
npx skills update ludeo-integration
```

## Uninstalling

```bash
npx skills remove ludeo-integration
```

## Contributing

PRs welcome. CI runs on every PR:

- `node scripts/validate-skill.mjs` — checks `SKILL.md` frontmatter and that every relative path referenced in workflow files resolves on disk.
- `npx skills add ./ --list` — verifies the skill is discoverable.
- A smoke install into a temp directory verifies end-to-end install works.

To release a new version, push a tag matching `v*` (e.g. `git tag v0.2.0 && git push origin v0.2.0`). The release workflow auto-generates notes and publishes the GitHub Release.
