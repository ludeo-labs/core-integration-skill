# Phase 8 — Polish & Expansion (widen coverage, fix, finalize)

> **This phase does not re-implement capture or restore.** It is the **grow-the-integration** phase: it checks what
> state Ludeo could still capture but doesn't, **recommends** the gaps to the user and — when they want to expand —
> adds that state as **new waves** that run through phase 4's census and the phase-5 wave loop. Capture and
> reconstruction stay owned by [`4-map-game-objects.md`](4-map-game-objects.md) and
> [`5-tracking-restore-orchestrator.md`](5-tracking-restore-orchestrator.md); new actions stay owned by
> [`6-actions-orchestrator.md`](6-actions-orchestrator.md). This phase routes back into them, then folds in cosmetic and
> timing polish and earlier bugs, and — when nothing material remains — **finalizes** the integration.
>
> **Not orchestrated itself.** The gap check is inline analysis; the expand path hands control to the phase-5 (and, for
> actions, phase-6) orchestrator, which owns the per-task workers and gates.
>
> **It loops.** Widen → verify the new waves at their restore gates → re-check for more gaps → widen again, until the
> user is satisfied. Completion is the user's decision, not a fixed endpoint.

## 1. Goal / Purpose

Phases 1–7 proved a **working, uploaded integration** on the wave plan's scope — wave 1's restorable spine plus the
waves the user chose. Real games have **more state a viewer would notice** than those waves captured: other modes,
mission machines, world state, stateful subsystems, more entity families — full-game systems one curated moment never
exercises. This phase:

1. **Finds** the state Ludeo could still capture but doesn't (the **gap check**, Step 1).
2. **Recommends** it to the user, prioritized (Step 2).
3. On approval, **widens** the integration by appending that state as **new waves** and re-running the phase-5 wave
   loop for just those waves — new actions through phase 6 — then loops back to re-check (Step 3).
4. Applies **cosmetic and timing polish** and fixes bugs surfaced earlier (Step 4).
5. **Finalizes** — re-uploads the widened build through phase 7, records completion in the TDD and the state file
   (Step 5).

**Deliverable:** either a wider, human-verified integration (more waves green) or a documented, user-agreed "complete at
current scope" — never a silent stop.

## 2. Inputs (Input Contract)

- [ ] **Phase 7 complete** — the integration builds, wave 1 restores for a human, actions fire in both flows, and a
      build was uploaded and assigned. Polish widens a *working* integration; it is not a place to finish a stubbed
      restore.
- [ ] **Phase 4 census** — `ludeo-integration-plan/OBJECT_TRACKING.md` with `## Object Type Census`, `## Wave Rollout`,
      `## Genre Coverage Check` and the `## Entity: … (wave: N)` blocks of every completed wave.
- [ ] **Phase 5 artifacts** — `RESTORATION_PLAN.md`, the capture code, `RestoreTwoPass` / `RestoreEnvironment` /
      `ApplyDeferred` filled for the completed waves; `CODE_MAP.json` (incl. `save_system`, `session_boundaries`).
- [ ] **Phase 6 artifacts** — `GAME_ACTIONS_MAP.md` and the `SendAction` calls.
- [ ] **`TDD_<GameName>.md`** — this phase appends a completion section to it.
- [ ] **The state file** — `integration.json → wave` (the waves done), `intake` (`profile.genres`, `scriptedSystems`,
      `captureTimingRules`) and the `risks` aimed at step `8`.
- [ ] Context files read (relative to this file):
  - `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §1.5 (waves, census, load-bearing), §9 (what to track,
    incl. §9.4's seed row and §9.6's disposition gate), §10.6 (timers and cooldowns as deltas), §11 (performance).
  - `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — §5.4 (matched instances), §6 (deferred properties), §7
    (wait-for-player), §8 (environment, camera, soundtrack), §11 (play-forward hazards).
  - `ludeo-integration-docs/game-patterns/INDEX.md` — the genre §3 tracking checklists, the full-coverage list the
    curated waves sampled from; `open-world-tracking.md` if the world streams.

## 3. Steps

### Step 1: Gap check — what can Ludeo still capture that it doesn't?

Analysis only — no code. Diff **what the game has** against **what the waves captured**. Finish every category before
presenting anything: a partial list invites the user to approve an incomplete plan.

#### 1a. Baseline — read what is already tracked

From `OBJECT_TRACKING.md`: `## Wave Rollout` (which types landed in which wave), each entity's property table with its
dispositions, and `## Genre Coverage Check`. From `RESTORATION_PLAN.md`: which of those restore. From
`GAME_ACTIONS_MAP.md`: the actions sent. Record the baseline in one short table — everything below hunts only what is
**new**. Fields earlier waves marked `defer → wave M` for a wave that never ran are the first candidates.

#### 1b. Discover uncaptured state

For each hit record what it is, where it lives (`file:line`), whether it is a new **type** or a new **property** on a
tracked type, and a rough read of whether it is **load-bearing for a broader moment**. Scope searches to the game's
own source — not the engine, third-party libraries or the Ludeo integration files.

- **Game modes / experiences — first.** Map every mode before hunting entities: mode enums and managers, mode-specific
  scenes or level lists, mode-specific rules classes. Classify each as **same-style** (a variant of the covered mode —
  entities mostly shared), **different-objective** (same core play, new win condition — adds objective entities and
  actions) or **different-genre** (a different game under one roof — its own entity and action sets). A
  different-genre mode needs **mode-conditional registration** — record that as an architectural decision — and the
  **active mode** captured on the world/session singleton so restore knows which mode to rebuild. Ask which modes
  Ludeo should support (tutorials and test modes are usually out).
- **Mission / objective / quest state machines.** Managers and state enums (`Quest|Mission|Objective|Task|Stage|
  Phase`), stage-advance functions. Capture the machine's **resolved** state — active stage, per-sub-objective flags,
  the timer **remaining** if timed — as a singleton `objectType`; never re-run the script on restore (`07 §11.3`).
- **World / environment state.** Doors and gates, alarms and alert levels, security devices, destructibles,
  time-of-day, weather, lighting, level-script counters. For many static objects prefer **one-way transition
  actions** (`DoorOpened` with its position — phase 6) over per-tick polling. Model world flags on the environment
  singleton, restored **after** entities (`07 §8`). A streaming world: `open-world-tracking.md`.
- **Stateful subsystems.** Wave / spawn directors, spawn budgets and queues, cooldown and recharge systems, RNG.
  **Timers as deltas** — remaining or elapsed-since, never an absolute timestamp from the capturing process's clock
  (`06 §10.6`). Deterministic RNG: capture the **seed plus calls consumed**, not the current value (`06 §9.4`, *Random
  seed* row — also record the calls consumed).
- **More entity families.** Extra AI families, vehicles, drones, turrets, NPC populations. Each family is its **own**
  `objectType` with its own stable id — a shared base class can drive one discovery pass, but split by concrete
  family at registration; mixing families into one type loses the identity restore needs. Sweep each family's whole
  state surface (`06 §9.6`) — it often lives on a controller, owner or manager object, not the entity itself.
- **One-time / scripted state.** One-shot triggers (`hasTriggered`, `oneShot`), granted buffs and modifiers, applied
  stat multipliers, scripted events. Capture **which fired and which are active**; restore re-applies only the
  **active result** as an absolute value — never re-run the init sequence, which double-applies (`07 §5.4`,
  `§11.2`, `§11.3`).
- **More actions.** Walk the game's event surface — its event buses, observer lists, callback registries, reward /
  achievement / streak systems — for moments phase 6 didn't map, and **enrich** the actions already sent: a payload
  often carries a damage type, a weapon, a secondary actor or a magnitude worth its own action. Bias toward more
  actions — they're cheap and don't have to become Global Triggers right away. Name them from the player's
  perspective, PascalCase, and send context as **separate** actions (`Kill` plus the weapon, never `Kill_Rifle`).
  Detect them **outside the capture path** — a transition found by comparing state between ticks inside a capture
  writer sits behind the Player-Flow state-write gate and never fires on replay (`06 §7`).
- **Genre checklist gaps.** Re-walk the matching `game-patterns/<genre>.md` §3 checklist against `## Genre Coverage
  Check` — every unchecked item is a candidate.
- **Restore-fidelity gaps.** Things the completed waves capture but don't restore cleanly: a read-back that reads an
  attribute and never applies it; a cold-spawned entity that lands in its default **visual** state because a raw
  field write skipped the setter that drives its visuals; a level's default spawns duplicating restored ones
  (`07 §3.1`, `§11.1`); a derived counter left wrong by the restore (`07 §11.2`); a post-spawn pipeline — loadout equip, cosmetic attach, stat init — that overwrites the restored
  values. These feed Step 4, not a new wave.
- **Write-volume sanity.** If widening adds many dynamic entities, estimate `entities × dynamic properties × average
  size × Hz` against the **session length** — a rate that is fine for a 3-minute round is not for a 30-minute one.
  Statics are written once, at registration (`06 §3.2`); large populations may want a lower cadence or skip-unchanged
  writes (`06 §3.3`, `§11`).
  An estimate past roughly 50 KB/s is a wave-plan input, not a blocker.

#### 1c. Apply the load-bearing guardrail

**Widening is for breadth, not for backfilling state an already-proven moment needs.** For each gap ask: *is this
needed for a moment that has **already passed** its restore gate to feel correct?*

- **Yes** → a **miss in the wave that owns that moment**, not expansion. Re-open **that** wave per the guardrail in
  `5-tracking-restore-orchestrator.md` (`wave.reopened`) and re-verify **its** gate. Don't fold it into a new wave.
- **No** → genuine broader coverage → a candidate **new wave** for Step 3.

### Step 2: Recommend to the user

Present the gap check as a **prioritized recommendation**, never a plan you execute silently:

- Two buckets, kept apart: **earlier-wave misses to fix** (Step 1c) and **broader coverage to add**, plus the
  **restore-fidelity fixes** for Step 4.
- Group the broader coverage by proposed wave, most load-bearing first, one line of rationale each; list new actions
  with the **exact strings** `SendAction` will send.
- The rough cost — new types, waves and actions — and any write-volume caveat from 1b.
- **Ask:** *"Here's what Ludeo could still capture: [list]. Expand to cover any of these now, or finalize at the
  current scope?"* Let the user pick a subset — expansion is opt-in and incremental.

If the gap check finds nothing material, say so and go to Step 4.

### Step 3: Expand — only the state the user chose

This feeds phases 4, 5 and 6 new input; it doesn't re-open their logic.

1. **Append to the census** (a phase-4 Part A update). For each chosen item add its rows to `## Object Type Census`
   and a new line to `## Wave Rollout` (e.g. `Wave 4`) — spawn/ownership pattern, load-bearing flag, wave. **Append
   only — never rewrite a green wave's rows.** Add the wave to `integration.json → wave.plan` and, in the same write, set
   `wave.current` to it and reset `5a`/`5b`/`5c`/`5e` to `not_started` (`5d` stays `completed`).
2. **Re-enter the phase-5 wave loop** for the appended wave(s) — `5-tracking-restore-orchestrator.md`, run exactly
   like any wave **≥ 2**: deep-scope (task 0) → capture (task 1) → restore plan (task 2) → reconstruct (task 4), each
   at its gate. **Skip task 3** — the restore flow is built once in wave 1; only the tracked set, the capture writers
   and the read-back grow, additively. The new wave's gate 1 needs a **fresh capture** (`07 §2.2` corollary).
3. **New actions go through phase 6** — `6a` appends the new and enriched actions to `GAME_ACTIONS_MAP.md` under a
   `## Phase 8 additions` heading (approved), and `6b` inserts only those rows. Existing `SendAction` sites stay as they
   are; an enriched action is added beside the original, never in its place. Run both flows and check that no action
   fires twice for one event; create any trigger or goal on them per `6b` Step 6. `6a`/`6b` stay `completed` —
   `steps.8.note` says which one is in progress.
4. **Loop back to Step 1.** A widened integration can reveal more (a new family references another). Re-run the gap
   check until it comes back clean or the user stops.

Keep `current` at `8` with `steps.8` `in_progress` throughout; record which wave or task you're in under
`steps.8.note`, so a resumed session re-enters the wave loop instead of starting phase 8 over. Each wave carries
heavy context: suggest a fresh session per wave batch — the state file and the plan files make that safe.

### Step 4: Polish — cosmetic and timing fidelity, earlier bugs

Once coverage is where the user wants it, tighten fidelity. These reuse phase-5 patterns — point at them, don't
re-implement:

- **Deferred properties** that no-op when applied too early — velocities, animation pose or state, navigation warps,
  cooldowns an init path resets — belong in the owning entity's `ApplyDeferred` (`07 §6`; `5c` / `5e`). Camera and
  soundtrack: `07 §8.4`, `§8.5`.
- **The post-spawn pipeline.** If the game equips a loadout, attaches cosmetics or initializes stats after an entity
  spawns, the restored value must land **after** that pipeline or be applied **through** it (the game's own setter),
  or the pipeline stomps it — still before `OpenRoom`: treat the pipeline's completion as part of "native spawn done",
  or apply in `ApplyDeferred()`; never after Play (`07 §7`). Asynchronous loading changes that timing — **re-check in the Release build**, not only
  in the debug build.
- **Visual cascades.** A value restored by raw field write changes the number but not the mesh, animation or HUD the
  game derives from it. Apply through the setter or event that drives the cascade.
- **Read-but-unapplied.** Audit the read-back against `RESTORATION_PLAN.md`: every attribute read is applied, or is
  marked deliberately not restored.
- **Bugs surfaced earlier** — each Open Question or "known gap" in `RESTORATION_PLAN.md`, the TDD or `risks` that
  wasn't load-bearing enough to block a gate. Root-cause each (`3e-compile-and-fix.md`; `orchestration.md` →
  **Fix loop**) — no symptom-masking.

> **⚠️ "Timing" here means cosmetic only.** A timing problem that leaves the restored moment **unplayable** — no
> control, wedged input, a nondeterministic first second — is **core** and belongs in the owning phase-5 wave
> (CR-010: the freeze, settle and wait-for-player flow, `07 §2.1`, `§7`), not here. Polish only sequences the visible
> result.

Every code change here goes through the same gates as the wave loop (`orchestration.md` → **Gates**): the agent
builds; the integrator replays a fresh Ludeo and watches it. A clean build never proves restore fidelity. Re-run the
action-guard audit too — actions still fire in **both** flows (`06 §7`), and every listener this phase added is
unbound in the teardown path.

### Step 5: Finalize

When the user confirms nothing material remains:

1. **No outstanding waves.** Every appended wave is `green`, or moved to `wave.deferred` with the user's sign-off in
   `decisions`. A deferred wave's partial capture and read-back are finished or removed before the re-upload — phase 7
   may not start while a wave is outstanding.
2. **Re-upload if the build changed.** Any new wave, action or fix makes the uploaded build stale — and a widened
   capture schema invalidates captures made against it (`07 §2.2` corollary). Run `7-upload-build.md` again for a
   **minor** build attached to the existing major, with all its confirmations; record the build in `decisions`.
   Step `7` stays `completed` — note the re-upload in `steps.8.note`. Tell the user test Ludeos must be re-recorded
   against the new schema.
3. **Append the completion section to `TDD_<GameName>.md`** (Output Contract below): the final wave list and
   coverage, what was widened, earlier-wave misses fixed, polish applied, bugs fixed, and the gaps deliberately **not**
   captured, with rationale.
4. **Close the state file** — `steps.8` `completed` with `completedAt`; the accepted gaps in `decisions`.
5. **Declare the integration complete at the agreed scope**, naming what was and wasn't covered, and report
   `completed` per `ludeo-studio-mcp.md` → **Reporting progress**.

## 4. Questions to ask the human

- **Step 2 (the core one):** which recommended gaps to expand now versus finalizing at the current scope — per item.
- **Modes (1b):** which modes Ludeo should support; tutorials and test modes are usually out.
- **Guardrail calls (1c):** when it's unclear whether a gap is an earlier-wave miss or genuine breadth — the wrong call
  either re-opens a wave needlessly or defers load-bearing state.
- **Write volume (1b):** if widening pushes the budget, lower the cadence, skip unchanged writes, or proceed.
- **Visual-fidelity trade-offs (Step 4):** an entity that restores functionally but not visually — acceptable, or a
  requirement?
- **Finalize:** confirm "complete at current scope" before writing the TDD section.

## 5. Patterns to apply

- **Widen through the existing phases, never duplicate them** — append waves, re-enter the phase-5 loop, route
  actions through phase 6; this phase owns no capture, restore or action code of its own.
- **Additive waves only** — a new wave appends `objectType`s, capture writers and read-back buckets; it never rewrites
  a green wave. The restore flow (task 3) is not re-run.
- **The guardrail picks the destination** — breadth → a new wave; a proven moment's missing state → its **owning**
  wave. Never carry load-bearing state forward as "enrichment."
- **Snapshot, not replay** — mission, subsystem and one-time state capture the **resolved** value (timers as remaining,
  RNG as seed plus count), applied once.
- **Cosmetic timing here; playability timing is core.**
- **Opt-in, incremental, looping** — recommend, let the user choose, verify at the gates, re-check. Completion is the
  user's call, recorded in the TDD and the state file.
- **Re-upload after widening** — a wider build and a new schema mean phase 7 again, and re-recorded captures.

## 6. Output Contract

| File | Purpose |
|------|---------|
| `ludeo-integration-plan/OBJECT_TRACKING.md` | Census rows, `## Wave Rollout` lines and `## Entity` blocks for each new wave (via phases 4–5) |
| `ludeo-integration-plan/RESTORATION_PLAN.md` | Restoration rows for each new wave (via phase 5) |
| `ludeo-integration-plan/GAME_ACTIONS_MAP.md` | New and enriched actions (via phase 6) |
| capture, read-back and action code | The new waves' writers and read-back, the new `SendAction` calls, the polish fixes |
| `ludeo-integration-plan/TDD_<GameName>.md` | **Completion section** appended (Step 5) |
| `ludeo-integration-plan/integration.json` | `wave.plan` extended; `steps.8` `completed`; the re-upload and the accepted gaps in `decisions` |

TDD completion section:

```markdown
## Phase 8: Polish & Expansion

### Final coverage
- Waves captured and restoring: <1..N> — <one line each>
- Modes covered: <...>

### Widened in this phase
- <new waves and actions — what state they added, and why (broader coverage)>

### Earlier-wave misses fixed (guardrail)
- <state a proven moment needed, re-opened in its owning wave>

### Cosmetic / timing polish
- <deferred properties, post-spawn pipeline ordering, visual cascades, environment, camera, soundtrack>

### Bugs fixed
- <earlier Open Questions / known gaps resolved>

### Accepted gaps (deliberately not captured)
- <state + rationale: cosmetic only, out of scope, write volume>

### Re-upload
- <minor build <id> assigned to <environment> | not needed — the build didn't change>
```

## 7. ✅ Success Criteria

- [ ] **Gap check run** against the baseline across every Step 1b category — findings recorded, not skimmed.
- [ ] **Guardrail applied** — each gap sorted into an earlier-wave miss (fixed in its owning wave) or broader coverage
      (a new wave); no load-bearing state parked in an expansion wave.
- [ ] **The user got a prioritized recommendation** and chose the expansion scope, or to finalize.
- [ ] **Each chosen wave landed through phases 4 and 5** — appended to `## Wave Rollout` and `wave.plan`, run through
      deep-scope → capture → restore plan → reconstruct, and **passed gate 4** on a fresh capture (placement sane,
      replay twice, played to completion). Task 3 not re-run.
- [ ] **New actions landed through phase 6** — approved in the map, in the log in both flows.
- [ ] **Polish and earlier bugs addressed** through the phase-5 patterns; any unplayable-restore timing sent back to
      its owning wave as core.
- [ ] **Re-uploaded** through phase 7 when the build changed; captures re-recorded.
- [ ] **Completion recorded** in the TDD and the state file, and the integration declared complete **at the
      user-agreed scope** — nothing stopped silently.

## 8. Common Mistakes

- **Re-implementing capture or restore here** — append waves and re-enter phase 5.
- **Rewriting a green wave's rows or read-back** to add new state — waves are additive; append a new one.
- **Backfilling load-bearing state as "expansion"** — if a proven moment needs it, fix the owning wave and re-verify
  its gate.
- **Skipping mode discovery** — entity discovery then only finds what the known mode uses.
- **Tracking everything** — projectiles, particles and transient effects rarely matter; ask whether a viewer would
  notice the thing missing.
- **One `objectType` for several entity families** — restore can't tell them apart.
- **Absolute timestamps** for timers and waves instead of remaining or elapsed deltas — stale on replay (`06 §10.6`).
- **Re-running scripted init on restore** instead of re-applying the active result — double-applies (`07 §11`).
- **Treating a streamed-out entity as destroyed** — unloading isn't removal; unregister only on a real removal signal
  (`open-world-tracking.md`).
- **Gating a new action on "is this a replay"** — actions fire in both flows (`06 §7`).
- **Detecting an action inside the capture path** — a transition found by comparing state between ticks, or a handler
  that finds its entity through objects only Creator Flow registers, sits behind the Player-Flow state-write gate
  (`06 §7`) and never fires on replay. Detect actions outside the capture writers and resolve entities from the game's
  own data. Entity or spawn handling that polish adds runs in both flows too; only state writes are Creator-Flow only.
- **Re-inserting actions that are already sent** — phase 8's `6b` pass inserts only the `## Phase 8 additions` rows;
  a duplicate site fires the action twice per event.
- **A new listener with no unbind** — it fires into a closed room after teardown.
- **Skip-unchanged writes that skip the first write** — the first write sends every property, or restore starts from
  defaults.
- **Treating unplayable-restore timing as polish** — that is core; it belongs in the phase-5 wave.
- **Expanding without asking** — the recommendation is opt-in.
- **Declaring done without re-uploading** — a widened build is stale until phase 7 runs again.
- **Claiming a wave restores from a clean build** — every new wave needs the human replay gate.

## Related / Next

- [`4-map-game-objects.md`](4-map-game-objects.md) — Part A: the census and `## Wave Rollout` the new waves append to.
- [`5-tracking-restore-orchestrator.md`](5-tracking-restore-orchestrator.md) — the wave loop re-entered for appended
  waves (as waves ≥ 2, task 3 skipped); its guardrail re-opens an earlier wave.
- [`6-actions-orchestrator.md`](6-actions-orchestrator.md) — new and enriched actions, and their triggers and goals.
- [`7-upload-build.md`](7-upload-build.md) — **re-run after widening** to publish the wider build as a minor.
- **Next:** done — the integration is complete at the agreed scope; the TDD records what was and wasn't covered.
