---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "3,5,6"
question: null
sanitized: true
origin: "unreal:common-mistakes/no-writable-objects-in-player-flow, unreal:common-mistakes/player-flow-needs-entity-discovery-for-actions, unreal:common-mistakes/player-flow-spawn-handler-must-track-ai, unreal:common-mistakes/action-listeners-must-register-in-player-flow, unreal:common-mistakes/action-polling-separate-from-state-writing, unreal:common-mistakes/actions-must-fire-in-player-flow-too, unreal:common-mistakes/audit-all-isplayerflow-guards, unreal:common-mistakes/track-entities-in-player-flow-for-kill-detection"
---

# In Player Flow, gate state writes — and only state writes; actions must still fire

During Player Flow the SDK scores the run from actions: a Ludeo with the goal "kill 10 enemies" needs `Kill` to fire
during the replay (`06 §7`). State **writing** is Creator-Flow only; action **detection and sending** runs in both
flows. Almost everyone writes that rule correctly in a comment and then breaks it in the structure — it has repeated
across several integrations, in two opposite directions with one root cause: treating "is this a Player-Flow replay?"
as a switch for **everything** the integration does per entity.

## Bug 1: state written during a replay

`TryBeginGameplaySession()` called the "create tracked objects" step unconditionally, so a Player-Flow replay
created objects and wrote state. The replay is **read-only for state** for its whole duration (`07 §2.3`): no
`ludeo_DataWriter_CreateObject`, no `ludeo_DataWriter_Set*`, no per-tick capture. Gate those on a
**session-scoped** "this session's `OpenRoom` carried a `ludeoId`" flag. Don't use `IsRestoring()`, which goes
false at the end of the settle, mid-replay.

## Bug 2: the replay guard cascades and kills the actions

1. A function that creates tracked objects starts with `if (m_is_player_flow_replay) return;` — correct so far.
2. The same function, or something downstream of it, also registers the action plumbing: per-entity damage
   listeners, the spawn handler that discovers new enemies, the entity list the kill poll walks.
3. The guard cascades: no tracked objects, so no entity list, so no listeners, so no actions in Player Flow.
4. Actions are tested only in Creator Flow and the phase is declared done.

Seen in the field: the kill detector polled the tracked-entity list, filled only by capture registration, so the log
said "monitoring 0 AI entities" and `Kill` never fired; the entity-spawned handler began with
`if (player_flow) return;`, so enemies spawned after Play were invisible — the player killed 12 and 2 were
reported (only the pre-placed ones, found by a level scan, were tracked). The same shape appears in the tick when a
poll-based detector is called from inside the guarded state writer:

```cpp
// WRONG
void UpdateTrackedObjects() {
    if (m_is_player_flow_replay) return;   // blocks everything below
    WriteState();
    DetectPollBasedActions();               // never runs during a replay
}

// RIGHT: two concerns, two gates
void Tick() {
    if (!m_is_player_flow_replay) WriteState();   // Creator Flow only
    DetectPollBasedActions();                      // both flows
}
```

## The fix: the registry is filled in both flows — only its source differs

```cpp
void Integration::OnEntitySpawned(Entity& e) {
    if (!IsTrackable(e)) return;
    if (IsPlayerFlowReplay()) TrackForActions(e);   // registry entry only: health/alive polling, no SDK object
    else                      RegisterEntity(e);    // CreateObject + initial writes + registry entry
}
// In Player Flow, also add every entity Pass 1 spawns or matches, and scan the live world (restored +
// level-placed) into the same registry. Bind listeners on entities the restore creates too.
```

Seed the detector's alive/dead baselines at `Begin`, after the apply, so restored corpses enter already dead and
don't fire `Kill`. Where the game has its own death event, hooking it (`phase 6 · task 1`) avoids the registry
dependency altogether.

## The rule

Gate **only** these on the session-scoped replay flag: `ludeo_DataWriter_CreateObject`, `Set*`, per-tick capture,
batch registration. **Everything else runs in both flows**: every `SendAction` site, entity discovery and spawn
handlers, damage/death listeners (including the restored player's), and poll-based detectors.

## Audit and verify

- At the end of every code-producing phase, grep every use of the replay flag (and of `IsRestoring()`) and check
  each one. Any guard **above** a `SendAction`, an entity registration or a listener binding is a bug.
- Run a Player-Flow replay and grep its log for `SendAction`. If only spawn-driven actions appear and none of the
  damage-driven ones (`Kill`, `Death`, `Hit`), the damage listeners weren't bound. If nothing appears, the spawn
  handler wasn't registered either.

Related: `learnings/architecture/gate-playback-behavior-on-the-session-flow-flag.md`.
