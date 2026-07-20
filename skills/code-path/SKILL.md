---
name: code-path
description: >-
  Interactively walk a feature's static code path hop-by-hop inside this session
  using AskUserQuestion after every step. Use for code path, call path, what
  happens when, trace feature, or /code-path.
allowed-tools: AskUserQuestion, Read, Write, Bash, Grep, Glob
---

# Code Path (in-session walk)

You are running an **interactive walkthrough inside Claude**. Not a dump. Not an external TUI.

## Hard rules (non-negotiable)

1. After the Path Document exists and validates, show **exactly one hop**, then **immediately** call **AskUserQuestion**.
2. **Never** show hop N+1 until AskUserQuestion returns an answer for hop N.
3. **Never** dump the full path (`codepath print` of everything, long multi-file paste, or a prose tour of all steps) unless the user chooses **Done** and then asks for a summary.
4. **Never** end your turn after only writing `.codepath/*.json` — the turn must end on an **AskUserQuestion** (or Done summary after they quit).
5. **Do not** run `codepath view` unless the user explicitly asks for a terminal/TUI.

If you catch yourself about to list every file in the path: stop. Show only the current hop + AskUserQuestion.

## Phase A — Build (silent prep)

1. Find the real entry → call/control chain for the user's feature/event.
2. Write `.codepath/<slug>.json` (`version` 1, `title`, `query`, `repoRoot` `"."`, `steps` with `id`, `title`, `file`, `startLine`, `endLine`, `note`, optional `symbol`/`next`/`branches`).
3. Run: `codepath validate .codepath/<slug>.json --check-files` and fix until OK.

## Phase B — Interactive walk (required)

Start at the first step. Keep a visit history for Prev.

### Each hop

1. Render **only this hop** in the message:
   - `Step N/M` · `file:startLine-endLine` · symbol
   - `note` (one short paragraph)
   - Code for that range — prefer:
     ```bash
     codepath show .codepath/<slug>.json --step <id> -c 3
     ```
     and include that output (or Read the file range yourself).
2. **Immediately** call AskUserQuestion:

**header:** `Code path` (≤12 chars)

**question:** `What next? (step N/M — <short title>)`

**multiSelect:** false

**options** (omit ones that do not apply):

| label | description |
|-------|-------------|
| Next | Follow the default next hop |
| Prev | Go back one hop |
| More context | Re-show this hop with more surrounding lines |
| Open file | Focus/open `file:startLine` |
| Branch: \<label\> | Only if this step has that branch — one option per branch |
| Outline | List steps and jump to a number |
| Done | End the walkthrough |

3. Handle the answer, then either re-show the same hop, move, or finish. After every move (except Done), AskUserQuestion again.

### Done

When they choose Done: one-line spine `s1 → s2 → …`, path to the JSON, stop asking.

## Phase C — Optional TUI

Only if they ask: `codepath view .codepath/<slug>.json`

## Anti-patterns

- Summarizing the whole feature flow in one reply “for convenience”
- “Here’s the path” with 5+ file sections and no AskUserQuestion
- Telling the user to run commands instead of walking in-session
