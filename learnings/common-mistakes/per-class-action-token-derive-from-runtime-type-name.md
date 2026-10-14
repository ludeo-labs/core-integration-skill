---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: "6"
question: "Are you deriving a per-class action-name token (Destroy<UnitClass>, Kill<EnemyType>) from a type, prefab or asset name? Derive it from the actual runtime name, strip every wrapper prefix and suffix, and log the derived token on the first few events."
sanitized: true
origin: "unreal:common-mistakes/per-class-action-token-strip-runtime-class-prefixes"
---

# Per-class action tokens: derive them from the runtime type name, and strip every wrapper layer

**Precondition:** besides a broad action (`DestroyEnemyUnit`), you emit an additive per-class action
(`Destroy<Class>`) for an allowlisted set of classes. `SendAction` carries only a player id and an action name, so
the class can live only in the name. You derive a token from the entity's type and gate it on an allowlist.

## The mistake

The token derivation was written against the **friendly short name** seen in the game's content browser
(`Family_ShipName_Variant`). The real runtime name carried a **project wrapper prefix** that view hides
(`<Wrapper>_<Family>_ShipName_Variant`, plus a generated suffix). The derivation stripped the family code and the
suffixes but not the wrapper prefix, so it produced `<Wrapper>_<Family>_ShipName` instead of `ShipName`. That never
matched the allowlist. The broad action kept firing and **hid the gap**: builds were green, and only a runtime log
of the derived token exposed it.

## Fix

- Derive the token from the **runtime** identity: the type/prefab id the entity actually carries, or its RTTI
  name. Never from a name you typed after browsing assets. If the visible entity is a proxy for another, resolve
  it first and use **its** type.
- Strip **every** layer, outermost first: the project wrapper prefix, then the family code, then variant or
  generated suffixes. (RTTI names carry their own decoration, such as `class Foo`, which also needs stripping.)
- **Log the derived token and whether it matched the allowlist on the first few events** (`token='ShipName'
  named=1`), and confirm against a real run.
- Keep the allowlist in config (for example `ludeo.ini`), seeded with the tokens your derivation **actually
  produces** for the curated classes.

## General lesson

Strings derived from a type (action tokens, `objectType`, identity keys) must be checked against the **runtime**
name. Naming conventions wrap generated types in layers that a friendly view hides. One log line per derivation
during bring-up catches the mismatch; reading the code doesn't.

Related: `learnings/architecture/additive-action-emission-for-composable-goals.md`.
