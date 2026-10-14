---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Does a restored field have game-side reactions to a change — setter side effects, change notifications, visual/animation cascades, invariant checks — that a raw write would skip or a setter call would trigger?"
sanitized: true
origin: "unreal:engine-quirks/reflection-write-doesnt-fire-onrep, unreal:engine-quirks/init-armor-bypasses-replenish-ensure, unreal:engine-quirks/multicast-via-processevent-bypasses-rpc"
---

# Choose the restore write path per field: raw write, the game's setter, or an initializer

**Precondition:** the field you restore is watched — something in the game reacts when it changes. That is most
gameplay state worth restoring.

There are several ways to put a captured value back, and each fails differently. This lesson is the decision rule;
the linked lessons in the table below hold the detail for each path.

## 1. Raw write — memory updated, nothing reacts

Writing the member directly (or through a reflection/property system) sets the value and fires none of the
reactions. A door's state field read `open`, but the change notification that drives its animation never ran: the
door kept its closed pose. The write "succeeded" — reading the field back confirmed it — which is what makes this
hard to see. Calling the change-notification handler by hand afterwards is fragile too: handlers that compare
**old vs new** and receive a fake old value treat the call as a no-op.

## 2. The game's setter — reactions run, including ones you don't want

The game's own setter writes the value **and** runs the cascade (animation, events, derived state) — better than a
raw write whenever something reacts, though a live-play setter also fires one-shots meant for a live change (see the
table below for when an initial-state path beats it). It can also trip invariants the captured mid-state violates. An armor value stored as
whole "chunks" had a replenish check asserting the value was always chunk-aligned; a mid-fight capture of 2.5
chunks set through the setter fired that assertion on every restore. Here the right path was the attribute's
**initializer** — the call the game uses at spawn, which writes base and current value without running the change
chain — and letting the game's next replenish tick recompute the bookkeeping (the 2.5 rounds up to 3, exactly as
in live play).

## 3. Pick the *public* setter, not the dispatch stub

In networked code a state change may be split into a public setter (authority check, then broadcast) and a
broadcast/RPC stub whose body runs only via the network dispatcher. Calling the stub directly from the restore did
nothing visible. Call the public setter the game's own code calls.

## The rule — decide per field, record it in `RESTORATION_PLAN.md`

First **read the candidate path's signature and body** — never pick it by name
(`learnings/common-mistakes/verify-game-setter-semantics-before-restoring-through-it.md`). Then take the first row
that fits:

| Visible / derived state is driven by… | Restore with |
|---|---|
| the field itself, read each frame; no reactions | **raw write** in Pass 2 |
| a transition cascade (mesh, collision, animation, events), and the game has a path for "this state arrived from elsewhere" — an initial-state flag, its save-load apply, its network late-join handler | **that initial-state path**: it fires the persistent cascade without the one-shots (`learnings/common-mistakes/restore-through-the-initial-state-path-not-the-live-play-setter.md`, `learnings/architecture/apply-through-the-games-own-cascade-path.md`) |
| a transition cascade, and only the live-play setter runs it | the game's **public setter**, with its one-shots (sounds, alerts, broadcasts, counters) suppressed on `IsRestoring()` (`07 §11.2`) — in `ApplyDeferred()` if the cascade reaches other subsystems (`07 §6`) |
| a setter whose checks reject arbitrary mid-state | the **spawn-time initializer**, then let the game's own update converge derived bookkeeping |
| a setter whose side effects you want only some of (a cache rebuild, not its notification) | **raw write + mirror** the side effects you need, each decided explicitly (`learnings/common-mistakes/direct-field-assignment-bypasses-setter-side-effects.md`) |
| a cascade that needs live context you can't reproduce (a hit's impulse) | restore the **end state** / downstream state directly, so nothing needs recomputing |

Verify each by **looking** (the door moves, the bar shows the value), not by reading the field back. Then audit
what the chosen path borrows (`07 §11.2`): a setter that also increments a counter or emits an event may be applying
a side effect the snapshot already contains.
