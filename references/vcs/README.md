# VCS Contract

The skill supports three version-control systems: **git**, **Subversion (SVN)** and **Perforce (p4)**. Every
VCS-specific operation sits behind the small contract below, so the phase files stay VCS-agnostic: phase 1 detects the
VCS once, and every later step calls operations **by name** and takes the commands from the matching file.

- [`git.md`](git.md) — git (branch per integration, pull request for review).
- [`svn.md`](svn.md) — Subversion (a permanent integration branch; creating it is a server-side commit).
- [`p4.md`](p4.md) — Perforce (stream or pending changelist; files are read-only until opened — MCP first, CLI
  fallback).

## How this is used

1. **Phase 1 Step 0a** runs `detect_vcs` (below), records `integration.json → vcs` and loads the matching file.
2. **Every later session** reads `vcs.type` from the state file and loads the matching file **before any file write**
   (`SKILL.md` → **Start here**).
3. Phase logic never hardcodes `git`, `svn` or `p4` — it names an operation and the loaded file supplies the commands.

## The operations

| Operation | When | Intent |
|-----------|------|--------|
| `detect_vcs` | phase 1 Step 0a, first | Decide git / svn / p4 and record it |
| `create_isolation(name)` | phase 1 Step 0a | An isolated place for the work (branch / stream / changelist) |
| `acquire_component(dest)` | phase 1 Step 2 | Get the Ludeo SDK into the project and under version control correctly |
| `ensure_editable(path)` | **before every write** | Guarantee the file can be written and is tracked |
| `checkpoint(summary)` | end of each phase, after its gate | Record the phase's work (commit / changelist update) per the team's policy |
| `open_review(summary)` | when the user asks | Put the work up for human review |
| `guard_destructive` | always | Never run an irreversible VCS command on a single failed check |

**Checkpoint policy.** Ask once, in phase 1, how the team wants the work recorded — a commit (or changelist update)
per phase, or nothing until review — and record it in `vcs.commitPolicy`. Stage only the files the phase touched; never
sweep in unrelated local changes. Say in the message what was verified and what wasn't.

## `detect_vcs` (runs before any of the files loads)

Decide by **where the game's code lives** — use the project's primary build file or any source file as the probe
(`CMakeLists.txt`, the `.sln`, the `Makefile`, a `.cpp` under the source root):

1. **git first.** The project is inside a git work tree **and** git tracks the probe file:
   ```bash
   git -C "<project>" rev-parse --is-inside-work-tree
   git -C "<project>" ls-files --error-unmatch "<probe>"
   ```
   Both succeed → `vcs.type = "git"`.
2. **else svn.** A `.svn` directory at the working-copy root **and** `svn info "<project>"` succeeds (it reports the
   URL, repository root and revision) → `vcs.type = "svn"`.
3. **else p4.** `p4 info` succeeds, its `Client root` is an ancestor of the project, **and** the probe maps into the
   depot (`p4 where "<probe>"` resolves) → `vcs.type = "p4"`.
4. **Several or none → ask the user.** Don't guess. With **no VCS at all**, say so: the integration still works, but
   nothing can be isolated or rolled back — suggest the user snapshot the project first, record `vcs.type = "none"`,
   and treat every operation as a no-op except `guard_destructive`.

**Scope:** one VCS, keyed off where the **code** lives. A project whose code is in git and whose large content is in
p4 (or another store) is treated as **git**.

## Always-in-force rule (Perforce)

A p4 workspace is **read-only by default**, so the agent's file-write tools fail on any tracked file until it is opened
for edit. When `vcs.type == "p4"`, run `ensure_editable` before **every** write to a workspace file — game code, build
files, `ludeo.ini`, the plan files and the state file — for the whole integration. `SKILL.md` carries a short
always-loaded reminder; [`p4.md`](p4.md) has the mechanics.
