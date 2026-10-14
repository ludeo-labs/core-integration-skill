---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: "2"
question: "Does the game gate player input through a one-property 'controls allowed' interface that a central controller collects and ANDs together, instead of through a central game-state enum?"
sanitized: true
origin: "unity:architecture/controls-gate-interface-is-the-non-ludeoable-census-and-a-zero-edit-suppression-seam"
---

# With no game-state enum, the controls-gate interface is the single lever — census and suppression seam at once

**Precondition:** no central game-state enum, but a controls-gate shape like this:

```cpp
// game side: one property, implemented by every screen/cutscene/sequence that takes control away
struct IControlsGate { virtual bool ControlsAllowed() const = 0; virtual ~IControlsGate() = default; };

// game side: the player controller is the arbiter
void PlayerController::OnLevelStart() { m_gates = World::CollectAll<IControlsGate>(); }    // once per level
void PlayerController::Update() {
    const bool on = std::all_of(m_gates.begin(), m_gates.end(),
                                [](auto* g) { return g->ControlsAllowed(); });
    SetInputEnabled(on);
}
```

Find it by grepping for a one-method interface pairing "controls"/"input"/"player" with "allowed"/"enabled", then
for the call that collects its implementors. Do this before concluding the game has no single lever.

## It answers three questions

1. **The non-ludeoable census (phase 2 → `6a`).** The implementor set is the game team's own list of "spans where
   the player is not in control" — cutscenes, camera cutaways, dialogue, menu-like screens, scripted respawns. One
   grep produced ten implementors; a keyword hunt for shop/dialogue/cutscene found a subset plus false positives.
2. **A suppression seam (phases 3 and 5).** An integration-owned object that implements the interface and returns
   `false` withholds input **through the game's own arbiter**, composing with the game's gates, with no edit to
   existing game logic — useful for the restore's input hold (`07 §2.1` step 3).
3. **An input hold that survives a game that re-asserts its own pause/time state every frame.**

## Preconditions to verify before relying on it

1. **Collection is usually one-shot at level start.** An integration gate created later, or initialized after the
   arbiter collects, is silently never seen and appears to do nothing. Register it before the collection runs, or
   add a re-collect call.
2. **It gates input, not the simulation.** Physics, AI and animation keep running, so CR-010's overwrite guard
   still needs the freeze or genuine suppression alongside it.
3. **The list is rebuilt per level** — re-register on every level load, not once at boot.
4. **Implementor ≠ non-ludeoable.** Classify each by whether it actually freezes the sim
   (`learnings/architecture/pause-and-non-ludeoable-triggers-split-by-flow-a-real-pause-needs-both.md`); the pause
   menu is usually an implementor too.

## Shape differences from a state enum

- Many implementors flip the gate from **one toggle site**, not a paired enter/exit — derive the span from the
  value, not from call sites.
- There is no change notification; the arbiter polls. Derive spans by polling too
  (`learnings/architecture/non-ludeoable-spans-as-a-state-machine-not-paired-calls.md`), and **exclude the
  integration's own gate** from that derivation, or the restore's input hold emits `StartNoneLudeable`.
