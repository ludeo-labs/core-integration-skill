---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: "1"
question: "Does the game team commit build outputs (DLLs, libs, PDBs, generated code) to version control? Check the VCS status after your first full build — if previously-tracked binaries or generated files show as modified, integration commits must exclude them."
sanitized: true
origin: "unreal:common-mistakes/tracked-binaries-exclude-rebuilt-artifacts-from-commits"
---

# On a tracked-binaries project, keep rebuilt artifacts of unrelated code out of integration commits

**Precondition:** the team versions its build outputs (common on SVN and Perforce teams, so artists and designers
never compile). Detect it after your first full build: the VCS status lists tracked DLLs, PDBs, static libs or
code-generator output as **modified**, not as untracked.

## The mistake

Building the game to integrate the SDK brought the **whole** solution up to date: every module relinked, and the
project's code generators re-ran. Relinked binaries always differ (embedded timestamps, build GUIDs), and the
generated files differed from what was committed (the last committer had a slightly different toolchain). Dozens
of rebuilt artifacts of **unrelated** modules showed as modified and went into the integration's first commit "to
keep the branch self-consistent".

The client reviewed the history and asked at once: *"what are these files doing in the integration branch?"* The
commit looked as if the integration had touched a platform plugin it had nothing to do with.

## Why it's wrong

1. **Diff noise destroys reviewability** — the integration's real changes drown in binary churn.
2. **Permanent merge pain** — on a long-lived branch every trunk→branch sync hits binary conflicts on any artifact
   trunk also rebuilt; binaries can't be merged, each is a manual resolve.
3. **Not needed** — the trunk-built binaries of untouched modules stay valid for the branch.

## The rule

Integration commits contain only integration-owned files: `ludeo-integration-plan/`, the SDK directory, the
integration sources (`LudeoManager`, `LudeoStateAdapter`, …), build-file edits, deliberate game-source changes —
and, if team convention versions binaries, the artifacts of the modules the integration actually changed. Before
**every** commit, group pending changes by top-level directory and revert rebuilt artifacts of anything the
integration does not own. Say in the commit message which artifacts were deliberately left out.

## Cleanup if already committed

- **SVN:** `svn update` first (merging into a just-committed working copy fails with *E195020: mixed-revision
  working copy*), then reverse-merge the bad revision per unrelated subtree:
  `svn merge -c -<rev> ^/branches/<branch>/<subtree> <wc>/<subtree>`, then commit.
- **Perforce:** `p4 revert` the unrelated files before submit, or `p4 copy` the depot revision back.
- **git:** restore those paths from the base branch (`git restore --source=<base> -- <paths>`) and commit.
