---
category: architecture
tier: universal
sourceGame: EndlessFPS
phase: "5"
question: null
sanitized: true
origin: "unreal:architecture/post-restore-self-validation-phased-checks"
---

# Validate the restore with phased self-checks in code — never sign off Player Flow on a visual

## The principle (a developer's words)

> "Add code to validate, after we restore, that the entities we THINK we restored are actually there in the right
> place — rather than trust visual inspection."

"Looks right" is not evidence. A restore can look plausible while silently dropping most captured entities — and look
wrong for a different reason than the obvious guess. One "the scene looks different" report was attributed in turn to
entity displacement, AI drift and camera facing; the self-check data ruled out all three and showed the real cause,
dropped entities, in a single run.

## The pattern

After the apply, compare **what you asked for** with **what the world contains**, at three points of the core order
(`07 §2.1`), logging a per-entity delta and a one-line summary each time:

- **post-apply** — right after the frozen apply. Isolates spawn-time problems: collision push-out, failed spawns,
  dropped entities.
- **post-settle** — at the end of the settle, before the re-freeze and `OpenRoom`. Growth since post-apply is drift
  during the running settle (AI pathing, physics).
- **post-Begin** — at `Begin` / unfreeze: the moment actually presented to the viewer.

Per restored entity: the requested transform, then at each point the position delta, the rotation delta, and whether
it still exists (a weak handle that went null = destroyed). In the summary:

- `expected` / `present` / `missing` — dropped restores show up here and in no visual;
- a **world count of each tracked type** — exposes extras (game spawns leaking past suppression): `world >> present`;
- the **player's position and view rotation** against what was applied — the facing frames the whole moment, and a
  drifted view makes a perfect restore "look wrong". Report yaw and pitch separately.

**Reset the expected-state records at the start of the apply**, before anything is applied. A reset placed between the
player apply and the entity pass silently wiped the player's expected values; that ordering bug shipped once.

## Reading the deltas

Defaults that work: ~0.5 m position (convert to the engine's world units), ~10° rotation. Position is the signal; rotation flags on ragdolled corpses are
rest-pose noise, and small rotation drift on live AI turning toward the player during the settle is usually benign. A
delta at post-apply is a spawn problem; one that grows by post-settle is a settle problem; one that appears only at
post-Begin happened while frozen (rare — suspect teleport or possession side effects).

## Cloud note

Emit these lines through a channel the cloud machine's log actually collects — check in the first `phase 7` cloud run;
on Windows, `OutputDebugString` is one such channel when the engine's own log file isn't collected. The same lines
then verify the cloud restore against the local baseline line by line.
