---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "3,7"
question: "Does the agent's compile gate build a different configuration (Debug, an editor/tools target, a dev define set) from the one that ships — and does any integration or game code sit behind a preprocessor fence that is off in the gate's configuration (`#ifdef NDEBUG`, `#if !SHIPPING`, a platform or release-only shim)? The gate cannot see inside that block; it passes on code it never read."
sanitized: true
origin: "unity:common-mistakes/a-player-only-instrument-hidden-behind-unity-editor-is-never-compiled, unity:common-mistakes/dotnet-build-of-the-unity-csproj-cannot-catch-player-build-breaks"
---

# A compile gate cannot see code fenced out of the configuration it builds

**Precondition:** the configuration you compile-check is not the configuration that ships.

The natural way to write release-only code — a cloud log mirror, a platform shim, an OS debug-output hook — is a
fence the development build skips:

```cpp
#if defined(_WIN32) && defined(NDEBUG)          // release-only
    extern "C" __declspec(dllimport) void __stdcall OutputDebugStringW(const wchar_t*);
    void InstallCloudLogMirror() { ... }
#endif
```

If the gate builds Debug, the whole block is excluded from the only compile the agent runs. The gate reports zero
errors because there was nothing to check; a typo or bad signature inside surfaces **in the cloud**, one
build-and-upload later — the worst place, since this pattern is used almost exclusively for code that runs where you
can't watch it.

The reverse also bites. On one integration the Release build died at phase 7 with four errors, one root cause: two
**real gameplay accessors** had been swept into a trailing debug-only fenced block full of genuine debug helpers,
while being called from three unguarded runtime sites. The tell: their backing member was declared *outside* the
block. Every gate build in the session had been green — **phase 7 was the first time the shipping configuration was
ever compiled.** Expect pre-existing breakage on any project whose Release build was deferred since phase 1.

## Do this instead

- **Fence at runtime where you can.** Compile the body in every configuration and exclude it with a runtime check, so
  the gate type-checks what ships.
- **Build the shipping configuration as a gate**, not only at phase 7 — e.g.
  `cmake --build build --config Release` or `msbuild Game.sln /p:Configuration=Release` — at the start of phase 7 at
  the latest, *before* asking the user to build. It separates "pre-existing breakage" from "the integration did
  this".
- **Prove it compiled, don't infer it.** Exit code 0 doesn't distinguish "compiled clean" from "compiled an empty
  block". Check for a symbol that can only come from inside the fence (`dumpbin /symbols` or `/imports` on Windows,
  `nm`/`strings` elsewhere).
- **A new file not in the target's source list** compiles nothing and reports green — add it to the build before
  trusting the gate.

Whenever a conditional block is invisible to the gate, the gate is not guarding it — and that block is usually the
part you understand least. Related: `learnings/common-mistakes/a-green-compile-does-not-prove-your-edit-compiled.md`.
