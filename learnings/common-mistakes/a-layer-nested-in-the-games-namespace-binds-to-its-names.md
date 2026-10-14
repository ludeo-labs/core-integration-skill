---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "3"
question: "Is the Ludeo integration layer being placed in a namespace nested under the game's root namespace? Then grep that root for types named like common library or framework names (Object, Time, Random, Environment, Log, Input, Debug, Assert)."
sanitized: true
origin: "unity:engine-quirks/layer-namespace-can-silently-inherit-the-games-base-types"
---

# A layer nested in the game's namespace binds to the game's names, not the ones you meant

Applies when the integration layer lives inside the game's namespace tree. C++ unqualified name lookup walks
**outward through the enclosing namespaces** before it reaches the global namespace, and a name found there hides
anything you pulled in with a `using` declaration at global scope. From inside `GameRoot::LudeoIntegration`, an
unqualified name resolves to `GameRoot::`'s version first.

```cpp
namespace GameRoot {
    class Object { public: virtual ~Object() { ResourceManager::Release(this); } };  // the game's base
    class Environment { /* gameplay weather/biome */ };
}

namespace GameRoot::LudeoIntegration {
    class LudeoRuntime : public Object { /* ... */ };   // binds to GameRoot::Object — you meant your own base
    // Environment::... here means the gameplay class, not whatever you had in mind
}
```

## Two shapes

(Both were observed in one integration whose layer lived in a language with the same outward lookup rule; the C++
shapes below are the same mechanism.)

- **It compiles and runs.** The layer's runtime object derived from what was meant to be its own or a library base and
  silently got the game's base instead. Everything still worked, but the layer had acquired a dependency on a game
  class it was designed not to depend on — plus that class's destruction behaviour (releasing through the game's
  resource manager, wrong for a Ludeo-owned object that must outlive levels). The only signal was **one warning**, in
  a log carrying thousands, about a member hiding an inherited one — in C++ the "hides overloaded virtual function"
  family (clang/gcc `-Woverloaded-virtual`; MSVC C4263/C4264 when enabled). Such a warning on a method you never meant
  to override is proof you are not deriving from the type you think you are.
- **A hard compile error naming a member you know exists** — "`Write` is not a member of `GameRoot::Log`" — which
  reads like a missing include and is actually the wrong type entirely.

Games shadow these names routinely; they are natural gameplay nouns. `Random` and `Time` shadows are the quietest,
because they usually still compile.

## The rule

- **Prefer a layer namespace that is not nested under the game's root** for `LudeoManager`, `LudeoStateAdapter` and
  their helpers. If it must nest, **qualify** every library/framework name you rely on (`::`, `std::`, the engine's
  own namespace).
- **Before writing the layer, grep the game's root namespace for shadowing declarations** and treat every hit as a
  name to qualify:
  ```
  grep -rnE "(class|struct|enum class|using) (Object|Environment|Random|Time|Log|Debug|Input|Assert|Application|Screen|Camera)\b" --include=*.h --include=*.hpp <game-src>
  ```
- **Filter the compile log to warnings from the layer's own files.** In a codebase with thousands of warnings, the
  layer's slice is the only actionable part; target zero there.

Related: `learnings/common-mistakes/a-green-compile-does-not-prove-your-edit-compiled.md`.
