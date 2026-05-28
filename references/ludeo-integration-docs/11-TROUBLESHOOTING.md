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
- Hard crash during restoration / playback → §6 Restoration crashes

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

## 6. Restoration crashes (hard failures, not silent drops)

Unlike §1–§5, these are **hard crashes** during restoration or playback. Almost every one lands in one of seven buckets. Identify which by looking at the failing stack frame, the thread, and the last `ludeo_*` call before the crash — then fix at the root, not by adding a defensive null check or try/catch.

### 6.1 Null `DataReader` deref
**Stack ends in:** `ludeo_DataReader_SetCurrent` / `GetObjectsInfo` / `Get*` shortly after the `ludeo_Session_GetLudeo` completion callback.
**Cause:** `GetLudeo`'s callback was consumed without checking `data->resultCode == Success`. On failure the `dataReader` field is null/invalid.
**Fix:** Always branch on `resultCode` in the `GetLudeo` callback (`07-RESTORATION-PATTERNS.md §2`). Abort restoration on non-Success; never substitute a default reader.

### 6.2 Wrong-thread SDK call
**Stack:** a `ludeo_*` call on the SDK notification thread, or a main-thread SDK call from inside a mid-tick observer.
**Cause:** Notification callbacks (`LudeoSelected`, `PauseGameRequest`, `RoomReady`, `GetLudeo` completion) arrive on the SDK's thread. Touching game state or issuing further SDK calls from there without marshalling crashes (or corrupts state).
**Fix:** Marshal off the SDK notification thread immediately in every handler (`07 §2`). All reader/writer calls run on the main game thread.

### 6.3 `EnterObject` / `LeaveObject` mismatch
**Stack:** crash inside `ludeo_DataReader_Get*` / `ludeo_DataWriter_Set*` with no obvious null; or an earlier `ludeo_*Object` returned `LUDEO_FALSE` and was ignored.
**Cause:** Context stack corrupted — an `EnterObject` without its matching `LeaveObject` (or vice versa), or a hand-paired Enter that returned false but the code proceeded anyway.
**Fix:** Use the RAII `ObjectScope` (CR-002) on both reader and writer sides; check the scope's "entered" flag before issuing attribute calls. Never hand-pair Enter/Leave.

### 6.4 Stale `id_map` deref in Pass 2
**Stack:** crash dereferencing a returned game object pointer inside Pass 2 (`SetReference`, target lookup).
**Cause:** Pass 2 looked up a `LudeoObjectId` that wasn't in `id_map` (Pass 1 skipped that object) and the code substituted null instead of failing loud.
**Fix:** Pass 2's missing-id policy is **fail loud** (`07 §3.3`, §9.6). The bug is in Pass 1 — find the entity it skipped (missing `objectType` in the spawn dispatch, plan mismatch, etc.) and fix there.

### 6.5 Pointer captured as a reference
**Stack:** crash inside a setter applying a captured "id" to a `target` field; the bytes look like a pointer from another session.
**Cause:** During `/9`, a reference property was captured with `(uintptr_t)target` instead of `target->GetEntityId()`. The "id" is a stale pointer from the capture session — garbage in this one.
**Fix:** Recapture as the target's stable game id (`06 §4.4`); update the Cross-Entity References row in `OBJECT_TRACKING.md`; re-run `/9` for that property; re-test.

### 6.6 Use-after-`ObjectsInfo_Release`
**Stack:** crash iterating `objects[...]` after `ludeo_ObjectsInfo_Release` was already called.
**Cause:** `Release` happened too early, or iteration continued past a Pass-1/Pass-2 boundary that already released the buffer.
**Fix:** Hold `LudeoObjectsInfo*` for the lifetime of both passes; release exactly once after Pass 2 (CR-008). A RAII guard around `GetObjectsInfo` (mirroring `ObjectScope`) avoids this.

### 6.7 SDK call before `Activate` (or after `Release`)
**Stack:** `ludeo_*` returns an invalid handle / null and a downstream deref crashes; or an unhandled exception inside the SDK.
**Cause:** A handler fires (or the `/11` Step 3.5 launch-arg dispatch fires) before `ludeo_Session_Activate` has succeeded, or after `ludeo_Session_Release`.
**Fix:** Gate every SDK call on session state. For the launch-arg dispatch, hold the pending ludeo id until the `Activate` success callback (or first `ludeo_Tick` after activation) before invoking `LudeoSelected`.

### 6.8 Old Ludeo + new attribute schema (assert on read)
**Stack:** assert / crash inside `ludeo_DataReader_Get*` (or a reader-side scope guard) on a previously-working playback path.
**Cause:** `/9` added a new captured attribute (or renamed/retyped one) but the test Ludeo was recorded before that change. The SDK **asserts** when `ReadData` is called for an attribute that doesn't exist in the captured data — it does not gracefully return absent.
**Fix:** Re-record the Ludeo against the current write-side schema. When the captured-attribute set changes, document it as a breaking change and re-record old test Ludeos.

---

## Verification checklist (do this against a live capture)

- [ ] Captured one real session and inspected the resulting object/attribute list.
- [ ] Searched the capture/session log for `Expected type` (type-lock mismatches).
- [ ] Confirmed each planned attribute is present with the expected type.
- [ ] Confirmed actions land (objectives/scoring react, or the log shows the action).
- [ ] Confirmed reference fields resolve to the correct objects on a replay.
- [ ] Grepped the log for `[Ludeo] Data: Error` / `[Ludeo] Core: Error` / `[Ludeo] Session: Error` — SDK-level errors don't surface in game-integration logs and are the first place to look on any silent failure.

---

**Related Documentation:**
- [06-TRACKING-PATTERNS.md](06-TRACKING-PATTERNS.md) — tracking patterns, action API (§7), batch registration (§6)
- [00-CRITICAL-REQUIREMENTS.md](00-CRITICAL-REQUIREMENTS.md) — non-negotiable rules
- [12-SDK-API-REFERENCE.md](12-SDK-API-REFERENCE.md) — API reference hub
