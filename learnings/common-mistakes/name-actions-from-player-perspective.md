---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: "6,8"
question: null
sanitized: true
origin: "unreal:common-mistakes/name-actions-from-player-perspective, unreal:common-mistakes/match-reference-action-names"
---

# Name actions from the player's perspective, and never embed variable data in the name

## The failures

The agent derived action names from code structure (class names, method names, tag paths):

- `ElimChain`, named after a scoring-processor class, should have been `DoubleKill` / `TripleKill`.
- `ElimStreak` should have been `KillStreak5` / `KillStreak10`.
- `Kill_Rifle` fused the action with its context. `Kill` is always `Kill`; the weapon is separate context.
- `ControlPointCapture_Team2` embedded a team id, which should have been `ControlPointCapture`.

It also **missed a whole category**: every player ability (dash, grenade, melee, reload, fire, aim). The discovery
audit had found all of their identifiers in the game's ability/tag tables, but the agent searched for event
broadcasts, which is the wrong mechanism for abilities, and never turned the audit's findings into action
candidates. The plan became a ceiling instead of a floor.

## Rules

1. **Name from the viewer's perspective.** Ask what a player would call the moment.
2. **No variable data in the name** (team id, weapon, player name, count). If you're building an action name with
   `snprintf` or string concatenation, stop. This also keeps names bindable: a Studio Lab trigger binds one exact
   string per environment (`06 §7.3`).
3. **Specific milestones get specific names.** `KillStreak5` and `KillStreak10` are different achievements.
4. **Context, if a goal needs it, travels separately.** `SendAction` carries only a player id and a name, so send
   the canonical action **and**, where a goal needs it, an additive action from a curated allowlist. Never replace
   the canonical name with a fused one (see the per-class token lesson).
5. **Every discovered ability/input category is a candidate action.** Hook it where the game dispatches ability
   activation centrally, not in per-ability effects.
6. **Present the exact strings for human approval** before implementing (`6a`). One question catches every naming
   problem.

Related: `learnings/common-mistakes/per-class-action-token-derive-from-runtime-type-name.md`,
`learnings/architecture/additive-action-emission-for-composable-goals.md`.
