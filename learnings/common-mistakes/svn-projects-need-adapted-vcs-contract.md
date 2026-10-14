---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: "1"
question: "Is the game project under Subversion rather than git? Check for a .svn directory at the project root and run `svn info` before assuming the git branch-and-commit workflow applies."
sanitized: true
origin: "unreal:common-mistakes/svn-projects-need-adapted-vcs-contract"
---

# SVN projects need an adapted version-control workflow — an SVN branch is a server commit

**Precondition:** the working copy is Subversion: a `.svn` directory at the root **and** `svn info <root>` succeeds
(it reports URL, repository root, revision).

## The situation

This skill assumes git: `phase 1` creates a local integration branch and each phase ends in a local commit. A
client project arrived as an SVN working copy of `^/trunk`, with the instruction "do not commit anything until we
branch."

## The mapping that worked

| Operation | SVN implementation |
|---|---|
| Detect | `.svn` + `svn info` (record URL, repository root, revision) |
| Make files editable | Nothing to do. Exception: `svn:needs-lock` files (`svn proplist` if a write fails). |
| Create the branch | **`svn copy ^/trunk ^/branches/<name>` is a server-side commit** — it writes to the shared repository immediately. Defer it until the human approves; work in the existing working copy and carry changes over with `svn switch` later. |
| Per-phase commit | Blocked until the branch exists; keep a list of what each phase touched. |
| Review | No native pull request — ask the team. |
| Destructive ops | Never run `svn revert -R`, `svn cleanup --remove-unversioned` or `svn switch` to fix one failed check — there is no reflog or stash. |

## Until the branch exists

Nothing is `svn add`-ed or committed. Track new unversioned directories and edits to tracked files anyway —
`svn status` shows both — so the first branch commit is complete. Record the VCS type, URL, revision and "no
commits until branch" in the state file's `decisions`, so a resumed session doesn't commit to trunk.

On SVN teams build outputs are often versioned too — see
`learnings/common-mistakes/tracked-binaries-exclude-rebuilt-artifacts-from-commits.md`.
