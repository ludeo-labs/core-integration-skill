# Universal Capture Baseline

> **Applies to:** every genre — load this **alongside** the matching genre file(s).
> **Purpose:** the per-entity capture items that are universal across genres (player/avatar transform, view
> direction, health, alive, appearance). Genre files carry only genre-**specific** additions on top of this.
> This is the **checklist form**; the tracking knowledge behind it (what to track and why, attribute types,
> identity) lives in [`06-TRACKING-PATTERNS.md`](../06-TRACKING-PATTERNS.md).
>
> **Staging:** in a first wave, capture only what the moment you are curating needs; the full baseline
> applies as coverage broadens (`06 §1.1` — an iterative rollout is a staging choice, not a smaller goal).

---

## 1. Player / Avatar — CRITICAL (nearly every game)

- [ ] Position (`vec3`)
- [ ] Body rotation (`vec4` quat) — the avatar's facing
- [ ] **Look / aim direction** — where the player is *aiming/looking*, distinct from body facing. Capture it
  separately whenever look can diverge from body facing (first-person, shoulder aim, free-look); in
  third-person games it is often derivable from the avatar rotation — check before adding it.
- [ ] Velocity (`vec3`) — when movement/physics continuity matters at the restored frame (it is applied as a
  deferred property at restore, `07 §6`)
- [ ] Health (and max, if it changes). If the game has a **separate armor/shield pool**, capture it too (and
  its max).
- [ ] Is alive / dead (`bool`) — and a richer **defeat-state enum** if the game has a downed/revive cycle
  (see [shooter.md](./shooter.md) §1 and §3).
- [ ] Stance (crouch/prone/etc.) — `bool`/enum, when it changes the silhouette or capabilities at the moment
- [ ] Team / faction ID (if applicable)
- [ ] Appearance / equipped cosmetics (by content ID, never a pointer) — constant through the clip but
  **visible**; constants are normally skipped (`06 §9.3` step 1), this is the exception.

## 2. Camera / View (POV + FOV)

The captured video framing comes from the player camera, so its view state matters for a faithful first
frame.

- **View location + rotation** — usually the camera follows the avatar + the look/aim rotation above, so
  capturing the look rotation (§1) lets the game reconstruct the camera. Capture the **camera transform
  explicitly only** when the camera is decoupled from the avatar at capturable moments (spectator, free
  cam, scripted/cinematic camera).
- **Field of View (FOV)** — *recommended-but-usually-derived.* Player Flow restores a snapshot and the game
  resumes its own logic, so FOV is normally **re-derived** from captured state (aim-down-sights/zoom active,
  sprint, current weapon). **Capture FOV explicitly only when it is driven by something transient or
  scripted that the restored state will NOT reproduce** — e.g. a cutscene or temporary zoom FOV not tied to
  a captured flag. Prefer capturing the **driving state** (zoom flags) and add an explicit FOV attribute
  only if the first replayed frame's framing is visibly wrong.

## 3. Score / Progression (if the moment is competitive)

- [ ] Score / kills / deaths / objective counters — often the cleanest signal of how the player is doing.

---

These are the **universal** items. For genre-specific entities, actions, and state (weapons, creatures,
structures, units, turn state, …) load the matching genre file via [`INDEX.md`](./INDEX.md). Per-entity
**identity and restore mechanics** (stable IDs, two-pass restore, streamed-out vs. destroyed) live in
[`06-TRACKING-PATTERNS.md`](../06-TRACKING-PATTERNS.md), [`07-RESTORATION-PATTERNS.md`](../07-RESTORATION-PATTERNS.md)
and — for streaming worlds — [`open-world-tracking.md`](./open-world-tracking.md).
