---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: "1,7"
question: "Does the game pause or stop its main loop when its window loses focus, or use exclusive fullscreen? With either, the Ludeo overlay taking focus can pause or minimize the game mid-capture."
sanitized: true
origin: "unity:engine-quirks/the-overlay-takes-focus-so-runinbackground-must-be-on"
---

# The overlay takes focus — a game that stops when unfocused stops under its own overlay

Applies when the game reacts to focus loss. Two window settings decide whether a Ludeo build survives its own overlay,
and both were wrong by default here. The symptom was reported as "the game minimizes and stops" and read like an SDK
bug.

**Stop-on-focus-loss.** The game halted its whole loop when the window lost focus. The Ludeo overlay taking focus
therefore stopped the game *and the capture* mid-run — and so did alt-tabbing to read the log, which quietly
invalidates any run you were watching that way. It also stops `ludeo_Tick()` (CR-005) if the tick lives in that loop.
Keep the loop running unfocused.

**Exclusive fullscreen.** The game's "fullscreen" option used exclusive mode, which Windows minimizes whenever the
window loses focus: alt-tab, a second monitor, or the overlay all dropped the game to the taskbar. Borderless
fullscreen looks the same and stays up.

Raise both with the studio rather than silently flipping them: they change normal builds too. The call here was that
they are still right — a replay pausing because the overlay took focus is worse than a game that keeps running
unfocused — but it is the studio's setting. Note that the overlay's **own** pause arrives as `PauseGameRequest`
(CR-011); if the game also pauses on focus loss, that is a second, uncontrolled pause path, which needs its own
`PauseLudeo` / `ResumeLudeo` pairing (`phase 6`) if it stays.

## Don't fix it with a runtime resize

The first attempt switched to borderless by calling the game's screen-mode setter during boot. That produced a new
bug: the overlay's timer, objective and counter panels drew as misplaced white rectangles over the game, only on the
direct-boot path.

The overlay creates its own render resources early, against the window handed to `ludeo_Session_Activate` (CR-004).
Changing the screen mode afterwards resized the backbuffer **after** those resources existed, and the overlay did not
re-derive them. Prefer the startup default (the config the game reads before creating its window, plus any persisted
preference) so no runtime resize happens after activation.

Stated limit, kept honestly: no graphics errors in the log proved this one — the resize was the only
rendering-relevant difference between the working and broken paths. When a fix rests on elimination rather than
evidence, say so and name what to try next (here: the fast level load racing the overlay's setup).
