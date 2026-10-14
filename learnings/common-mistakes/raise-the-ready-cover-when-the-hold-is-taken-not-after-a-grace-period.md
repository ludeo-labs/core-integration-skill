---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "3"
question: "Does the integration show a visual cover over the level while the per-run control hold waits for readiness or `Begin` — and is that cover raised lazily, only once the hold outlives a grace period, so the healthy path stays invisible?"
sanitized: true
origin: "unity:common-mistakes/raise-the-ready-cover-at-scene-activation-not-after-a-grace-period"
---

# Raise the ready cover when the hold is taken, not after a grace period

Applies when a cover is drawn over the level while player control is held for readiness / `Begin`
(`LAUNCH-AND-READINESS §3`).

The tempting optimisation: the cover only matters for a stalled gate, so start a timer when the hold is taken and
cover the level only if the hold outlives N seconds. The healthy path stays invisible.

It also produces a **visible flash** the first time the gate takes longer than N: the level renders normally, a
black screen drops over an already-visible level, then the level comes back. The integrator reported *"it loads the
level, then goes black, then wakes up and shows the overlay"* — read as a bug although every gate decision underneath
was correct.

**Raise the cover in the same handler that takes the hold** — the level-load-complete callback that runs after the
level's entities are initialised and **before its first rendered frame**. The player then sees load → cover → level,
indistinguishable from an ordinary loading screen.

The lazy version's one real advantage — not covering a run that will never be captured — costs nothing to keep if
the "no capture" decision is synchronous: when the session is already known to be unavailable (readiness fell
through, `LAUNCH-AND-READINESS §3.1`), the release fires inside the same callback and hides the cover before
anything renders. Order the handler **hold → show cover → notify**, and the no-capture case never shows a frame of
cover.

The watchdog is then a **pure bounded timeout** (release the hold and drop the cover after N seconds so an offline
player is never stuck), with no cover logic in it — simpler than the version it replaces.

**Where the cover is legitimately longer than a beat:** a developer direct-launch into a level, with no menu to absorb
the `ludeo_Session_Activate` round-trip — the cover can sit a couple of seconds before `Begin`. That's the honest
rendering of "the player doesn't have control yet", and only on the developer's path.

(The Player Flow is different: there the finished restored moment must be on screen, frozen, behind the overlay
before Play — CR-010. A cover must never sit in front of it.)
