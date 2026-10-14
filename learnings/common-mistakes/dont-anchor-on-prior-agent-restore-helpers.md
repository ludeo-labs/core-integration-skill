---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Are you picking up an integration that earlier agents already extended with custom per-class restore helpers or capture code?"
sanitized: true
origin: "unreal:common-mistakes/dont-defer-to-prior-agent-decisions"
---

# Prior agents' integration code is a data point, not an authority

**Applies when** you inherit an integration that earlier agents already extended: per-class `Ludeo_Restore*`
helpers added to game classes, integration-only `#if` blocks scattered through game code, a growing list of
per-type capture/restore branches.

The reflex is to treat that code as authoritative ("whoever wrote this knew what they were doing"). It was written
by an agent with limited context, a narrow test scope and its own assumptions.

## Incident

Earlier work had added per-class restore helpers to several stateful props (gates, containers, destructible
cosmetics). Each started with `if (m_state == newState) return;`. That made sense while the helper was the
**only** writer. A later change began writing the same state field directly **before** the helper ran, so the
early exit fired and the helper's visual cascade never ran: the state value was right, and the visuals stayed at
level defaults.

The first reaction was to extend the per-class pattern with more per-class handlers. Four sessions of per-class
fixes went by before the real answer appeared: the game **already has** a mechanism for "this state arrived from
elsewhere". It's the path its own engineers use when state comes from the network or a save load, and it runs
the right cascade. Switching to it took half a session and fixed two classes immediately.

## Signs a prior design is suspect

- Custom per-class restore helpers that parallel a mechanism the game already has (network-receive handlers,
  save-load apply, an initial-state path).
- A per-class list that keeps growing.
- Helpers that only work if they are the **sole writer** (`if (current == target) return;`).
- Comments rationalizing why the helper differs from what the game normally does.

## Signs it is sound

It calls the game's own setters and load/receive paths, has a small bounded scope, and its comments explain
product decisions (which side effects to suppress, and why).

## How to apply

1. **Diff against the pristine game source** if the team can provide it. Separate what the integration added from
   what the game natively does.
2. **Look for the game's own "state arrived" path first** (save-load apply, network receive, the initial-state
   flag on a state-change function), and use it.
3. **Don't copy a prior per-class helper onto new classes** just because it exists.
4. **Be honest about the evidence:** "it shipped" means "it was tested in some scope", not "the design is right".

Related: `learnings/common-mistakes/restore-through-the-initial-state-path-not-the-live-play-setter.md`.
