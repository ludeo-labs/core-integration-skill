---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "2,4"
question: "Do levels compose entities from template / prefab / archetype files with per-instance overrides, and are you censusing a type by counting its occurrences in the level data files?"
sanitized: true
origin: "unity:engine-quirks/prefab-instance-counts-overcount-a-behaviour-that-instances-remove, unity:engine-quirks/prefab-composed-levels-hide-their-managers-from-scene-greps, unity:engine-quirks/scene-script-guid-counts-overcount-via-stripped-prefab-components"
---

# A static level census is a hypothesis until the runtime enumerator confirms it

Applies when level files instance entities from templates and store only per-instance overrides. Grepping level data
is the cheap phase-2/phase-4 census, and it miscounts in three distinct ways — in both directions.

## 1. Zero hits means "composed from a template", not "absent"

A level built from template instances stores the template reference plus its overrides — not the template's
components. A manager living in a template returns **zero** hits in the level file. Read that as "not authored into
the level directly", never as "this level has no such manager"; the wrong reading sends you looking for a bootstrap
that does not exist. Look up in two steps: which **templates** host the component, then which **levels** instance
those templates (and, for nested templates, which templates instance *them*). Read per-instance configuration from
the template plus the instance's overrides — reading only the level returns template defaults.

## 2. Counting template instances overcounts a behaviour an instance removed

The census for oscillating platforms counted instances of the one template that hosts the oscillator: **11**. It was
approved at the census gate and a whole tracked type was scoped on it. At runtime the enumerator found **2**. Both
numbers were right: nine instances carry a **removed-component override** deleting the oscillator, used as static
scenery. Resolve each instance's removal list against the template's component before counting, and report two
numbers — *instances of the template* and *instances that still carry the behaviour*. **Don't trust names**: one
stripped instance kept the moving-platform name, so a name filter would still have been wrong.

## 3. Bookkeeping entries overcount

Some formats leave **placeholder entries** for an instance's components in the level file (cross-reference stubs that
point at no object in the level). Counted naively they inflate the census; in one level this filter changed three
rows, two of them in opposite directions. Count only entries attached to a real object.

## The real fix: make the enumerator report what it saw

None of these were caught by the human reviewing the census — the reviewer saw a plausible number with no way to see
the overrides. What caught them was the **first runtime registration log**: each batch-registration sweep printing
`saw N` next to the plan's expected N in `OBJECT_TRACKING.md`. The same line found the opposite error too (166 seen vs
148 planned — ids baked into templates that never appear as level overrides) and an `unclassified=9` bucket that
exposed a "singleton" which was really nine entities inside one UI template.

**Neither discrepancy was a capture defect.** When the log disagrees with the plan, instrument first, then decide which
is wrong — here the code was right both times and the plan needed amending.
