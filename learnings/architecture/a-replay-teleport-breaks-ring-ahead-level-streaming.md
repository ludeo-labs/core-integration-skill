---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game prepare level content just-in-time around the player — each room set up one ring ahead, encounters configured as neighbours unlock? A replay that places the player anywhere breaks that ordering; prepare the whole level before the restore freezes."
sanitized: true
origin: "unity:architecture/a-replay-teleport-breaks-ring-ahead-level-streaming"
---

# A replay teleport breaks ring-ahead level setup

**Precondition:** the game amortizes level setup by preparing content just ahead of the player — the world build
prepares the first room and its neighbours, and each room the player claims prepares the next ring. The ordering
guarantee is the player's own walking pace.

A replay violates that in one move: the restore places the player anywhere. Every room they then walk into
starts its setup only on arrival — and the room's one-shot entry trigger fires first, finds no configuration,
logs one quiet error and leaves the room permanently dead. The observed shape was total: an entire replay with
zero spawns anywhere, from a single error line per room.

## The fix: prepare the whole level before the moment is held

In `07 §2.1` step 4 ("reach active gameplay"), queue setup for **every** room, not just the ring around the start,
and wait for it to finish before the step-5 freeze. Two traps inside that fix:

- **The setup pump may run on the game's own clock.** Here the setup queue advanced only on game time, which a
  freeze stops — so a full-level setup queued under the freeze never drains (CR-010 "Freeze vs suppress"). Queue
  and drain it while time still runs, and wait on the processor's own **idle** signal (an empty queue, not a
  timer) before freezing. Bound that wait like every other restore wait.
- **Enqueue is not idempotent.** The per-room "already processed" mark was set only at **dequeue**, so queuing a
  room twice in one pass ran its setup twice — including the enemy pre-spawn, doubling the dormant population.
  Dedupe at the call site, and mirror the game's own skip rules and per-room setup type (e.g. navigation-only for
  rooms without spawners) rather than inventing your own.

## The generalization

Any ordering guarantee the game gets for free from player locomotion — setup streaming, trigger arming, culling or
LOD state, spatial-index membership — is void after a teleport, and the restore must re-establish it explicitly.
When planning a restore for a streamed or ring-prepared world, list what the game prepares "because the player is
about to arrive" and decide, per item, whether the restore prepares it up front.

Verify with a moment captured deep in the level: walk into three rooms the start position never neighboured and
confirm each one spawns.
