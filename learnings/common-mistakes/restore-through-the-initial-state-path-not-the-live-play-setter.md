---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Do restored entities (doors, windows, containers, destructibles) change state through a live-play function that also fires one-shot effects: sounds, AI alerts, event broadcasts, or impulse-driven debris?"
sanitized: true
origin: "unreal:common-mistakes/engine-restore-helper-fires-bp-suppresses-one-shots"
---

# Restore stateful props through their initial-state path, not the live-play setter

**Applies when** a stateful prop changes state through one live-play function (`SetState`, `Activate`, `Break`)
that does two jobs: it **updates internal state** and it **fires one-shot effects** (open/breach sounds, AI noise,
event broadcasts to listeners, debris driven by the hit's impulse and instigator).

Calling that function during the restore goes wrong in two opposite ways at once:

- **One-shots fire when they shouldn't.** A breach sound plays a minute after the breach, AI gets alerted after
  the fact, and listeners re-react to a beat the match has already passed.
- **Impulse-driven visuals fail when they should fire.** With no live hit there's no impulse, so the internal
  flag flips and the mesh just sits there: "internally broken, visually intact", and often impossible to break
  again because its damage listeners were unbound.

Writing the state field directly fails the other way: no cascade at all, so state says "breached" while the mesh
shows "closed" (see `learnings/common-mistakes/direct-field-assignment-bypasses-setter-side-effects.md`).

## Shape A: use the game's initial-state path

Many games already separate "state set at spawn/load" from "state changed during play". It might be an
`isInitialStateChange` flag on the internal handler, or the save-load or network-receive path. Route the restore
through it. Mesh swap, collision, navigation links and audio occlusion update. Sounds, alerts and broadcasts stay
quiet.

```cpp
void Door::RestoreState(DoorState s) {        // added for the integration (game-code change; record it)
    const DoorState old = m_state;
    m_state = s;
    OnStateChangedInternal(old, /*isInitial=*/true, /*locallyInstigated=*/false);
}
```

Don't early-return on `m_state == s` if another writer might have set the field first. That shortcut skips the
cascade (`learnings/common-mistakes/dont-anchor-on-prior-agent-restore-helpers.md`).

## Shape B: match the end state when the visual needs the live hit

If the destruction visual only works because of the hit's impulse in that frame, it can't be replayed. Restore
the **end state** live play reaches a few seconds later, usually "gone": remove or hide the prop, disable its
collision, and skip the activation and debris path.

## Choosing

Read the prop's state-change function. If an initial-state flag already suppresses the one-shots, use shape A. If
the cascade fundamentally needs the hit context, use shape B. Record the per-type choice in
`RESTORATION_PLAN.md`, and test a captured moment with both states present (intact and broken) on two back-to-back
replays.

Related: `learnings/common-mistakes/choose-the-restore-write-path-per-field.md` (the per-field decision rule this
lesson is one row of).
