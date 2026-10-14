---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "5,6"
question: "Before mapping a Kill (or any 'entity destroyed') action in phase 6: does the phase-5 restore put recorded-dead entities back through the game's own death function? If that path raises the event the action hangs off — immediately or at the end of a death animation — corpses can score kills and drive kill counters, loot and win checks the player never earned."
sanitized: true
origin: "unity:common-mistakes/check-the-restore-cannot-fire-your-kill-action"
---

# Check that your restore cannot fire your own kill action

**Precondition:** phase 6 maps `Kill` onto the game's death path, and phase 5 places recorded-dead entities.

A moment captured mid-fight often opens with corpses on the floor. If the restore places them by calling the game's
ordinary "die" function, that path's side effects all run for every corpse — and nothing in either phase's brief makes
you check.

Under the core order the apply and settle run before `OpenRoom` (CR-010), so a `SendAction` raised **synchronously**
by the death path is dropped by `SendAction`'s no-session guard (`06 §7.1`) — and should be; log it so you can see it.
That does not make the path safe:

- **Deferred raises land after Play.** A death function that emits at the end of a death animation, a dissolve or a
  timer fires once the replay resumes — one `Kill` per corpse, after `Begin`. The moment's goal ("kill twelve") is
  partly satisfied before the player presses anything, and nothing errors.
- **The game's own side effects run regardless** — kill counters, achievements, loot drops, wave bookkeeping
  (`07 §11.2`).

In one integration this was safe only by luck: the restore used a separate "artificial death" primitive (dead flag,
death pose, colliders off, physics frozen — raises nothing), chosen in phase 5 for an unrelated reason. **Verify it
rather than inheriting the luck:** trace the restore's death call and confirm whether it reaches, directly or
deferred, the event your action is mapped to. If it does, use one of:

- a restore-side death primitive that raises nothing (preferred — it also keeps counters, achievements and loot out of
  the boot), or
- a "placing recorded dead, not killing" flag the emit and the side effects check.

## The symmetric check, in the same twenty lines

Establish where the kill event sits, because it decides whether the action needs a player guard:

- **On the victim's own death path** — every death reaches it (hazards, damage-over-time, kill planes). Don't add a
  player guard: a goal counting only player kills becomes unreachable when the environment finishes an enemy.
- **On a damage-attribution path** — only player-dealt deaths reach it, and environment kills can starve the goal.

The answers pull in opposite directions, so read them before writing either `GAME_ACTIONS_MAP.md` or the restore's
death handling.
