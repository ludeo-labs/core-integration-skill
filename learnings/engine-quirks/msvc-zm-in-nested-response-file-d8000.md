---
category: engine-quirks
tier: generalizable
sourceGame: StackOBot
phase: "1,3"
question: "Does the build pass /Zm to MSVC's cl.exe through a response file that is itself referenced from another response file (@a.rsp containing @\"b.rsp\")?"
sanitized: true
origin: "unreal:engine-quirks/zm-flag-in-nested-rsp-d8000-ue58"
---

# MSVC: `/Zm` inside a nested response file makes cl.exe fail with D8000

**Precondition:** the build system writes compiler arguments into response files and **nests** them — a per-file
`.rsp` that includes a shared per-module `.rsp` via `@"shared.rsp"` — and the shared one contains `/Zm<N>` (the
PCH memory-allocation factor, often added by a machine-wide build setting rather than the project).
Observed with MSVC toolset 14.44 (cl 19.44).

## Symptom

Every module compile fails immediately with:

```
cl : Command line error D8000 : UNKNOWN COMMAND-LINE ERROR
```

— while other actions in the same build (e.g. the shared precompiled-header compiles, whose response files are
flat) succeed. D8000 gives no further detail.

## Root cause (bisected)

`cl.exe` rejects `/Zm` specifically when it arrives through a **nested** response file:

- `/Zm50` directly in the top-level response file → accepted;
- other flags (e.g. `/W4`) in the nested file → accepted;
- `/Zm50` in the nested file → D8000, every time.

Minimal repro: `b.rsp` = `/Zm50`; `a.rsp` = `@"b.rsp"` `/c` `t.c`; `cl @a.rsp` → D8000. Note that cl prints its
banner **before** the error — judging success from the first lines of output hides it.

## Fix

Remove the source of `/Zm` for this build: the machine-wide or user-level build configuration that sets the PCH
memory factor, or the project setting that emits it. It mattered on low-memory machines; on modern hardware it is
usually vestigial. If other projects on the machine need it, back the config up, strip the setting, build, and
restore it afterwards — and record that in the integration notes.

## Recognize it fast

- D8000 on module compiles with successful compiles elsewhere in the same build.
- `grep -n "/Zm" <shared>.rsp` → present? Then find who adds it.
- Check the build's response-file chain: a first line of `@"…rsp"` in a per-file response file means nesting.
