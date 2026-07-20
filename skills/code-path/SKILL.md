---
name: code-path
description: >-
  Reconstruct and interactively walk a feature's static code path inside the
  agent session. Use when the user asks for a code path, call path, walkthrough
  of what happens when an event occurs, to trace a feature, or invokes
  /code-path. Primary UX is hop-by-hop in chat with AskUserQuestion; optional
  external TUI via codepath view.
allowed-tools: AskUserQuestion Read Write Bash Grep Glob
---

# Code Path

Help the user **see** the real hop-by-hop path code takes for a feature or event — **inside this Claude/Cursor/Codex session**, without opening files one by one and without needing an external TUI.

Claude cannot embed a raw-mode terminal UI in the agent tool loop. The interactive pattern that works here (same idea as other plugins) is: show one hop → ask what to do next with **AskUserQuestion** → repeat.

## When to use

- “What’s the code path for …?”
- “Walk me through what happens when …”
- “Trace this feature / show the call path”
- `/code-path`

## Workflow

### A. Build the path

1. **Clarify** (only if needed): entry point, happy path vs error path.
2. **Reconstruct** the actual static control/call path by searching and reading code. Prefer the real sequence of hops, not a dump of related files.
3. **Write** a Path Document to `.codepath/<slug>.json` (schema: `version` 1, `title`, `query`, `repoRoot` `"."`, `steps[]` with `id`, `title`, `file`, `startLine`, `endLine`, `note`, optional `symbol` / `next` / `branches`).
4. **Validate**:
   ```bash
   codepath validate .codepath/<slug>.json --check-files
   ```

### B. Walk inside the session (default — do this)

Do **not** open an external terminal unless the user asks for the TUI.

For each hop, in order along the primary `next` spine:

1. Render the hop in chat:
   - Header: `Step N/M` · `file:start-end` · `symbol`
   - One-line why (`note`)
   - The code for that range (read the file, or run `codepath show .codepath/<slug>.json --step <id>` and paste the output)
   - Make `file:line` references clickable/openable in the IDE when the product supports it
2. Then call **AskUserQuestion** (Claude Code) with navigation choices. Cursor: use **AskQuestion** if available; otherwise list the same options and wait. Codex: numbered options in chat.

**AskUserQuestion options (adapt labels if at start/end or no branches):**

| Option | Meaning |
|--------|---------|
| Next | Follow default `next` |
| Prev | Go back one hop in history |
| More context | Re-show with ~12 lines of surrounding context |
| Open file | Open / point at `file:startLine` (Read + tell user, or `cursor`/`code -g`) |
| Branch: \<label\> | One option per `branches[]` entry when present |
| Outline | Jump: list all steps, then ask which number |
| Done | End the walk |

Rules:

- One hop per turn. Do not dump the whole path unless the user picks Done and asks for a summary, or explicitly wants `print`.
- Keep visit history so Prev works.
- At a branch point, include each branch as its own option (do not silently pick).
- After Done, offer a one-line path summary (`s1 → s2 → …`) and the Path Document path.

### C. Optional external TUI

Only if the user asks for “terminal UI”, “TUI”, or `codepath view`:

```bash
codepath view .codepath/<slug>.json
```

That opens an external terminal when the agent has no TTY. Prefer section B for normal use.

## Path Document rules

- One primary spine via `next` (usually a single successor).
- Use `branches` only for meaningful forks.
- Put uncertainty in `note`.
- Line ranges must be inclusive and point at the real symbol body.
- Prefer `.codepath/` at the repo root; suggest gitignoring it if missing.

## CLI cheat sheet

| Command | Purpose |
|---------|---------|
| `codepath validate <file> [--check-files]` | Schema + graph (+ file) checks |
| `codepath show <file> --step <id\|N> [-c n]` | Single hop for in-chat display |
| `codepath print <file>` | Full sequential dump |
| `codepath view <file>` | External/interactive TUI (optional) |
| `codepath init [title]` | Stub under `.codepath/` |

## Install check

If `codepath` is missing: install/link from the follow-code-path / code-path-skill repo (`npm install && npm link`).

## Do not

- Invent hops that are not in the codebase.
- Dump every step at once as the default UX.
- Open an external terminal by default — walk in-session first.
- Claim runtime certainty for unresolved dynamic calls (note it instead).
