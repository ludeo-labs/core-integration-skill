---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "2"
question: "Does the target build configuration (shipping, demo, the build that goes to the cloud) use a different preprocessor define set from the configuration you read and run in — e.g. one that turns dev tools off?"
sanitized: true
origin: "unity:common-mistakes/verify-the-define-fence-before-citing-a-hook"
---

# A hook is only real if its `#if` fence is defined in the TARGET build

Applies when the build you ship defines different symbols from the one you develop in. While mapping, a promising
hook turned up inside a core manager's per-frame update: a clean check that suppressed gameplay input whenever any UI
page was open. It read exactly like the game-owned input gate a restore freeze or the overlay pause should reuse — so
it went into `CODE_MAP.json` as one.

It was wrong. Four lines further up:

```cpp
void GameManager::Update()
{
#if GAME_DEV_TOOLS
    if (m_input && m_ui && m_ui->OpenPageCount() == 0)
        m_input->ProbeInput();          // debug-only input probe
#endif
    // ... real per-frame work continues here, unfenced
}
```

Two independent reasons it was not the gate:

1. **It is fenced.** The target build was a demo configuration whose define set turns the dev-tools symbol **off** —
   the block does not exist in the shipping binary.
2. **Even when compiled, it gates the wrong thing** — a debug probe, not the player's input.

The actual input authority was elsewhere: a dedicated input system arbitrating between named action maps, with a
highest-priority "prevent input" switch — a better hook, and one that ships.

## Why this is easy to get wrong

Grep output is line-oriented: a match shows the line, not the preprocessor context. In the development configuration
the fenced code compiles and looks live, so even a runtime spot-check can confirm a hook that will not exist in the
build you ship. The failure is quiet and asymmetric: the integration works in development and silently no-ops in the
target build.

## The check

Before recording any hook in `CODE_MAP.json` — or building on one later:

1. **Read the surrounding lines, not just the match.** Look upward for `#if` / `#ifdef`, and find where the matching
   `#endif` lands. `grep -B 10` costs nothing.
2. **Resolve the fence against the TARGET configuration's defines** — the project files, CMake presets or build
   scripts for that configuration — not the one you are running. A variant define often *disables* a dev-tools
   define, so check the configuration, not just the symbol's name.
3. **Ask whether the fenced code is even the thing you think it is.** Debug probes often mirror the shape of real
   logic while doing something adjacent.
4. **When a fenced hook genuinely is the best site**, say so and record what must change (unfence it, or add a
   Ludeo-owned equivalent behind the integration's own macro, CR-001) — don't quietly depend on it.

## Record the correction

If a fenced hook already went into an artifact, **fix the entry and leave a correction note naming the fence**. The
next phase reads the artifact, not the conversation — an uncorrected entry is a trap for whoever picks it up.

Related: `learnings/common-mistakes/investigate-before-asking.md` — never assert what you have not checked. The
check here is four lines of context.
