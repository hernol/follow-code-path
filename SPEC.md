# Code Path — Product & Technical Spec

**Version:** 1.0  
**Status:** Normative for v1 implementation

## 1. Problem

When AI agents write most of the code, humans often do not remember (or never learned) the call path that implements a feature. Understanding “what happens when X” usually means manually opening file after file and chasing function calls. That is slow and easy to lose place in.

## 2. Goals

1. Let a user ask an agent to reconstruct the **code path** for a feature, event, or behavior.
2. Persist that path as a machine-readable **Path Document**.
3. Walk the path in an **interactive terminal UI** that shows file, line range, and code for each hop — similar in spirit to reading a focused `git diff` hunk sequence.
4. Support keybindings to navigate hops, expand context, open the file in an editor, and follow branches.
5. Work with **Cursor Agent** (skill) and **Claude Code** (skill) via one shared skill body and one CLI.

## 3. Non-goals (v1)

- Live process attach, breakpoints, or runtime instrumentation.
- Automatic whole-repo call graphs without a user query.
- IDE-native plugin UI (terminal-first; editor integration is “open at line”).
- Guaranteed resolution of dynamic dispatch, reflection, or DI containers (agent must note uncertainty in the step `note`).
- Multi-user sync or Path Document hosting.

## 4. User stories

1. As a developer, I ask “walk me through what happens when a user clicks Place Order” and get an interactive hop-by-hop walkthrough.
2. As a developer, I press `+` to see more surrounding context without leaving the walker.
3. As a developer, I press `o` to open the current hop in my editor at the right line.
4. As a developer, when the path forks (success vs error), I press `b` and pick which branch to follow.
5. As an agent, I emit a validated Path Document and launch (or hand off) `codepath view`.

### Example prompts

- “What’s the code path for checkout?”
- “Walk me through what happens when a webhook arrives.”
- “Trace this feature: password reset email.”
- “Show the call path from `POST /api/orders` to the database write.”
- `/code-path` then describe the feature.

## 5. Architecture

```
User query
    │
    ▼
┌─────────────────────────┐
│ Cursor / Claude skill   │  static search + read + reconstruct path
└───────────┬─────────────┘
            │ writes
            ▼
┌─────────────────────────┐
│ Path Document (.json)   │  contract between agent and CLI
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ codepath CLI            │  validate | print | view
│  └─ interactive TUI     │
└───────────┬─────────────┘
            │ o / editor
            ▼
      External editor
```

**Boundaries**

| Component | Responsibility |
|-----------|----------------|
| Skill | Discover path, write Path Document, invoke CLI when possible |
| Path Document | Portable, versioned description of hops |
| `codepath validate` | Schema + referential integrity checks |
| `codepath print` | Non-interactive sequential dump (for chat / no TTY) |
| `codepath view` | Interactive TUI walker |
| Editor | Opened by TUI; not part of this package |

**Path discovery model (v1):** static reconstruction by the agent. Not a debugger.

## 6. Path Document schema (normative)

JSON file. JSON Schema lives at [`schemas/path-document.schema.json`](schemas/path-document.schema.json).

### Top-level object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `1` | yes | Schema version. Only `1` in v1. |
| `title` | string | yes | Short human title for the walkthrough. |
| `query` | string | yes | Original user question / intent. |
| `repoRoot` | string | yes | Repo root relative to which `file` paths resolve. Usually `"."`. |
| `createdAt` | string (ISO-8601) | no | When the document was generated. |
| `steps` | Step[] | yes | Non-empty list of hops. |

### Step object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique within the document (e.g. `s1`). |
| `title` | string | yes | Short label for the hop. |
| `file` | string | yes | Path relative to `repoRoot`. |
| `startLine` | integer ≥ 1 | yes | Inclusive start line. |
| `endLine` | integer ≥ startLine | yes | Inclusive end line. |
| `symbol` | string | no | Function/class/method name if known. |
| `note` | string | yes | Why this hop is next; uncertainty belongs here. |
| `next` | string[] | no | Default successor step ids (usually one). Empty / omitted = terminal. |
| `branches` | Branch[] | no | Named alternate successors. |

### Branch object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | yes | e.g. `"validation error"`. |
| `next` | string | yes | Step id to jump to. |

### Integrity rules

1. Every id in `next` and `branches[].next` must refer to an existing step.
2. `steps` must be non-empty.
3. Files should exist when `validate --check-files` is used (optional flag; default on for agent workflow).
4. Line ranges should be within file length when file checks are enabled.
5. Prefer one primary linear spine via `next`; use `branches` only for meaningful forks.

### Example

See [`examples/sample-path.json`](examples/sample-path.json).

## 7. Presentation modes

### In-session walk (default for agents)

Primary UX inside Claude Code / Cursor / Codex:

1. Show one hop (header + note + code).
2. Ask the user what to do next via **AskUserQuestion** (Claude), **AskQuestion** (Cursor), or numbered chat options (Codex).
3. Repeat until Done.

This is how interactive plugins work inside Claude: structured choices in the session, not an embedded raw-mode TUI.

### External TUI (optional)

`codepath view` for a classic terminal walker. When stdin is not a TTY, spawn an external emulator unless `--here` is set.

```
codepath │ Checkout: place order                    Step 3/12
────────────────────────────────────────────────────────────────
src/api/orders.ts:42-67  ·  createOrder
────────────────────────────────────────────────────────────────
Validates payload, loads cart, then persists the order row.
────────────────────────────────────────────────────────────────
  40 │
  41 │ export async function createOrder(req, res) {
▶ 42 │   const body = orderSchema.parse(req.body);
▶ 43 │   const cart = await loadCart(body.cartId);
 ... │   ...
▶ 67 │   return res.json(order);
  68 │ }
────────────────────────────────────────────────────────────────
j/n next  k/p prev  +/- context  c more  o open  b branch  g jump  y yank  q quit
```

- Focused range is marked (e.g. `▶` or reverse video).
- Context lines outside the range are dimmer.
- Footer always shows bindings.

### Keybindings (v1)

| Key | Action |
|-----|--------|
| `j` / `↓` / `n` | Follow default `next` (or history forward) |
| `k` / `↑` / `p` | Previous hop in visit history |
| `+` / `-` | Expand / shrink context lines around the range |
| `c` | Toggle extra context mode (larger default context) |
| `o` | Open `file:startLine` in editor |
| `b` | Branch picker when `branches` is non-empty |
| `g` | Outline / jump to step by number |
| `y` | Copy `file:startLine` to clipboard when possible |
| `q` / `Esc` | Quit |

### Editor open order

1. `CODEPATH_EDITOR` if set (supports `{file}` and `{line}` placeholders).
2. `cursor -g file:line` if `cursor` is on PATH.
3. `code -g file:line` if `code` is on PATH.
4. `$EDITOR +line file` (best-effort).
5. Print the path and instruct the user.

### TTY behavior

- In-session walk does not need a TTY.
- `codepath view` without a TTY opens an external terminal by default; use `--here` to require the current TTY.

## 8. CLI surface

```
codepath <command>

codepath validate <file> [--check-files] [--repo-root <dir>]
codepath show     <file> --step <id|N> [--context <n>]
codepath print    <file> [--repo-root <dir>] [--context <n>]
codepath view     <file> [--repo-root <dir>] [--context <n>] [--here|--external]
codepath init     [title]   # writes a stub Path Document to stdout or .codepath/
```

| Command | Purpose |
|---------|---------|
| `validate` | Schema + graph integrity; optional file/line checks |
| `show` | Single hop for in-chat walkthroughs |
| `print` | Sequential diff-style dump to stdout |
| `view` | Optional external/interactive TUI |
| `init` | Stub document for agents / manual starts |

Exit codes: `0` success, `1` validation/usage error, `2` I/O error.

## 9. Skill workflow (Cursor Agent & Claude Code)

Shared skill: [`skills/code-path/SKILL.md`](skills/code-path/SKILL.md).

Install:

- Cursor: symlink/copy to `~/.cursor/skills/code-path`
- Claude Code: symlink/copy to `~/.claude/skills/code-path`
- Codex: `~/.agents/skills/code-path`

### Agent steps

1. Clarify entry point / success vs error path if ambiguous.
2. Search and read code; reconstruct the **actual** control/call path.
3. Build steps with real `file` / line ranges / `symbol` / `note`.
4. Write to `.codepath/<slug>.json`; `codepath validate --check-files`.
5. **Walk in-session**: show one hop, then AskUserQuestion (Next/Prev/More context/Branch/Done).
6. Only if the user asks for a terminal UI: `codepath view`.

### Triggers

Phrases: “code path”, “walk me through”, “trace this feature”, “what happens when…”, “show the call path”, `/code-path`.

## 10. Installation & packaging

- Node.js ≥ 20.
- Package name: `codepath` (bin: `codepath`).
- Local: `npm install` then `npm link` or `npx tsx src/cli.ts`.
- Skills are markdown + instructions; CLI is the executable dependency.

## 11. Acceptance criteria (v1)

- [ ] `SPEC.md`, JSON Schema, and sample Path Document exist and agree.
- [ ] `codepath validate` accepts the sample and rejects broken graphs / bad ranges.
- [ ] `codepath print` shows sequential file:line headers and code snippets.
- [ ] `codepath view` supports next/prev, +/- context, `c`, `o`, `b`, `g`, `y`, `q`.
- [ ] Shared skill documents the agent workflow for Cursor and Claude.
- [ ] README covers install, usage, and agent invocation.

## 12. Stretch (post-v1)

- LSP / language-server assisted jump-to-definition hints for agents.
- Runtime traces (OpenTelemetry, debug logs) imported into Path Documents.
- Side-by-side dual-path compare.
- HTML export of a walkthrough.
- Syntax themes and mouse support.
