---
category: common-mistakes
tier: generalizable
sourceGame: StoryPuzzleGame
phase: "6"
question: "Are you about to detect an 'entered a sub-area / flashback / memory space' action by polling which streamed level sections are loaded, while in-place set-pieces in the main area also stream sections in?"
sanitized: true
origin: "unreal:common-mistakes/detect-subarea-entry-by-relocation-not-streamed-sublevel"
---

# Detect sub-area entry by player relocation, not by which streamed content is loaded

**Applies when** you want an action for "the player entered a distinct sub-area" (a flashback, a portal room, a
memory space), the game gets there by **teleporting the player** to a far anchor and streaming the sub-area in,
and the main area **also** streams content for in-place set-pieces or cinematics.

## What failed

The first detector polled the set of loaded, visible sub-area sections and fired on the empty → non-empty edge.
It misfired in two ways:

- **In-place set-pieces fired it.** A story moment streamed a section in **where the player was standing**, and
  the action fired with the player having gone nowhere.
- **Early-loaded-and-stays masked later entries.** One section streamed in early and stayed resident, so the set
  never returned to empty, and genuine later entries never crossed the edge.

"Is content X loaded?" is not the same question as "did the player move into a different space?"

## The fix

If entry physically relocates the player far from the main area, poll the **player's position** and latch the
crossing:

```cpp
const bool inSubArea = LengthSquared(player->Position()) > kSubAreaDistance * kSubAreaDistance;
if (m_baselined && !m_wasInSubArea && inSubArea) SendAction("SubAreaEntered");
m_wasInSubArea = inSubArea; m_baselined = true;
```

Pick the threshold from **real captured transforms**. In the incident the main area clustered near the origin and
the sub-areas sat orders of magnitude further out, a clean separation. Baseline the cache after the restore applies
so an entry already in progress at the captured moment doesn't fire. Detect in **both** flows (`06 §7`).

## General rule

Match the signal to the question. "Entered a place" is a fact about player position or possession, not about
loaded content, even though the two usually agree. A poll source that can turn true for another reason
eventually will. Ask the user what counts as "entering" (here: "when the player is relocated into it") instead
of inferring it from whatever is easiest to poll.
