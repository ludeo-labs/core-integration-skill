# Phase 6 — Actions (orchestrated)

> **This is the phase-6 entry point.** Two single-task briefs and the platform step that makes their output count.
> Run it per [`orchestration.md`](orchestration.md): one task at a time, state passed by file, every gate run by you.
> Phase 6 may start once phase 5's **wave 1** is green — it doesn't wait for every wave.

## 1. Goal / Purpose

Send the game's significant moments to Ludeo as actions — firing in **both** the Creator and the Player flow, so a
Ludeo's goals and constraints can be scored on replay — plus the standard trigger actions for pauses and
non-ludeoable areas, and get the matching Global Triggers and goals created in Studio Lab. **Deliverable:** every
approved action shows in the log in both flows, and the environment has the triggers and goals built on them.

## 2. Inputs (Input Contract)

- [ ] Phase 5 wave 1 green — a captured Ludeo restores (`5-tracking-restore-orchestrator.md`). An action can only be
      verified once the moment it fires in can be replayed.
- [ ] `ludeo-integration-plan/CODE_MAP.json`, `SDK_INTEGRATION_POINTS.json`; the intake's `profile` (genres, key
      actions, the Ludeo concept).

## 3. Steps

| # | Task | Brief | Reads | Produces | Gate (yours) |
|---|------|-------|-------|----------|--------------|
| 1 | Map the actions | [`6a-map-game-actions.md`](6a-map-game-actions.md) | `CODE_MAP.json`, genre files, intake | `GAME_ACTIONS_MAP.md` (gameplay + standard trigger actions) | **user approves the map** — naming, keep/drop, scope |
| 2 | Implement the actions | [`6b-implement-game-actions.md`](6b-implement-game-actions.md) | the approved map | `SendAction` calls, the span helper | **agent builds**; **integrator runs both flows** — capture a session, then replay a Ludeo — pausing once and entering a non-ludeoable area once; each action is in the log in **both** (`6b`'s exit gate) |
| — | Triggers and goals | `6b` Step 6 | the run above | Global Triggers + goals on the target environment | created with the Studio MCP and reported line by line, or handed to the user; never on Production |

The map is a judgment call, so it stops for approval before any code. The triggers and goals come **after** the run
gate, because Studio Lab only lists an action once a build has sent it.

## 4. Questions to ask the human

Relay what the workers surface. Expected ones: a candidate that may be state rather than an action; a player-scoped
site that can fire for non-player actors; a non-ludeoable area without a clear exit; approval of the map.

## 5. Patterns to apply

- **Actions fire in both flows** — never gate `SendAction` on "is this a replay" (`06 §7`).
- **Standard names for the trigger actions** — one pair each; a trigger event binds to one action per environment
  (`06 §7.3`).
- **The span flags match what was sent** (`6b` Step 5).

## 6. Output Contract

`GAME_ACTIONS_MAP.md` (approved), the `SendAction` calls, the Global Triggers and goals (or the user's confirmation
that they exist) — and steps `6a`, `6b` `completed` in the state file.

## 7. ✅ Success Criteria

- [ ] Every approved action is in the log in both the Creator and the Player flow.
- [ ] `PauseLudeo`/`ResumeLudeo` and `StartNoneLudeable`/`StopNoneLudeable` fire once per transition.
- [ ] Both Global Triggers exist on the target environment, and goals are built on the key actions.

## 8. Common Mistakes

- **Implementing before the map is approved.**
- **Testing only the Creator flow** — the Player flow is what scores the Ludeo.
- **Creating triggers before a run has sent the actions** — Studio Lab can't list them yet.

## Related / Next

- **Next:** entered from phase 8 (`current` is `8`) → back to `8-polish.md` Step 3. Otherwise: if phase 5 has waves left (`integration.json → wave.plan` entries neither `green` nor `deferred`), go back to
  `5-tracking-restore-orchestrator.md` for the next wave — new actions those waves expose come back through `6a`.
  Only when every wave is green or deferred: phase 7 (`7-upload-build.md`).
