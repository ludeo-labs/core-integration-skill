---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: "5"
question: "Does the restore bring back both physics-settling entities (corpses, ragdolls, debris that need time to fall) and mobile AI that starts moving on any running frame?"
sanitized: true
origin: "unreal:architecture/staggered-restore-physics-settles-before-mobile-ai"
---

# Ragdolls need a long settle, live AI a short one — don't serve both with one window

**Precondition:** the captured set contains **physics-settling entities** — corpses and ragdolls
(`learnings/save-systems/captured-dead-entities-restore-as-corpses-via-death-path.md`), debris — **and** mobile AI
whose controllers start pathing on the first running frame.

## The conflict

The settle runs frames (`07 §2.1` step 5), and the two groups want opposite lengths:

- **Short** (a few frames): the re-freeze lands before the ragdolls do — the first frame of the moment shows bodies
  frozen mid-collapse, floating.
- **Long** (~1.5 s, enough for ragdolls to rest): live AI has the whole window to walk off its captured positions —
  meters of drift before the moment is held.

## Two ways out

**Suppress the AI during the long settle — the core default.** CR-010 ("Freeze vs suppress") gates AI and behaviour
logic on `IsRestoring()` while frame-dependent settle work runs. If the game's AI can be held without side effects
(no perception state, timers or blackboard values that change while held), extend the settle for the ragdolls and keep
the AI still for it.

**Stagger the apply — when holding AI would alter it.** The source integration chose this, to leave AI behaviour
untouched (`learnings/common-mistakes/speculative-mitigations-distort-ludeo-fidelity.md`):

1. Freeze → apply everything **except** the mobile AI; keep their captured data in a pending list.
2. Settle **long** (~1.5 s; count frames for the slowest platform — at 30 fps the same count spans twice the wall
   time, which is fine: more settle is safer).
3. Freeze → apply the pending AI at their exact captured transforms → settle **short** (the few frames their init
   needs) → freeze → `OpenRoom`.

Both stages run before `OpenRoom`, so nothing is written after Play. With no physics-settling entities in the capture,
use the single short settle.

## Verify

With per-entity offset logs (`learnings/architecture/post-restore-self-validation-phased-checks.md`): the staggered
version restored every entity with a maximum offset under 2 cm on the cloud, against meters of live-AI drift with one
long window — and the bodies rested on the floor.
