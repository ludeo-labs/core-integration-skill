---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "3"
question: null
sanitized: true
origin: "unreal:common-mistakes/missing-api-key-in-activate, unreal:common-mistakes/missing-game-version-in-activate, unreal:common-mistakes/missing-explicit-auth, unreal:common-mistakes/never-skip-auth-handling, unreal:common-mistakes/auth-is-never-optional"
---

# `ludeo_Session_Activate` needs every required field, and the auth block is never optional

Five recorded activation failures, across three games, all came from the same habit: writing the activation call by reasoning about which
fields "this game needs", instead of filling in every one the reference lists.

| Left out | What the SDK logged |
|---|---|
| `apiKey` unset (a TODO in the skeleton) | `parameter 'params.apiKey' is null` |
| `gameVersion` empty | `params.gameVersion can't be nulled or an empty string` |
| No explicit auth, and Steam not initialized before activation (a sample project, a dev run without the client) | `SteamClient() failed. SteamAPI_Init() possibly not called yet?` |
| Auth block deleted because "this isn't a Steam game" | `InvalidAuth` at runtime, with credentials correctly supplied |
| `apiKey` still unset in a game "not on Steam" | `InvalidParameters (null apiKey)` — which the agent called "expected, no API key yet" and closed the phase |

## Auth is never optional — the question is implicit vs explicit

Every Ludeo session authenticates, in one of two modes (`05 §5`):

- **Implicit:** the running Steam client's signed-in user. The SDK does not initialize Steam — the game must have
  Steamworks initialized before `ludeo_Session_Activate` (`05 §5`).
- **Explicit:** a Steam user id from `ludeo.ini`, for runs where Steam isn't initialized.

"The game doesn't use Steam" is a reason to run **explicit** auth during development, not to skip auth. If the title
can't authenticate implicitly at all, raise it early with the Ludeo integrations team.

## Rules

- **Ask the `3d` auth questions first** (`3d` §1.1, Question 1), on every integration.
- **Fill every required field:** `apiKey`, `gameVersion`, the window handle (CR-004), and the auth details. Read
  them from `ludeo.ini` as `3d` §1.1 lays out, not from constants and not "later".
- **Implement both auth modes**, explicit and implicit, as an if/else driven by `ludeo.ini`'s `authMode` (`3d`
  §1.1). Both stay in the code for good; the user's choice only sets the default `authMode` in the shipped
  `ludeo.ini`. No Steam id literal in the code — it lives in `ludeo.ini`.
- **At upload, set `authMode` and the Steam fields to how the cloud will actually authenticate** — confirm the mode
  with the user (`phase 7` Step 2). That is a config value, not a code change.
- **Copy the reference block; don't reason about whether to include it.** It was distilled from several
  integrations and covers the cases you haven't met yet.
- **Never wave off an activation failure.** An `InvalidParameters` or `InvalidAuth` is never "expected": a required
  field is missing or rejected — the API key, game version, auth details or platform URL. Log the resolved
  parameters and find out which
  (`learnings/common-mistakes/do-not-hardcode-platformurl-and-log-activation-params.md`). The path is broken until
  a run with real credentials proves otherwise.

**After writing the activation code,** diff it field by field against the reference, then run it. Phase 3 doesn't
close until the run log shows the activation callback reporting success.
