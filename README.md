# codepath

Interactive **code path** walker for humans who did not write (or no longer remember) the call chain. Cursor, Claude Code, and Codex reconstruct a feature’s static path into a Path Document; you walk it hop-by-hop in the terminal — file, lines, and code — with keybindings for context, branches, and open-in-editor.

See [SPEC.md](SPEC.md) for the full product and technical spec.

## Install

**Full step-by-step for Cursor, Claude Code, and Codex:** [skills/INSTALL.md](skills/INSTALL.md)

### CLI (once)

```bash
npm install
npm link          # exposes the `codepath` binary
codepath --help
```

Node.js ≥ 20 required.

### Skills (all three agents)

```bash
REPO="$(pwd)/skills/code-path"
mkdir -p ~/.cursor/skills ~/.claude/skills ~/.agents/skills
ln -sfn "$REPO" ~/.cursor/skills/code-path    # Cursor
ln -sfn "$REPO" ~/.claude/skills/code-path    # Claude Code
ln -sfn "$REPO" ~/.agents/skills/code-path    # Codex (user scope)
```

| Agent | Personal | Project | Invoke |
|-------|----------|---------|--------|
| Cursor | `~/.cursor/skills/` | `.cursor/skills/` | “use code-path” / `/code-path` |
| Claude Code | `~/.claude/skills/` | `.claude/skills/` | `/code-path` |
| Codex | `~/.agents/skills/` | `.agents/skills/` | `$code-path` / `/skills` |

## Quick start

Validate and print the bundled sample:

```bash
codepath validate examples/sample-path.json --check-files
codepath print examples/sample-path.json
codepath view examples/sample-path.json    # interactive (needs a TTY)
```

Create a stub for a new walkthrough:

```bash
codepath init "Checkout place order" --query "What happens on Place Order?"
# writes .codepath/checkout-place-order.json
```

## How agents use it

1. You ask: “Walk me through what happens when a user clicks Place Order.”
2. The **code-path** skill searches the repo and writes `.codepath/<slug>.json`.
3. It runs `codepath validate --check-files`, then `codepath view` (or tells you to).
4. You navigate the path in the TUI.

### Example Path Document shape

```json
{
  "version": 1,
  "title": "Checkout: place order",
  "query": "What happens when a user clicks Place Order?",
  "repoRoot": ".",
  "steps": [
    {
      "id": "s1",
      "title": "UI click handler",
      "file": "src/components/Checkout.tsx",
      "startLine": 88,
      "endLine": 104,
      "symbol": "onPlaceOrder",
      "note": "Validates cart then POSTs to the API.",
      "next": ["s2"]
    }
  ]
}
```

Schema: [schemas/path-document.schema.json](schemas/path-document.schema.json).

## TUI keybindings

| Key | Action |
|-----|--------|
| `j` / `↓` / `n` | Next hop |
| `k` / `↑` / `p` | Previous hop |
| `+` / `-` | Expand / shrink context |
| `c` | Toggle extra context |
| `o` | Open file at line in editor |
| `b` | Choose a branch (when present) |
| `g` | Jump to step by number |
| `y` | Yank `file:line` to clipboard |
| `q` / `Esc` | Quit |

Editor resolution: `CODEPATH_EDITOR` (supports `{file}` / `{line}`) → `cursor` → `code` → `$EDITOR`.

## CLI

```
codepath validate <file> [--check-files] [--repo-root <dir>]
codepath print    <file> [--repo-root <dir>] [-c <n>]
codepath view     <file> [--repo-root <dir>] [-c <n>]
codepath init     [title] [-q <query>] [--stdout]
```

## Repo layout

```
SPEC.md
schemas/path-document.schema.json
examples/sample-path.json
examples/fixture-repo/          # tiny fake app for the sample
src/                            # codepath CLI + TUI
skills/code-path/SKILL.md       # shared Cursor / Claude skill
```

## Development

```bash
npm run dev -- validate examples/sample-path.json --check-files
npm run build
npm test
```
