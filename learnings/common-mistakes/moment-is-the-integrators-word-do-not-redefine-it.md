---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: "1,2,3,4,5,6,7,8"
question: null
sanitized: true
origin: "unity:common-mistakes/moment-is-the-integrators-word-do-not-redefine-it"
---

# "Moment" is the integrator's word for what they mark — never reuse it for the session bracket

The creator marks a highlight while playing, through the Ludeo overlay. **The game does not do this** — the SDK and
platform handle marking, and the platform cuts the highlight from inside the open room's recording (`03 §2.8`). That
is what "a moment" means to the integrator: the thing they chose by pressing the key.

Our own vocabulary drifts. Briefs and worker summaries reach for "moment" as a loose synonym for the room /
gameplay-session bracket (`OpenRoom` … `Room_Close`, `Begin` … `End`). Used in front of the integrator, that
silently redefines a word they already own, and reads as the agent not understanding the product.

## What this looked like

A worker raised a correct, narrow question: on a level-to-level transition, end the gameplay session normally or
abort it? It phrased it as "is an intermediate level a finished moment?". The orchestrator relayed it and, to make
it sound like a product decision, re-dressed it as "this decides how many playable clips a run can produce." The
integrator's reply, in substance: *you're confusing what a moment is — I choose moments when I press the capture
key.* They were right twice: the word was hijacked, and the added framing was false — the platform derives clips
from the captured stretch, which the engagement's own state file already said.

## The distinction to hold

| Thing | Who decides | What it is |
|---|---|---|
| The marked highlight | the creator, live, via the overlay | **the moment** |
| The room / gameplay-session bracket | the integration code | the **window** in which marking is possible, and whether the captured stretch is kept (`ludeo_GameplaySession_End`) or discarded (`End` with `isAbort`) |
| How many playable clips result | the platform | not a game-side decision |

So End vs abort is "keep this capture or throw it away" — never "is this a moment", never "how many clips".

## The rule

- Never use "moment" for the bracket in anything the integrator reads. Say **"the stretch we capture"** or
  **"the window where they can mark"**.
- When a worker's question contains "moment", treat it as a **defect in the question** and re-derive what is
  actually asked before relaying it.
- Before framing anything as a product decision, check the framing against the glossary and the state file
  (`ludeo-integration-plan/integration.json`). Product-sounding language invented to justify a question is how a
  wrong claim gets laundered into a decision the integrator is asked to make.

Related: `learnings/common-mistakes/write-for-the-integrator-not-for-the-skill.md` (the mirror failure — making
them decode our jargon) and `learnings/common-mistakes/verify-a-relayed-question-before-asking-it.md`.
