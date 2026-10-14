# Writing Learnings Without Leaking Client Code

This skill accumulates learnings from real integrations. Those integrations are for **clients** — third-party
studios whose engine source, class names, file layout, build setup and internal architecture are **their
proprietary IP**. A learning is read on *future* integrations for *other* clients (and, in time, served from a
shared vector database). **Anything client-specific that survives into a learning is a leak of one client's code to
every other client.**

The rule below is **client-agnostic on purpose.** It is not a denylist of one studio's symbols — those are worthless
the moment a second client arrives. It is a discipline you apply to *every* learning regardless of which game it came
from.

---

## The principle: pattern, not payload

> **A learning captures the transferable pattern. It never reproduces the client's payload.**

The value of a learning is the *mechanism* — "the enemy's stat init runs on its first update, after the restore
applied health, so apply health in `ApplyDeferred()` instead." That sentence transfers to any C++ engine and exposes
nothing. The leak is everything *around* the mechanism: the client's real class and namespace names, verbatim method
bodies, `file.cpp:line` references, commit hashes, module-export macros, build-target and asset names, and the
studio/title name. None of that teaches anything the neutral version doesn't.

Sanitize **as you write.** A learning is never "cleaned up later" — by then it is already in the corpus.

**The test for every learning, before you save it:**

> *Could a reader name the client studio or game from this file, or copy-paste anything that belongs to them?* If
> yes → it is not sanitized. Fix it.

---

## What to strip — three tiers

| Tier | Element | Why it leaks | Action |
|---|---|---|---|
| **1 — Attribution** (zero transfer value) | Studio / game / title names; the client's root **namespace**; client class **prefixes** (a 2–4 letter `XxxClassName` convention); `<STUDIO>_API` export macros; `file.cpp:line` / `file.h:line` for *game* source; commit hashes; branch names; build-target, library, internal tool and module names; level, asset and data-file names that identify the title | Directly names the client or their content | **Delete**, or replace with a neutral role descriptor. |
| **2 — Payload** (the real leak) | Verbatim client method bodies; struct / enum field layouts; callback or event-set enumerations; save-file layouts; private-member inventories of a client class | Is literally the client's source, copyable as-is | **Rewrite as a minimal synthetic illustration** using neutral role-based names — show the *shape*, not their source. |
| **3 — Keep** (not proprietary; IS the lesson) | Ludeo SDK symbols (`ludeo_Session_*`, `ludeo_Room_*`, `ludeo_DataReader_*` / `ludeo_DataWriter_*`, `ludeo_GameplaySession_Begin` / `End`, handle types, result codes…); this skill's own vocabulary (`LudeoManager`, `LudeoStateAdapter`, `IsRestoring()`, `SendAction`, `ApplyDeferred()`…); the C++ standard library and public OS / graphics / build-tool APIs (`std::`, Win32, CMake, MSBuild…) | Public API shared by everyone | **Leave verbatim** — this is what the learning teaches. |

Source coordinates and commit hashes have **no transfer value** even when they are not strictly secret — they only
point back at one client's repo. Strip them always. (References into the **Ludeo SDK's own** headers or source —
`ludeo/<header>.h:NN` — are acceptable, because the SDK is the shared surface every integration uses.)

---

## Neutral naming convention

When you replace a client identifier, **encode the _role_ and drop the client signature.** The role is what makes a
pattern transfer; the signature is the leak.

| Don't write | Write |
|---|---|
| `AcmeCrateEntity` (a client container class) | `ContainerEntity` |
| `acme::combat::WeaponSystem` (client namespace) | `WeaponSystem` (drop the namespace) |
| `struct AcmeDamageEvent { … }` | `struct DamageEvent { … }` with only the fields the lesson needs |
| `enum class AcmeMatchPhase { … }` | `enum class MatchPhase { Warmup, Playing, Ended }` |
| `ACMEGAME_API` | `GAME_API` |
| `AcmeEnemy.cpp:8333` | *(delete — cite no file/line)* |
| commit `a10dc11` | *(delete — "a later commit")* |
| the studio name, the game's title, an iconic mode/mechanic/enemy name | "the game", "the game team", "the mission", "a level", a generic role descriptor |

If a learning genuinely generalizes across several real classes, say so by **archetype**, not by name: *"validated
across three trackable archetypes — a pooled projectile, a pickup, and a destructible prop"* instead of listing the
client's three class names.

**Watch the giveaways that aren't class names.** Proper nouns and iconic mechanic names identify a title even without a
prefix — an enemy archetype's nickname, a signature mode or phase name, a recognizable objective verb. Map these to
neutral role descriptors (`heavy enemy` → `EnemyType::Heavy`; a signature mode → `MatchState` / `WavePhase`; a
signature objective verb → a generic `DeviceActivated` / `AreaCleared`). If a term would let a fan name the game,
neutralize it.

---

## Concrete before/after

The example below uses an obviously-fictional placeholder prefix (`Acme`). Real learnings come from real clients —
never reproduce a real prefix even as a "bad example"; a real symbol in the "before" block leaks just as surely as one
in a learning.

**Before — leaks the client (do not do this):**

```cpp
// Acme-team-authored spawn hook — re-applies the loadout on the first update
void acme::player::AcmePlayerCharacter::OnFirstUpdate()   // AcmePlayerCharacter.cpp:412
{
    AcmeLoadoutManager::Get().ApplyDefault(*this);
}
```
> Findings spanned `AcmePlayerCharacter`, `AcmeEnemyDrone`, `AcmeTurret` …

**After — same lesson, no leak:**

```cpp
// Game-authored spawn hook — re-applies the default loadout on the first update
void PlayerCharacter::OnFirstUpdate()
{
    LoadoutManager::Get().ApplyDefault(*this);   // runs after the restore's apply
}
```
> Validated across three spawn archetypes: a player character (loadout re-applied on its first update, so the
> restored loadout must go through `ApplyDeferred()`), a pooled enemy (reused instance — restore must reset, not assume
> fresh), and a static turret (trivial).

The reader still learns the mechanism, the ordering rule and the pooled-instance caveat — and cannot tell which game it
came from.

---

## Frontmatter

- `sourceGame:` — **must be an abstract codename from the allowlist** in `config/learning-policy.json`. A real studio
  or title name in this field is itself a leak and fails validation. A new client gets a new codename, added to the
  allowlist at the start of the engagement (phase 1), before the first learning is written.
- `sanitized: true` — your explicit attestation that you ran the checklist below. Learnings without it are treated as
  unreviewed.

---

## Pre-save checklist

Run this on **every** learning before writing it:

- [ ] No studio / game / title names, anywhere (body, comments, prose, logs).
- [ ] No client namespace, class prefix or `<STUDIO>_API` macro — neutral role-based names only.
- [ ] No `game-source.cpp:line` / `.h:line`, no commit hashes, no branch names.
- [ ] No build-target, library, level, asset or data-file names that identify the title.
- [ ] No internal tool / module / pipeline names.
- [ ] No iconic mode / mechanic / enemy proper nouns that identify the title.
- [ ] No verbatim client method body, struct layout, event set, save layout or private-member list — synthetic
      illustration only.
- [ ] Ludeo SDK, this skill's vocabulary and public C++ / OS / tool identifiers kept as-is (these are the lesson).
- [ ] `sourceGame:` is an allowlisted codename; the body matches it (nothing real bleeds through).
- [ ] `sanitized: true` set.
- [ ] **The test:** a reader cannot name the client, and cannot copy anything that's theirs.

---

## Keep public-sample names as-is

Class and asset names from **public, open-source or sample** games (engine vendors' published samples, open-source
game projects) are **not** client IP and may be **left unchanged** — renaming them loses real, citable reference
points. When in doubt whether a name is a public sample or a client symbol, treat it as a client symbol and neutralize
it.

---

## Corpus consistency (maintainers)

The same client class must map to the **same** neutral name in every learning, or the corpus stops agreeing with
itself. The fixed client→neutral mapping is a **maintainer-only** reference and is deliberately **not shipped in this
repo** (it would itself be a catalog of client symbols); it lives in the untracked maintainer notes shared with the
Unity and Unreal skills — a client is a client regardless of engine. When sanitizing a new engagement, add its mapping
there — never to this published file.
