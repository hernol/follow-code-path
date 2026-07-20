---
name: code-path
description: >-
  Reconstruct and interactively walk a feature's static code path. Use when the
  user asks for a code path, call path, walkthrough of what happens when an
  event occurs, to trace a feature, or invokes /code-path. Writes a Path
  Document JSON and opens the codepath TUI (or print fallback).
---

# Code Path

Help the user **see** the real hop-by-hop path code takes for a feature or event — without opening files one by one.

## When to use

- “What’s the code path for …?”
- “Walk me through what happens when …”
- “Trace this feature / show the call path”
- `/code-path`

## Workflow

1. **Clarify** (only if needed): entry point, happy path vs error path.
2. **Reconstruct** the actual static control/call path by searching and reading code. Prefer the real sequence of hops, not a dump of related files.
3. **Write** a Path Document to `.codepath/<slug>.json` matching the schema in this repo (`schemas/path-document.schema.json`). Required fields: `version` (1), `title`, `query`, `repoRoot` (`"."` when run from repo root), `steps[]` with `id`, `title`, `file`, `startLine`, `endLine`, `note`, and optional `symbol`, `next`, `branches`.
4. **Validate**:
   ```bash
   codepath validate .codepath/<slug>.json --check-files
   ```
   Fix any issues (missing files, bad line ranges, unknown `next` ids) before continuing.
5. **Open the interactive walker** (always do this — do not stop at “run this yourself”):
   ```bash
   codepath view .codepath/<slug>.json
   ```
   Agents usually have **no TTY**. `codepath view` detects that and **opens a real terminal window** (kitty, gnome-terminal, Terminal.app, etc.) with the TUI. Tell the user that a walkthrough window was opened and remind them of keys: `j`/`n` next, `k`/`p` prev, `+/-` context, `o` open, `b` branch, `q` quit.

   Only if that command fails (exit non-zero / could not spawn a terminal):
   - Run `codepath print .codepath/<slug>.json` into the chat as a fallback summary.
   - Then tell them: `codepath view --here .codepath/<slug>.json` in their own terminal, or set `CODEPATH_TERMINAL` (e.g. `kitty -e {cmd}`).

## Path Document rules

- One primary spine via `next` (usually a single successor).
- Use `branches` only for meaningful forks (auth failure, validation error, etc.).
- Put uncertainty in `note` (e.g. dynamic dispatch you could not prove).
- Line ranges must be inclusive and point at the real symbol body.
- Prefer `.codepath/` at the repo root; suggest adding `.codepath/` to `.gitignore` if missing.

## Stub helper

```bash
codepath init "Checkout place order" --query "What happens on Place Order?"
```

## CLI cheat sheet

| Command | Purpose |
|---------|---------|
| `codepath validate <file> [--check-files]` | Schema + graph (+ file) checks |
| `codepath print <file>` | Non-interactive sequential walkthrough |
| `codepath view <file>` | TUI; auto-opens external terminal when no TTY |
| `codepath view --here <file>` | Force TUI in the current terminal |
| `codepath view --external <file>` | Always spawn an external terminal |
| `codepath init [title]` | Stub document under `.codepath/` |

## TUI keys (tell the user)

`j`/`n` next · `k`/`p` prev · `+`/`-` context · `c` extra context · `o` open in editor · `b` branch · `g` jump · `y` yank `file:line` · `q` quit

## Install check

If `codepath` is missing on PATH, install/link this package from the code-path-skill repo (`npm install && npm link`) or run via `npx tsx <path-to-repo>/src/cli.ts …`.

## Do not

- Invent hops that are not in the codebase.
- Emit a Path Document without validating when `codepath` is available.
- Stop after writing the JSON and only print “run `codepath view` locally” — always invoke `codepath view` yourself so it can spawn the external terminal.
- Attach a live debugger or claim runtime certainty for unresolved dynamic calls.
