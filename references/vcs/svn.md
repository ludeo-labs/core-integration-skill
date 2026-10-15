# VCS Contract — Subversion (SVN)

Implementation of the [VCS contract](README.md) for SVN. Loaded when `integration.json → vcs.type == "svn"`.

State recorded in `integration.json → vcs.svn` (the branch URL also goes in the top-level `branch` once it exists):

```json
"svn": {
  "url": "<working-copy URL, e.g. …/trunk or …/branches/ludeo-integration>",
  "repositoryRoot": "<server repository root>",
  "workingCopyRevision": 0,
  "branchPlan": "deferred | ^/branches/ludeo-integration"
}
```

## The delivery model — a permanent branch, never reintegrated

The Ludeo integration lives on its own long-lived branch and is **not merged back to trunk** by default — the branch
is the deliverable. Confirm this with the user at the start; it inverts the textbook reintegrate-and-delete flow, so
don't propose merging into trunk or deleting the branch after delivery.

- **trunk → branch sync merges: yes, periodically.** In the branch working copy, `svn merge ^/trunk`, resolve, commit.
  Small frequent syncs beat one large merge — the team keeps editing the same build files.
- **branch → trunk: never**, unless the user decides otherwise.

## `create_isolation(name)`

**Creating an SVN branch is a server-side commit** — `svn copy` writes to the shared repository immediately. So it is
**user-gated and deferrable**: until the user approves the branch, work in the existing working copy and commit
nothing (`vcs.commitPolicy = "no commits until branch"`).

When the user approves:

```bash
svn update
svn copy ^/trunk ^/branches/ludeo-integration -m "Branch for the Ludeo SDK integration"   # --parents if branches/ is missing
svn switch ^/branches/ludeo-integration
```

`svn switch` keeps uncommitted local modifications, so work done while the branch was deferred carries over. Follow
the team's branch layout if it differs (`svn ls ^/branches`).

While deferred, nothing is `svn add`-ed, but keep track of what the integration touches (`svn status` lists edits and
unversioned additions) so the first branch commit is complete.

## `acquire_component(dest)`

Same source and version rules as [`git.md`](git.md) (`../1-build-game-with-sdk.md` Step 2), copied into
`external/ludeo/LudeoCoreSDK_<version>/` and `svn add`-ed. SVN has no submodules; vendoring is the default. Mirror the
team's `svn:ignore` convention onto new directories (`svn propget svn:ignore <existing-dir>`) and never add the game's
build output. The first commit with the SDK binaries can be slow — expected, not stuck.

**Optional vendor branch** (when SDK upgrades are expected): drop each release at `^/vendor/ludeo-sdk/<version>` and
`svn copy` it into the branch, so an upgrade is a tracked copy instead of a delete-and-re-add.

## `ensure_editable(path)`

**No-op.** SVN working copies are writable. Exception: files with the `svn:needs-lock` property — if a write fails
read-only, check `svn proplist -v <file>` and `svn lock` it.

## `checkpoint(summary)`

Once the branch exists and the policy is per-phase: `svn add` the phase's new files, then
`svn commit -m "Ludeo integration — phase <N>: <summary>" <the phase's paths>`. Every commit is immediately visible on
the client's server — commit only on the branch, only the phase's paths.

## `open_review(summary)`

SVN has no native pull request. The review unit is the branch's revision range —
`svn log --stop-on-copy ^/branches/ludeo-integration` for the commits, `svn diff -r <start>:HEAD` for the content.
How the team reviews is team-specific: **ask the user** the first time and record the answer in `decisions`.

## `guard_destructive`

Never run an irreversible SVN command on a single failed check. There is no reflog or stash — unversioned work is
simply lost. Never run these speculatively:

`svn revert -R` · `svn cleanup --remove-unversioned` · `svn switch` (rewrites the working copy) · `svn rm` against a
server URL · `rm -rf`

`L` (locked) markers in `svn status` usually mean an operation is in progress or was interrupted — never run
`svn cleanup` while another process may still be working in the copy. This is the **client's server**: verify with
read-only commands (`svn info`, `svn status`, `svn ls`) before every server write.
