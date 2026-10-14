---
category: architecture
tier: generalizable
sourceGame: multiple
phase: "3,6"
question: "Do the game's non-interactive segments (menus, shops, dialogue, cutscenes, upgrade screens) announce themselves through one central state — a game-state enum with a change notification, or a polled controls-gate aggregate — rather than each needing its own enter/exit hook?"
sanitized: true
origin: "unity:architecture/non-ludeoable-spans-as-a-state-machine-not-paired-calls, unity:architecture/span-machine-off-the-controls-gate-aggregate-when-there-is-no-state-enum"
---

# Derive the non-gameplay spans from a state transition, not from paired enter/exit call sites

**Precondition:** one central lever describes whether the player is in normal play — a game-state setter with a
change notification, or (without an enum) a controls-gate aggregate the integration can poll
(`learnings/architecture/controls-gate-interface-is-the-non-ludeoable-census-and-a-suppression-seam.md`).

Instead of placing `StartNoneLudeable`/`StopNoneLudeable` and `PauseLudeo`/`ResumeLudeo` at each segment's sites
(`6b` Step 5), compute the span the game is **in** and report only transitions, through the `LudeoManager`
span helper (`ReportSpan`):

```cpp
enum class Want { None, NonLudeoable, Paused };

void LudeoSpanMachine::Evaluate()        // on the state-change notification, or once per frame when polling
{
    if (m_layer_driven) return;          // our own restore freeze / input hold is not the game's pause
    const Want want = GameIsFrozen()          ? Want::Paused        // the game's real freeze primitive
                    : NonPlayingStateActive() ? Want::NonLudeoable  // a foreign gate closed / non-Playing state
                    :                           Want::None;
    if (want == m_span) return;
    Close(m_span); Open(want); m_span = want; // non-None -> non-None closes one span and opens the other
}
// Open/Close map to ReportSpan(...).
// Every End/abort path: Close(m_span); m_span = Want::None;  (with 6b's CloseSpansBeforeGameplayEnd)
```

Which pairs a frozen span sends, and how to tell a freeze from a non-interactive span that keeps simulating:
`learnings/architecture/pause-and-non-ludeoable-triggers-split-by-flow-a-real-pause-needs-both.md`.

## Why a machine beats paired calls

- **Dangling spans become structurally impossible.** With paired sites you must prove every open has a reachable
  close; here the invariant holds by construction, and the unconditional close at session end finishes it.
- **Real games have unbalanced exits.** One screen deliberately skipped its return-to-playing transition on one
  branch (closing straight into a teleport), so the game went `Paused → Cinematics` with no `Playing` in between. A
  paired design would have leaked the span and disabled Ludeo creation for the rest of the run. Test this case.
- **Dead or commented-out state calls are harmless**; the machine never sees them.
- **It collapses the search**: segments that look unrelated (shop, dialogue, altar, upgrade screen) usually route
  through the same setter, so the work is one grep for the setter plus classification.

## Preconditions and exclusions

1. **Subscribe where the game would create the owner.** If the notification lives on a lazily created singleton,
   subscribe from the first gameplay hook — touching it at boot can create it earlier than the game does.
2. **Guard the integration's own writes.** If the restore sets a non-playing state or closes its own control gate
   to suppress the sim, it fires the same signal; without `m_layer_driven` the integration reports a span at its
   own restore.
3. **When polling a gate aggregate, exclude:** the integration's own gate; a gate whose only `false` write is death
   or game over (that is an `End`, not a span); and gates for spans you **declined** — a sub-second, frequent
   recovery beat (pit respawn, knockback) that would fragment every Ludeo. Enforce declined spans here, not only in
   the plan, and grep for **writes to the gate property**, not just implementors — one feature wrote into another
   implementor's gate.
4. **Re-acquire the aggregator and reset the machine on every level load** if the game rebuilds it per level.
