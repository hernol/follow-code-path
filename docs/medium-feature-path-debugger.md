# I Don’t Remember the Code Path Anymore — So I Built a Debugger for Features Inside Claude

*When AI writes most of your code, “what happens when the user clicks this?” stops being something you can answer from memory. Here’s a small tool that walks you through the real path — hop by hop — without a wall of files or an external TUI.*

---

## The problem nobody warns you about

I’ve been letting agents write a lot of production code. Cursor. Claude. Codex. They’re fast. They’re often right.

There’s a cost that shows up later.

I open a PR I “wrote,” and I can’t tell you the path from the button click to the database write. Not because I’m careless — because I never walked that path myself. The model did. My brain never built the map.

So when someone asks *“what happens when we import brands from Excel?”* I do what everyone does: jump files, chase calls, open helpers that don’t matter, lose the thread, open three more tabs.

I wanted something closer to a **debugger for features** — not breakpoints and locals, just:

1. Show me **this** hop of the process.
2. Let me go **next / back / into / out**.
3. Don’t drag me into every utility call that isn’t part of the real flow.

And I wanted it **inside Claude Code**, where I already work — not in another terminal window I’d forget to look at.

That’s [follow-code-path](https://github.com/hernol/follow-code-path).

---

## What it is (in one sentence)

A **skill + tiny CLI** that reconstructs a feature’s *process spine*, then walks you through it in the Claude chat: one hop at a time, controlled with `n` / `b` / `i` / `o` / `s` / `q`.

No AskUserQuestion menus.  
No external TUI as the default.  
Just chat — and discipline.

---

## What didn’t work (so you don’t repeat it)

### 1. Dump the whole path in one reply

Claude is happy to paste eight files and a narrative. That’s a tour, not a walk. You still don’t *feel* the sequence.

### 2. AskUserQuestion as a “debugger”

Claude’s multiple-choice UI *does* support ↑↓ and Enter. It’s fine for preferences. It feels wrong for “step through this feature.” I didn’t want a quiz. I wanted a debugger cadence.

### 3. An external terminal TUI

We built one (`codepath view`). It’s nice. Agent shells usually have **no TTY**, so the first version told me to “run this locally.” Then we auto-opened kitty. Technically fine — psychologically wrong. I asked Claude to show me the path; I didn’t want a second window.

### 4. The Gemini keybinding myth

You’ll see advice like: bind `F10` to `"n\n"` so Claude gets “next” instantly.

**That’s not how Claude Code keybindings work.** The official schema only allows built-in actions (`chat:submit`, …) or `command:some-slash-command`. You cannot inject arbitrary text. We document the valid approach: slash commands like `/cp-n` and bindings such as `"f10": "command:cp-n"`.

The interaction that *does* work natively: **show one hop, stop, wait for a short chat message.**

---

## The model that matters: spine vs detail

The other failure mode: the agent “traces” by diving into every call. Formatters. Loggers. Shared validators. You lose the process.

So the Path Document isn’t a full call graph. It’s two layers:

- **`spine`** — hops that move the *business process* from entry → terminal effect (HTTP response, DB write, side effect that *is* the feature).
- **`detail`** — calls you only enter with **`i`** (step into). Next (`n`) never lands there by default.

Construction rule for the agent:

1. Find the **entry** (click handler, route, job).
2. Find the **terminal effect**.
3. Trace **forward** and **backward**; the spine is the chain that connects them.
4. Everything else is detail or omitted.

Each hop can carry `highlightLine` — the “next line of the process,” not “first function name in the snippet.”

That single idea fixed most of the noise.

---

## How a session feels

```text
/code-path place order checkout
```

Claude maps the path, writes something like `.codepath/place-order.json`, validates it, then shows **only** step 1:

```text
[Paso 1/4] spine · UI click handler
src/.../Checkout.tsx:5-21  ·  onPlaceOrder
why: Entry: user intent starts here and issues the HTTP request.

▶ 10 │     const response = await fetch("/api/orders", {
...

> n next · b back · i into · o out · s over · q quit
```

You type:

| Key | Meaning |
|-----|---------|
| `n` | Next spine hop (step over at process level) |
| `b` | Back |
| `i` | Into a detail hop (if any) |
| `o` | Out |
| `s` | Over (don’t into) |
| `q` | Quit + one-line spine summary |

Or use `/cp-n`, `/cp-b`, … if you wire keybindings to those slash commands.

That’s it. Same muscle memory as a shallow debugger, without pretending Claude has a real PTY in the tool loop.

---

## What’s in the repo

- **`codepath` CLI** — `validate`, `show` (one hop for agents), `print`, optional `view` TUI  
- **Skill** for Claude / Cursor / Codex — same Path Document contract  
- **Slash commands** — `/code-path`, `/cp-n`, `/cp-b`, `/cp-i`, `/cp-o`, `/cp-s`, `/cp-q`  
- **Schema** — spine/detail, `stepOver` / `stepInto` / `stepOut`, `highlightLine`

GitHub: [https://github.com/hernol/follow-code-path](https://github.com/hernol/follow-code-path)

---

## Install for Claude Code (2 minutes)

```bash
git clone https://github.com/hernol/follow-code-path.git
cd follow-code-path
npm install && npm link

mkdir -p ~/.claude/skills ~/.claude/commands
ln -sfn "$(pwd)/skills/code-path" ~/.claude/skills/code-path
for c in code-path cp-n cp-b cp-i cp-o cp-s cp-q; do
  ln -sfn "$(pwd)/commands/$c.md" ~/.claude/commands/$c.md
done
```

Start a **new** Claude session (old sessions keep old instructions), then:

```text
/code-path <your feature>
```

---

## Why this matters more as AI writes more code

Ownership used to mean “I typed it.” Increasingly it means “I can still explain it.”

If your team ships with agents, you need rituals that **rebuild human maps** of the system — not more markdown dumps, not more “here are related files.”

A feature-path walk is a cheap ritual: five minutes, one spine, fewer surprises in production.

---

## What’s next

Ideas on the table (not all built):

- Stronger static “next line” hints from TS/LSP  
- Importing real runtime traces into the same Path Document  
- IDE “open at highlight” with one key from the walk  

For now the constraint is intentional: **stay inside the chat**, keep the spine honest, make stepping boring and reliable.

---

## Try it

Repo: [hernol/follow-code-path](https://github.com/hernol/follow-code-path)

If you try it on a gnarly feature and the spine still picks the wrong hops, that’s useful signal — the skill rules are meant to be tightened from real paths, not toy fixtures.

And if you’ve also lost the map of code you didn’t personally write: you’re not alone. The agents are fine. Our mental models need tools again.

---

*Built for Claude Code first; same skill shape works with Cursor and Codex. Optional terminal TUI still exists if you want it — it’s just not the point anymore.*
