# Install code-path on Cursor, Claude Code, and Codex

Two pieces:

1. **`codepath` CLI** — interactive walker (`validate` / `print` / `view`)
2. **`code-path` skill** — same `SKILL.md` for all three agents (symlinked or copied into each agent’s skills folder)

Replace `/data/apps/code-path-skill` with your clone path if different.

---

## 0. Install the CLI (once, shared)

```bash
cd /data/apps/code-path-skill
npm install
npm link
codepath --help
```

Confirm:

```bash
codepath validate examples/sample-path.json --check-files
```

Agents need `codepath` on your `PATH`. If `npm link` is awkward in your environment:

```bash
# optional: add an alias in ~/.bashrc or ~/.zshrc
alias codepath='npx tsx /data/apps/code-path-skill/src/cli.ts'
```

---

## 1. Cursor

**Personal (all projects):**

```bash
mkdir -p ~/.cursor/skills
ln -sfn /data/apps/code-path-skill/skills/code-path ~/.cursor/skills/code-path
ls -la ~/.cursor/skills/code-path/SKILL.md
```

**Project-only** (from a repo root):

```bash
mkdir -p .cursor/skills
ln -sfn /data/apps/code-path-skill/skills/code-path .cursor/skills/code-path
```

**Use it:** in Cursor Agent / Agent CLI, say:

> Walk me through the code path for \<feature\> using the code-path skill

Or: `/code-path` then describe the feature.

Restart the Cursor agent session if the skill does not show up.

---

## 2. Claude Code

**Personal (all projects):**

```bash
mkdir -p ~/.claude/skills
ln -sfn /data/apps/code-path-skill/skills/code-path ~/.claude/skills/code-path
ls -la ~/.claude/skills/code-path/SKILL.md
```

**Project-only** (from a repo root):

```bash
mkdir -p .claude/skills
ln -sfn /data/apps/code-path-skill/skills/code-path .claude/skills/code-path
```

**Use it:**

```text
/code-path
```

or:

> Trace what happens when \<event\> — use the code-path skill

Restart Claude Code if needed after installing.

---

## 3. Codex (OpenAI)

Official skill locations ([Codex skills docs](https://developers.openai.com/codex/skills)):

| Scope | Path |
|-------|------|
| User (all repos) | `~/.agents/skills/` |
| Repo | `.agents/skills/` at the repo root |

**Personal (recommended):**

```bash
mkdir -p ~/.agents/skills
ln -sfn /data/apps/code-path-skill/skills/code-path ~/.agents/skills/code-path
ls -la ~/.agents/skills/code-path/SKILL.md
```

**Project-only** (from a repo root):

```bash
mkdir -p .agents/skills
ln -sfn /data/apps/code-path-skill/skills/code-path .agents/skills/code-path
```

Codex supports symlinked skill folders. If a symlink does not appear in your Codex build, copy instead:

```bash
rm -f ~/.agents/skills/code-path
cp -a /data/apps/code-path-skill/skills/code-path ~/.agents/skills/code-path
```

**Use it:** in Codex CLI / IDE:

- Explicit: `$code-path` or `/skills` and pick `code-path`
- Or: “Walk me through the code path for …”

Restart Codex if the skill list does not update.

**Optional — disable without deleting** (`~/.codex/config.toml`):

```toml
[[skills.config]]
path = "/home/YOU/.agents/skills/code-path/SKILL.md"
enabled = false
```

---

## 4. Install all three at once

```bash
REPO=/data/apps/code-path-skill
SKILL="$REPO/skills/code-path"

cd "$REPO" && npm install && npm link

mkdir -p ~/.cursor/skills ~/.claude/skills ~/.agents/skills
ln -sfn "$SKILL" ~/.cursor/skills/code-path
ln -sfn "$SKILL" ~/.claude/skills/code-path
ln -sfn "$SKILL" ~/.agents/skills/code-path

echo "CLI:"; command -v codepath
echo "Skills:"
ls -la ~/.cursor/skills/code-path/SKILL.md
ls -la ~/.claude/skills/code-path/SKILL.md
ls -la ~/.agents/skills/code-path/SKILL.md
```

---

## Agent note (Claude / Cursor / Codex)

Agent shells usually have **no interactive TTY**, so a plain in-process TUI cannot run there.

`codepath view <file>` **detects that and opens an external terminal window** with the walkthrough. Prefer that over telling the user to copy-paste a command.

Override emulator: `export CODEPATH_TERMINAL='kitty -e {cmd}'`

---

## Quick reference

| Agent | Personal skills dir | Project skills dir | Invoke |
|-------|---------------------|--------------------|--------|
| **Cursor** | `~/.cursor/skills/` | `.cursor/skills/` | Ask for code-path / `/code-path` |
| **Claude Code** | `~/.claude/skills/` | `.claude/skills/` | `/code-path` or natural language |
| **Codex** | `~/.agents/skills/` | `.agents/skills/` | `$code-path` / `/skills` |

Skill source (single copy): `skills/code-path/SKILL.md` in this repo.
