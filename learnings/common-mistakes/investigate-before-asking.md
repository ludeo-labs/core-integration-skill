---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: "1,2,3,4,5,6,7,8"
question: null
sanitized: true
origin: "unity:common-mistakes/investigate-before-asking"
---

# Do the work before you speak — never ask what the repo answers, never assert what you haven't checked

Two failure modes, one root cause: producing output where investigation belonged.

## Never ask what the codebase already answers

Every phase file has a "questions to ask the human" list. It lists things that are **not inferable** — it is not a
script to read out. Before asking anything, try to answer it from the game's source, the installed SDK headers and
libraries, and the docs. Observed in one phase-1 run, each answered by the human with "go find out yourself":

| Asked | Should have |
|---|---|
| "Does the game have bosses, and how are the fights structured?" | Grepped for a boss flag and boss-arena content — one search found a first-class boss flag with its own scoring tier |
| "What are these uncommitted files?" | Run `git diff --stat` and classified them (regenerated data, re-serialized assets) first |
| "Please confirm the project compiles" | Run the build yourself; ask only about the *play* half |
| "Which scripted sequences need suppressing during restore?" | Grepped for countdown/timer classes and pre-gameplay UI screens |

**Still worth a question:** product decisions (which slice to target, the launch model), secrets and credentials,
external system state (Studio Lab environments, entitlements), anything that needs eyes on the running game, and
non-reversible choices with real cost. When you ask: batch the questions, bring the evidence you gathered, say what
you checked, and state a recommendation and a default so silence still lets work continue. A long question list is
not diligence — it is unbilled work handed to the human, at the point where trust is being built.

## Never assert what you haven't checked

- **Repeating the skill's prose as verified fact.** Workflow files are guidance written against one SDK version, not
  ground truth about this engine. "The agent cannot see the game's log" was told to a client while a log file with
  that output had already been read in the same session. **Test a capability claim before passing it on.**
- **Recommending without checking the skill's own warnings.** An automated harness that auto-fires SDK init in a dev
  loop was proposed as the top priority while the skill warned against exactly that. **Grep the skill for warnings
  about the thing you are recommending.**
- **Repeating a documented fact about the installed SDK.** Function names, header layouts and tool commands drift
  between versions. Read the installed headers (`03 §4.5` — headers win), then state what is there.

| Claim about | Cheap check |
|---|---|
| An agent capability ("can't see X") | Try it once |
| SDK API or file layout | Grep the installed SDK, not the workflow text |
| A recommendation's safety | Grep the skill for warnings naming it |
| Anything version-dependent | Compare the documented version to the installed one |

When you can't verify, label it — "the docs say X; I have not tested it." A reviewer can challenge a labelled
assumption; a flat assertion has to be caught.
