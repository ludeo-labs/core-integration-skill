---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "6,7"
question: null
sanitized: true
origin: "unity:common-mistakes/studio-lab-triggers-and-goals-fail-silently-on-the-event-string, unity:common-mistakes/studio-lab-lists-an-action-only-after-a-build-sent-it"
---

# Studio Lab triggers and goals fail silently on the event string — and list an action only after a build sent it

Two traps in the platform-side configuration, both with **no error anywhere**: the game sends its actions, the log
shows them, and the platform simply does nothing with them.

## 1. An action exists in Studio Lab only after a build has sent it

Global Triggers, goals, constraints and score parameters are all configured by **picking an event from Studio Lab's
event list**, and that list only contains names the game has already sent at least once (Game Events shows them as
type *Action*). There's no way to type a name in. Right after phase 6 the pickers for `PauseLudeo`, `Kill` and the
rest were empty — the previous build never sent them. Order that works:

1. Build with the phase-6 actions.
2. One recording run that deliberately fires **every** action at least once — kill, die once, pause once, open a
   non-ludeoable span, clear a room, finish the level, each item and boss beat. Grep the log for each action name
   being sent.
3. Then configure triggers, goals, constraints and scoring (by hand, or through `ludeo-mcp` per
   `references/ludeo-studio-mcp.md`). Actions only a rare level can fire have to wait for a run on that level — call
   them out to the integrator with the controls needed to reach them.

## 2. In the Global Triggers list, the first column is the trigger event, not a label

A trigger row has a free-text **Description**, the **Trigger event** (the action string the platform listens for)
and the **Actionable event** (pause, resume, non-ludeoable start/end, end). The list shows the **Trigger event in its
first column**. In one integration the action strings were renamed in code, and the trigger rows were "updated" by
typing the new strings into the Description. For weeks the game sent the new names and the platform listened for the
old ones: the clock never stopped on a pause and cutscenes were never excluded.

- When checking a setup, **read the first column** (or `list_global_triggers`) and compare it character for
  character with the strings in code.
- After renaming an action, **re-create** the trigger rows on the new event; editing the description changes nothing.
- Delete stale action names so nobody builds a goal that can never complete.

## Platform behaviours worth confirming with the platform team

- Goals and constraints are **relative to the creator's run** ("more than the creator's value") — title them so
  creators aren't misled ("take no damage" means "no more than the creator took").
- A constraint failed the Ludeo on the **first** occurrence of its event although its formula read "greater than the
  creator's count". For "fewer is better", use a negative score weight or ask the platform for a threshold.
- The game never receives the creator's counts for the Ludeo window — the reader holds only the start state — so
  such limits can't be enforced game-side either.
