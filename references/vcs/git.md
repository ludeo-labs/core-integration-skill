# VCS Contract — git

Implementation of the [VCS contract](README.md) for git. Loaded when `integration.json → vcs.type == "git"`.

State recorded in `integration.json → vcs.git` (the branch also goes in the top-level `branch`):

```json
"git": { "remote": "origin", "branch": "feature/ludeosdk-integration-#1" }
```

## `create_isolation(name)`

All integration work goes on a dedicated branch. **Tell the user you are about to create a branch for the
integration**, propose the name and let them confirm:

```bash
git -C "<project>" checkout -b feature/ludeosdk-integration-#1
```

- If that name exists, increment the number (`#2`, `#3`, …). If the repo has a branch-naming convention, follow it.
- The branch lets the user discard the attempt by deleting it. All later steps happen on it.

## `acquire_component(dest)`

The SDK comes from the release repository (`../1-build-game-with-sdk.md` Step 2 has the source and the version rules)
and lives under the project at `external/ludeo/LudeoCoreSDK_<version>/` (`04 §3`). Clone or download it **outside**
the project, then copy the release in, so the game repo never nests another repo by accident. Ask the user which of
these they want:

- **Vendor it (default):** copy the release into `external/ludeo/…` and commit it with the integration. Check the DLL /
  `.so` / `.lib` files are real binaries (> 1 MB), not LFS pointer files; if the game repo uses Git LFS for binaries,
  make sure the patterns cover them (`git lfs track` per the repo's `.gitattributes` convention).
- **Submodule:** `git -C "<project>" submodule add <sdk-repo-url> external/ludeo/LudeoCoreSDK` and pin it to the release
  tag. Only when the team already uses submodules — the integrators and the build machines must then
  `submodule update --init`, and LFS must be installed for the binaries.
- **Already present:** confirm the path and version.

Record `sdk.source`, `sdk.version` and `sdk.path`. The SDK's `Bin/`, `Lib/` and `ThirdParty/` are build inputs — commit
them; never commit the game's build output (`bin/`, `build/`, `out/`, …) — see
`learnings/common-mistakes/tracked-binaries-exclude-rebuilt-artifacts-from-commits.md` if the team versions binaries.

## `ensure_editable(path)`

**No-op.** git working-tree files are writable; new files are picked up by `git add` at `checkpoint`.

## `checkpoint(summary)`

When `vcs.commitPolicy` is per-phase: after the phase's gate passes, stage **only the files the phase touched** and
commit on the integration branch:

```bash
git -C "<project>" add <the phase's files>
git -C "<project>" commit -m "Ludeo integration — phase <N>: <summary>"
```

Never `git add -A` / `git add .` — the working tree may hold the user's unrelated changes. Never push unless the user
asks.

## `open_review(summary)`

Only when the user asks, after the build gate passes: push the branch and open a pull/merge request on the team's host
(`gh pr create`, `glab mr create`, or the host's web UI). Iterate on review feedback; capture corrections as learnings.

## `guard_destructive`

Never run an irreversible git command on a single failed check — confirm state with at least two independent checks
(absolute paths) first. Never run these speculatively:

`git reset --hard` · `git checkout -- <path>` · `git restore` over uncommitted work · `git clean -fd` ·
`git submodule deinit` · `git rm --cached` · `git push --force` · `rm -rf`
