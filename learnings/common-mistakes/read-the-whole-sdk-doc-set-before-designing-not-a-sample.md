---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "1,3"
question: "About to design the lifecycle, pause handling, triggers or the replay flow after reading only a few SDK doc pages?"
sanitized: true
origin: "unity:common-mistakes/read-the-whole-sdk-doc-set-before-designing-not-a-sample"
---

# Read the whole SDK doc set before designing — not a sample

Applies before designing any phase that touches the SDK surface.

In one integration the agent read a **sample** of the SDK documentation, relied on the skill's references and
learnings for the rest, and started designing. The integrator later asked for a full read of every page. That read
found, in one pass, things the sampled design had missed or got wrong:

| Missed in the sample | Cost |
|---|---|
| The Player Flow **must hold the game paused** while the restored moment waits for the viewer | the pause had been dropped on the strength of a learning whose precondition didn't hold for the installed SDK |
| A marked highlight is not a finished Ludeo: the creator sets the start point and publishes on the platform | test instructions assumed the replay starts where the capture key was pressed |
| The clip length is a platform setting (it was 3 minutes, not the 60 s assumed) | wrong expectations about which part of a run a Ludeo contains |
| The trigger actions split **by flow** (`learnings/architecture/pause-and-non-ludeoable-triggers-split-by-flow-a-real-pause-needs-both.md`) | the pause menu stayed usable as a start point |
| Read ordering and launch-path requirements for the Player Flow | caught only at the audit, before they became cloud bugs |

## The rule

- Before designing a phase that touches the SDK, **read every page** of the core doc set
  (`references/ludeo-integration-docs/`, starting with `00-CRITICAL-REQUIREMENTS.md`) plus the official pages
  `12-SDK-API-REFERENCE.md` links to. It is a few dozen pages; each defect it prevents costs a build-test-report
  cycle.
- Treat the skill's learnings as **context on top of** the docs, not a substitute. Where a learning and the docs
  disagree, verify the learning's precondition against the installed SDK before following it.
- When an audit agent checks the design against the docs, **give it the runtime logs** too: in the same integration,
  two of three "blockers" an audit reported from the docs alone were disproved by one log.
- Tell the integrator plainly how much of the documentation was read. "Briefly checked" is not a basis for a design,
  and they will ask.
