---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "1,3,7"
question: "Does the game require a store-platform client (Steam, another store, a console SDK) to reach gameplay, and will the cloud machine run it without that client or a signed-in user? Scope it as a layered removal, not a one-line fallback."
sanitized: true
origin: "unity:architecture/store-platform-removal-is-layered-not-a-single-fix"
---

# Running without the store platform is five fixes, not one — and each hides the next

**Precondition:** the game assumes a store-platform client is present (for networking, identity or UI), and the
machine it must run on — the Ludeo cloud machine in the source integration — has no client, no signed-in user and no
store overlay. Confirm this for your game's auth mode (`05 §5`) at intake; do not assume either way.

Scoping from the code looked reassuring: a platform-network interface with one implementation, selected on one line.
"Add a second implementation" seemed like the job. It was the first of **five**, each invisible until the previous
was fixed, each found only by running:

| # | What breaks | Symptom |
|---|---|---|
| 1 | Platform init fails → startup shows a connection-error page and returns | never reaches gameplay; the rest of startup never runs |
| 2 | The **network transport is store-platform-based** and refuses to start a server | hosting *half*-succeeds — it logs and returns, the server never listens, the game settles into a broken state |
| 3 | The connect handler reads the platform user id and throws | host never authenticates; a wall of unrelated-looking "null connection" errors follows |
| 4 | Scattered reads of the platform user id decide **which player is local** | wrong identity, or a throw, deep in gameplay |
| 5 | "Open URL" calls (store page, survey, community link) | a browser opens **on top of the streamed game**, and the viewer cannot dismiss it |

## The two non-obvious ones

**(4) is the trap.** The reads are scattered — spawn, skills, save data, UI — and they must all return the **same**
stand-in id, or the game disagrees with itself about who the local player is. Add one guarded accessor and point every
site at it:

```cpp
UserId LocalUserId() { return Platform::IsValid() ? Platform::UserId() : UserId{ kStableStandIn }; }
```

**(2) fails quietly.** A transport that logs and returns is worse than one that throws: hosting appears to succeed.
Check which transport the network layer uses early; a socket/UDP transport is often already in the project.

## Scope it at phase 1

Do not estimate from the interface. Grep the platform SDK's namespace and calls across **all** gameplay code, not just
networking, excluding validity checks; every hit outside the platform wrapper is a potential blocker. Also check the
transport, and grep for URL-opening and process-launch calls (`ShellExecute`, the engine's open-URL wrapper).

**Make it opt-in** (a launch argument the cloud `run.bat` passes), never an automatic fallback: silently switching a
real player from "install the store client" to "plays offline" is a product change that is not yours to make.

This is not phase-7 polish: it is a hard cloud blocker that is fully testable locally today — close the store client
and run the build.
