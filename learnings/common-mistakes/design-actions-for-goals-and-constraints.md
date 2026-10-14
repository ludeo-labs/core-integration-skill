---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "6,8"
question: "Does the game have objective events that can go either for or against the player (captures, scores, destroyed structures, held points)?"
sanitized: true
origin: "unreal:common-mistakes/design-actions-for-goals-and-constraints"
---

# Design objective actions for goals and constraints, and track objective state too

**Applies when** objective events can be good or bad for the player: a point captured by either team, a score
for either side, a structure destroyed on either side.

## The failure

The agent created `ControlPointCapture` as one flat action, then `ControlPointCapture_Team2`, which embeds
variable data. Neither supports goals and constraints. A goal like "capture 2 points" needs to know the capture
was **the player's side**. A constraint like "don't lose 2 points" needs **the enemy's** captures. The platform
has to know the direction relative to the player.

The agent also decided control points needed only actions, no tracked state. But the replay must reconstruct
**which point is held by which side**. That's ongoing state, not a one-time event.

## The rules

1. **Objective actions carry player-relative direction:** `CaptureTeam` / `CaptureEnemy`, `ScoreTeam` /
   `ScoreEnemy`, `DestroyTeam` / `DestroyEnemy`. Compare the event's team to the local player's team when you
   emit. Use distinct action **names**, never a team id embedded in the name.
2. **Objective state needs tracked objects.** If an objective has ownership or progress that changes during the
   match, track it (for example a control point with owner team, capture progress and a stable id) and restore
   it. Actions mark the moment of change. Tracked state is what the replay rebuilds.
3. **Ask how the action will be used** before naming it: "could this be a goal? could it be a constraint?" If the
   answer depends on direction or side, the name must encode it.

## How to apply

In `phase 6 · task 1`, add a goal/constraint pass to every objective action in `GAME_ACTIONS_MAP.md`:
direction-sensitive → split into player-relative variants; has ongoing state → make sure it is in
`OBJECT_TRACKING.md` as well. When goals are built in Studio Lab (`phase 6 · task 2` Step 6, or phase 8 expansion),
confirm both variants exist and fire.
