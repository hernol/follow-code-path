# codepath

Sequential **feature-path debugger** in the agent chat: map a process spine, show one hop, wait for `n` / `b` / `i` / `o` / `s` / `q`. No AskUserQuestion. No external TUI by default.

See [SPEC.md](SPEC.md). Install: [skills/INSTALL.md](skills/INSTALL.md).

## Claude (recommended)

```bash
cd /path/to/follow-code-path   # or code-path-skill
npm install && npm link

mkdir -p ~/.claude/skills ~/.claude/commands
ln -sfn "$(pwd)/skills/code-path" ~/.claude/skills/code-path
for c in code-path cp-n cp-b cp-i cp-o cp-s cp-q; do
  ln -sfn "$(pwd)/commands/$c.md" ~/.claude/commands/$c.md
done
```

New Claude session, then:

```text
/code-path place order checkout
```

Expect **one hop** and:

```text
> n next · b back · i into · o out · s over · q quit
```

Reply with `n` (or `/cp-n`). Optional keybindings: copy [examples/keybindings.code-path.json](examples/keybindings.code-path.json) into `~/.claude/keybindings.json` (merge carefully). Note: `"f10": "n\n"` is **invalid** — only `command:cp-n` style works.

## Install (all agents)

Details: [skills/INSTALL.md](skills/INSTALL.md).

```bash
npm install && npm link
REPO="$(pwd)/skills/code-path"
mkdir -p ~/.cursor/skills ~/.claude/skills ~/.agents/skills
ln -sfn "$REPO" ~/.cursor/skills/code-path
ln -sfn "$REPO" ~/.claude/skills/code-path
ln -sfn "$REPO" ~/.agents/skills/code-path
```

## CLI

```bash
codepath validate examples/sample-path.json --check-files
codepath show examples/sample-path.json --step s1 -c 2
codepath print examples/sample-path.json
codepath view examples/sample-path.json    # optional legacy TUI
```

## How the walk works

1. Agent builds `.codepath/<slug>.json` with a **spine** (entry↔effect) and optional **detail** hops.
2. Shows one hop (`highlightLine` marked).
3. You send `n` / `b` / `i` / `o` / `s` / `q`.
4. Repeats until `q`.
