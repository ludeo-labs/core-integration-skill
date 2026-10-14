---
category: common-mistakes
tier: generalizable
sourceGame: ActionRoguelike
phase: "1"
question: "Does the game's Ludeo session authenticate through a Steam user (implicit or explicit Steam auth mode)?"
sanitized: true
origin: "unreal:common-mistakes/steam-user-must-be-in-environment"
---

# The Steam user must be in the game's Studio Lab environment, or Ludeo creation silently fails

**Precondition:** the session authenticates with Steam (`phase 3 · task 4`, Question 1).

If the Steam user the session activates with is not a member of the game's environment in Studio Lab, creating a
Ludeo from a highlight **silently fails** — no SDK error anywhere.

**Symptoms:** session activation succeeds, highlights capture and their video uploads, the SDK log is clean, every
creator-permission signal says creation is allowed — yet creating the Ludeo in Studio Lab does nothing.

**Why it's hard:** the rejection happens on the backend, keyed on the authenticated Steam user, and nothing is
reported back to the SDK. Re-reading integration code finds nothing.

**Fix:** Studio Lab → Environments → the target environment → add the Steam user.

**How to apply:** ask during `phase 1` setup, before any test run: *"Has your Steam user been added to the game's
environment in Studio Lab?"* Membership is per environment — switching the debug target re-opens the question.
