---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Are you passing a callback into the game's own loading-screen/transition API (open/show/fade), with anything load-bearing inside it? Read that API's guard clauses first: many such functions silently return WITHOUT invoking the callback when the screen is already open or a fade is still running."
sanitized: true
origin: "unity:common-mistakes/a-loading-screen-open-call-may-silently-drop-your-callback"
---

# A loading screen's open call may silently drop your callback

The game's level-change helper ran its whole transition inside the loading screen's `Open(callback)` — the server's
wait-for-clients step and the client's "ready" message both lived in that callback. The open function begins:

```cpp
if (!force && (m_isOpen || m_fadeRunning))
    return;                    // callback never invoked, no error, no log
```

The restore's "reach active gameplay" step (CR-010 step 4) fired the transition just after a previous load's screen
closed, while its fade still ran, so the guard ate the call. No level change, no error, nothing in the log.

Three lessons, most general first:

1. **Read the guard clauses of any API you hand a callback to.** "Open the screen, then do X in the callback" is only
   as reliable as the open call's promise to invoke it.
2. **Don't put critical handshakes only inside cosmetic-UI callbacks.** If you must, first wait (bounded) for the
   screen to be genuinely idle, fade included; a read-only accessor for a private idle state is a legitimate edit.
3. **It compounds with holding the screen yourself.** Force-holding the game's loading screen as a cover makes every
   later game-initiated `Open(callback)` get eaten. Use a cover the layer owns — and drop it before `OpenRoom`; the
   frozen moment, not a cover, belongs behind the overlay (CR-010).

**Symptom signature:** a transition that works from calm UI states but silently stalls when triggered programmatically
right after another level change, with nothing in the log at the stall.
