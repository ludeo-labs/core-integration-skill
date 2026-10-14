---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "3"
question: "Does the readiness gate hold the main menu (not a level) while `Activate` resolves, and is that hold implemented by disabling the UI input/focus system or another component, from a hook that runs before the menu's own initialisation?"
sanitized: true
origin: "unity:common-mistakes/never-disable-the-eventsystem-as-a-menu-cover"
---

# Never implement a menu-side readiness cover by disabling a component the menu's startup reads

Applies when the readiness gate (`LAUNCH-AND-READINESS §3`) holds the main menu and the hold is implemented by
switching off a game component.

The gate needs the menu not to start a level before `ludeo_Session_Activate` resolves. The obvious "input-only"
cover is to disable the UI input/focus system until readiness lands, then re-enable it. It compiled, it logged
`Menu cover HELD` / `released` — and it broke the menu completely:

```
[Ludeo] Menu cover HELD (readiness)
null dereference in MenuScreen init (showing the controller hint)
null dereference in the keep-something-selected update      (every frame)
[Ludeo] Activate: Success — readiness resolved              (4 s later)
[Ludeo] Menu cover released
```

The integrator: *"I select a level and can't press enter or escape — nothing happens."*

## Why

- The gate's hook ran **before the menu's own initialisation**.
- Disabling the UI input system cleared the engine's "current input system" pointer.
- The menu's init (focus the first button, show a controller hint) dereferenced it and failed; a per-frame "keep an
  item focused" routine failed every frame.
- Re-enabling the component four seconds later does not replay the menu's init. The initial focus never happened,
  so keyboard/gamepad navigation had no focused item. A dead menu, with no error on screen.

## The rule

**A readiness cover must never mutate a component the game's own startup depends on.** Use the game's existing
full-screen loading screen (input-blocking) as the visual cover, or nothing at all on the menu — a run started before
readiness is already handled by the gate itself (`CanStartRun()`, `LAUNCH-AND-READINESS §3.1`) and by the per-run
control hold. If menu input truly must be suppressed, do it through something the menu does not read during its
init (e.g. mark the menu root non-interactive *after* the menu has initialised, from the host's first update), and
log which mechanism you chose.

This mirrors `learnings/common-mistakes/a-path-that-skips-the-menus-skips-what-the-menus-initialise.md`: there the
menus didn't run; here they ran, but a hook that ran before them removed something their initialisation required.
