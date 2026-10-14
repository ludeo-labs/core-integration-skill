---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "1,2,3,4,5,6,7,8"
question: null
sanitized: true
origin: "unity:common-mistakes/ask-what-your-check-cannot-see, unity:common-mistakes/a-scenes-yaml-does-not-list-what-its-prefabs-contain"
---

# Ask what your check *cannot* see, not just what it returned

A check that returns "nothing found" is only evidence if it was capable of finding the thing. Repeatedly, conclusions
were drawn from checks **structurally incapable** of returning anything else:

| The check | What it returned | Why it could not have said otherwise |
|---|---|---|
| `Select-String -Pattern '\[Ludeo\]' -SimpleMatch` | "0 lines" on logs holding hundreds | `-SimpleMatch` takes the pattern literally — it searched for backslashes |
| `grep -i "crash\|fatal\|c0000005\|Access violation"` | "no crash markers" → *"a hang, not a crash"* | the real crash was `0xc0000008`, not in the list |
| grep of a level file for a media-player component | "none in this level" | it arrives at runtime inside a UI template the level references |
| parse of a level file's entity/component records | "13 types, 73 components, no enemies" | entities instanced from templates store only overrides in the level file; a restore of a Ludeo from that level reported `enemies matched=16` |
| slicing a status listing **by line number** | wrong counts, twice | status was a **column**, not a section — rows interleave |

Each is a true statement about the command and a false statement about the world. The "no enemies" one was reported to
the integrator before being checked, and had to be retracted.

## The habit

Before treating a negative result as a finding, ask: *what would this check fail to see, even if the thing were there?*

- **Validate the check on a case where you know the answer.** A working machine's log would have exposed the broken
  pattern instantly.
- **Use a positive control.** Grep for something certainly present; if that returns zero too, the check is broken.
- **Widen once before concluding.** Match the *shape* (`EXCEPTION_`, `0xc0000[0-9a-f]*`), not a list of codes you
  thought of.
- **Static file ≠ runtime.** A level or template parse answers "what is serialized here", never "what exists at
  runtime". Cross-check against ground truth you usually already have: the restore's matched counts, the capture's
  registration line (`N enemies + M world objects`), any runtime sweep.
- **State the method with the finding** — "parsed from the level file, not observed at runtime" marks it provisional.

## Why it earns its own entry

`learnings/common-mistakes/a-guard-that-cannot-fire-is-not-evidence.md` is about a guard **in the code**. This is
about **your own tooling** — the grep you wrote seconds ago, which feels trustworthy for exactly that reason. The tell:
you are explaining *away* a result that contradicts something someone already told you. Re-check the instrument first.
