---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5"
question: "Is the restore relying on a restored 'already seen / already done' latch to stop a cutscene or one-shot from re-firing — and inside the driver's per-frame update, does the FIRE branch run before the branch that reads the latch?"
sanitized: true
origin: "unity:common-mistakes/restoring-an-already-seen-latch-does-not-suppress-what-it-gates"
---

# Restoring an "already seen" latch doesn't suppress what it gates — check which branch runs first

Applies when a one-shot (cutscene, scripted beat) is meant to stay suppressed by a restored latch.

Don't blanket-suppress a viewer-facing scripted moment: gate it on **state**, restore the latch, and it fires only if
the creator hadn't seen it (`07 §11.3`). That's right and usually enough. The failure is in *verifying* it — reading
the driver's update as a set of conditions rather than an **ordered sequence**:

```cpp
void CutsceneDriver::Update() {
    if (m_line.size() == 2 && m_dialogue_ended && !m_camera)   // 1. FIRE
    {
        StartCutscene();                // activates a camera owned by ANOTHER entity
        m_player->SetControls(false);
    }
    if (g_cutscene_anim_ended)                                  // 2. self-deactivate
    {
        m_player->SetControls(true);
        Deactivate();
    }
}
```

The plan said "restoring `cutscene_anim_ended = true` self-deactivates the driver" — **true**, and irrelevant,
because branch 1 runs first. A **correct** restore satisfies all of branch 1's conditions: the collection rebuilt to
the triggering count, the dialogue latch restored, and the driver is a fresh level instance so its cached camera
handle is null. On the first unfrozen frame the cutscene fires, *then* the driver deactivates — and deactivating it
doesn't undo the camera it activated elsewhere; it only guarantees nothing cleans up. Symptom: **"the Ludeo opens
with a cutscene the creator had already seen"**, often reported as a camera glitch.

## Why the restore triggers it

Live play reaches this state gradually: the collection grows while the latch is still false, the cutscene fires, the
latch flips at its end. A restore materialises both **at once**, on frame 1 — a state ordinary play can't produce.
Same family as "write the latch before the value its threshold guards", one level up: the latch is restored
correctly and still loses, because the ordering that matters is **inside the consumer**, not in the apply.

## The fix: reach the driver's own terminal state from the apply

No suppression flag, no driver edit. Do what its terminal branch does, from the restore, where no update can
interleave — **gated on the restored latch**:

```cpp
if (g_cutscene_anim_ended) {     // the RESTORED value — a creator who hadn't seen it still gets it
    driver->Player()->SetControls(true);
    driver->Deactivate();        // the same writes branch 2 would have done
    g_anim_playing = false;
}
```

It's the game's own terminal state, so nothing novel is introduced, and it keeps state-gating intact.

## The cheap check

For every one-shot the plan marks "already state-gated — no change needed", open the driver's update and answer:
**does the fire branch appear above the branch that reads the latch?** If yes, the row needs an apply-side terminal
write. Here two plan sections had recorded "no change needed" — right about the mechanism, wrong about the order.
