# 11 - Troubleshooting

> **Purpose:** Runtime failure modes that don't show up at compile time. These are the bugs you only see by reading a real capture log or a live Ludeo session — not by getting a clean build.
> **Audience:** AI agents and engineers verifying an integration after the code compiles.
> **Scope:** Proprietary C++ engines. Engine-specific guides have their own troubleshooting.

---

## How to use this document

A clean compile proves almost nothing about tracking correctness. Most tracking bugs are **silent at runtime**: the SDK call succeeds (or fails with a return code nobody checked), the attribute is dropped, and the only evidence is a capture that's missing data or a replay that looks wrong. Verify against a **real capture**, not against the compiler.

Jump to the symptom:

- Attribute silently missing from a capture → §1 Runtime attribute schema type-locking
- Action never registers / objectives don't fire → §2 Actions silently dropped
- Object appears in capture but its properties don't → §3 Tracking active but values missing
- Replay references resolve to the wrong object / null → §4 Reference resolution
- Capture is empty entirely → §5 Nothing is being captured

---

## 1. Runtime attribute schema type-locking

**This is the highest-value thing in this document.** The Ludeo backend can hold a **pre-existing, type-locked attribute schema**. Once an attribute name (e.g. `kart_id`) has been seen with a given type, that type is fixed server-side. If your client later writes the same attribute name with a **different** type, the value is **dropped at runtime** — it is *not* a compile error, and usually *not* a loud runtime error either.

### Symptom

A live capture log shows something like:

```
kart_id: Expected type Int32 but client specified UInt32
```

…and that attribute is simply absent from the restored state. Everything compiled. Every `ludeo_DataWriter_Set*` call "succeeded" from the game's point of view. The replay is just missing `kart_id`.

### Why it happens

- The attribute's type was locked by an earlier capture (or by a schema configured on the Ludeo side) as `Int32`.
- Your code captured it with `LUDEO_CAPTURE_UINT64` / `SetUInt32` / a different width or signedness.
- The SDK accepts the call locally but the backend rejects the mismatched type and discards the value.

### How to catch it

- **Read a real capture log.** Type-lock mismatches are invisible until you inspect a live capture. Make "sample one capture and diff the attributes against the plan" a required verification step, not an optional one.
- Grep the session/capture log for `Expected type` — each line names the offending attribute and the type the backend expects.

### How to fix it

- **Match the client capture type to the locked server type.** If the backend expects `Int32`, capture with the `Int32` macro/setter — even if the game's native field is unsigned. Cast at the capture site; don't change the game's field.
- Keep attribute **names + types stable across releases.** Renaming or re-typing an existing attribute is a breaking change against the locked schema.
- When in doubt about the locked type, capture once, read the log, and let the error tell you the expected type.

> **Rule of thumb:** attribute *types* may be fixed server-side. A type mismatch is a silent runtime drop, not a build failure. Verify a real capture; mismatches are dropped at runtime.

---

## 2. Actions silently dropped

`ludeo_DataWriter_SendAction` requires the DataWriter **handle** plus a params struct with a **required `playerId`** and **required `action`** (see `06-TRACKING-PATTERNS.md §7.1`). Common silent failures:

- **`playerId` empty or wrong.** If the manager never stored the id it passed to `ludeo_Room_AddPlayer`, `SendAction` forwards an empty player id and the backend drops the action. Confirm `m_player_id` is populated.
- **Action sent outside an active gameplay session.** Actions before `BeginGameplaySession` or after `EndGameplaySession` are dropped by design (the session-state guard returns early). This is expected — don't "fix" it by removing the guard.
- **Return code ignored.** Check the `LudeoResult` from `ludeo_DataWriter_SendAction`; a non-`Success` result means the action didn't land.

---

## 3. Tracking active but property values missing

- **Capture before mutation.** A `LUDEO_CAPTURE_*` placed *before* the game-state write captures the old value. Capture must come *after* the mutation.
- **Object never entered.** Per-attribute writes apply to the current object context. If `EnterObject`/`LeaveObject` (via `ObjectScope`) wasn't paired correctly, writes land on the wrong object or nowhere. Use the macros; don't hand-pair (CR-002).
- **Type mismatch** — see §1.

---

## 4. Reference resolution: wrong object or null on restore

- **Captured a pointer instead of a stable game id.** References must capture the target's stable game id (`target ? target->GetEntityId() : 0`), never `(uintptr_t)target` — pointers don't survive across sessions (`06 §4.4`).
- **Missing Cross-Entity References row.** A reference with no entry in the plan's Cross-Entity References table silently fails to resolve in two-pass restoration.

---

## 5. Nothing is being captured at all

- **DataWriter not set as current** before the writes (`ludeo_DataWriter_SetCurrent`).
- **Batch registration never ran**, or ran during restoration and was correctly skipped but the normal-play path was never reached (see `06 §6.3`).
- **`LUDEO_SDK_ENABLED` is 0** in the build you're running — verify the active build config actually defines it.
- **Gameplay session never reached `Begin`** — the callback chain (OpenRoom → AddPlayer → RoomReady → Begin) stalled. Check `05-LIFECYCLE-MANAGEMENT.md`.

---

## Verification checklist (do this against a live capture)

- [ ] Captured one real session and inspected the resulting object/attribute list.
- [ ] Searched the capture/session log for `Expected type` (type-lock mismatches).
- [ ] Confirmed each planned attribute is present with the expected type.
- [ ] Confirmed actions land (objectives/scoring react, or the log shows the action).
- [ ] Confirmed reference fields resolve to the correct objects on a replay.

---

**Related Documentation:**
- [06-TRACKING-PATTERNS.md](06-TRACKING-PATTERNS.md) — tracking patterns, action API (§7), batch registration (§6)
- [00-CRITICAL-REQUIREMENTS.md](00-CRITICAL-REQUIREMENTS.md) — non-negotiable rules
- [12-SDK-API-REFERENCE.md](12-SDK-API-REFERENCE.md) — API reference hub
