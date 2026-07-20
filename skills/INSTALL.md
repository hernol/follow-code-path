# Install code-path on Cursor, Claude Code, and Codex

Replace `/data/apps/code-path-skill` with your clone path if different (e.g. `follow-code-path`).

## 0. CLI (once)

```bash
cd /data/apps/code-path-skill
npm install
npm link
codepath validate examples/sample-path.json --check-files
```

## 1. Claude Code (chat debugger — primary)

### Skill + slash commands

```bash
REPO=/data/apps/code-path-skill
mkdir -p ~/.claude/skills ~/.claude/commands
ln -sfn "$REPO/skills/code-path" ~/.claude/skills/code-path
for c in code-path cp-n cp-b cp-i cp-o cp-s cp-q; do
  ln -sfn "$REPO/commands/$c.md" ~/.claude/commands/$c.md
done
```

Project-scoped (from a repo root):

```bash
mkdir -p .claude/skills .claude/commands
ln -sfn /data/apps/code-path-skill/skills/code-path .claude/skills/code-path
for c in code-path cp-n cp-b cp-i cp-o cp-s cp-q; do
  ln -sfn /data/apps/code-path-skill/commands/$c.md .claude/commands/$c.md
done
```

### Use

1. **New Claude session** (so it loads the updated skill/commands).
2. `/code-path <feature>`
3. You should see **one hop** and:
   `> n next · b back · i into · o out · s over · q quit`
4. Type `n` + Enter (or `/cp-n`).

### Optional keybindings

Claude **cannot** bind `"f10": "n\n"` (invalid schema). Use slash-command bindings:

```bash
# merge into ~/.claude/keybindings.json — see examples/keybindings.code-path.json
```

Example fragment:

```json
{
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "f10": "command:cp-n",
        "shift+f10": "command:cp-b",
        "f11": "command:cp-i",
        "shift+f11": "command:cp-o",
        "f8": "command:cp-s"
      }
    }
  ]
}
```

## 2. Cursor

```bash
mkdir -p ~/.cursor/skills
ln -sfn /data/apps/code-path-skill/skills/code-path ~/.cursor/skills/code-path
```

Same chat protocol: agent shows one hop; you reply `n` / `b` / …

## 3. Codex

```bash
mkdir -p ~/.agents/skills
ln -sfn /data/apps/code-path-skill/skills/code-path ~/.agents/skills/code-path
```

Invoke `$code-path` / `/skills`. Same `n`/`b`/`i`/`o`/`s`/`q` loop.

## 4. Install all three + Claude commands

```bash
REPO=/data/apps/code-path-skill
cd "$REPO" && npm install && npm link
mkdir -p ~/.cursor/skills ~/.claude/skills ~/.agents/skills ~/.claude/commands
ln -sfn "$REPO/skills/code-path" ~/.cursor/skills/code-path
ln -sfn "$REPO/skills/code-path" ~/.claude/skills/code-path
ln -sfn "$REPO/skills/code-path" ~/.agents/skills/code-path
for c in code-path cp-n cp-b cp-i cp-o cp-s cp-q; do
  ln -sfn "$REPO/commands/$c.md" ~/.claude/commands/$c.md
done
```

## Path quality reminder

The skill must build a **spine** (entry ↔ terminal effect via forward+backward). Noise calls are `detail` and only appear if you type `i`.
