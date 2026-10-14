---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "3"
question: "Binding the END of the capture window to a game function (return-to-hub, back-to-lobby, quit-to-menu)? Enumerate that function's callers BY ENCLOSING FUNCTION, not by count. A 'return to X' function is very often also the BOOT path into X, so it fires before any run exists."
sanitized: true
origin: "unity:common-mistakes/audit-the-end-boundary-as-hard-as-the-start"
---

# Audit the END boundary's callers as hard as the START boundary's

**Precondition:** the game has a hub/lobby/menu, and you are binding the end of capture to a "return to it" function.

Phase 3 is emphatic about the start boundary: bind `OpenRoom` to the **convergent runtime signal**, not a
plausibly-named entry function. Nothing equivalent is said about the **end** boundary, and the omission is easy to
inherit. On the observed integration the start was traced properly — five entry paths followed to a convergent event —
and the end was bound to a hub-return function **on the strength of its name**, corroborated by `CODE_MAP.json`
labelling it an exit site. The first thing that happened on launch was the end boundary firing.

## Why the name lies

It was called from the gameplay container's init. For any player past the tutorial, "return to the hub" **is the boot
path into the hub**. That's the normal shape: one routine puts the player in the hub, and both boot and post-run call
it. Of 19 callers, audited by enclosing function, **seven were not run ends**: container init (twice, incl. a debug
skip-tutorial branch), tutorial skip, tutorial completion, a mid-flow room reload, a debug-menu handler.

## The count is not the audit

"19 call sites — hook the function body instead, one insertion covers all and future callers" is correct about
**coverage**, and it silently substitutes for the **semantic** question: *do all 19 callers mean what the name says?*
A caller inside an init/constructor, a tutorial routine or a debug handler is a red flag on sight.

## Swapping signals doesn't fix it — the layer owns run state

The obvious alternative signal fired from the hub's load-complete handler, which also runs at boot. The ambiguity is
in the game's design, not the hook choice. Invert the authority — **the game signal asks; the layer decides whether
there is anything to end**:

```cpp
void LudeoHooks::OnRunEnded() {
    if (!s_roomOpenForRun) return;            // boot, tutorial, debug, reload — nothing to end
    s_roomOpenForRun = false;
    auto& ludeo = LudeoManager::Instance();
    if (ludeo.IsGameplayActive()) ludeo.EndGameplaySession(/*isAbort=*/false);  // real run — keep the capture
    else                          ludeo.CloseUnbegunRoom();   // opened, never begun — remove player, close room
}
```

It survives callers added later, and the second branch matters: an exit helper that only ends an *active* gameplay
session (the CR-007 pattern) does nothing when `Begin` never ran, leaving the **room** open and leaking on the backend.

**Check the start side for the mirror case:** the same container init fired the run-start event during the tutorial,
which would have opened a capture room during scripted onboarding. The game's tutorial-world flag is the guard. Audit
both boundaries in one pass. Related: `learnings/common-mistakes/a-session-boundary-can-exist-and-never-fire.md`.
