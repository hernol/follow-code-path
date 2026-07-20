---
name: code-path
description: >-
  Sequential feature-path debugger in chat: map a process spine, show one hop,
  wait for n/b/i/o/s/q. Use for code path, call path, what happens when, trace
  feature, or /code-path. No AskUserQuestion. No external TUI by default.
allowed-tools: Read Write Bash Grep Glob
---

# Code Path — sequential chat debugger

Native Claude workflow: **one hop → stop → wait for `n`/`b`/`i`/`o`/`s`/`q`**.

Do **not** use AskUserQuestion. Do **not** open `codepath view` unless the user explicitly asks for a TUI.

## Hard rules

1. After mapping, show **exactly one** hop per assistant turn.
2. End every hop turn with this exact control line:
   `> n next · b back · i into · o out · s over · q quit`
3. **STOP.** Do not show the next hop until the user sends a control message (or `/cp-n` etc.).
4. Never dump the full path. Never summarize all files in one reply during the walk.
5. `n` follows the **spine** (`stepOver`), not every function call in the snippet.

## Phase A — Map (forward + backward)

1. Find the **entry** (user event / route / handler).
2. Find the **terminal effect** (DB write, HTTP response body, meaningful side-effect).
3. Trace **forward** from entry and **backward** from effect; the **spine** is the aligned chain connecting them.
4. Calls that are not on that chain → `role: "detail"` (reachable only via `i`). Typical noise: logging, metrics, trivial getters, shared formatters, stdlib — unless they *are* the effect.
5. Write `.codepath/<slug>.json` with hops including:
   - `role`: `spine` | `detail`
   - `kind`: `statement` | `call` | `branch` | `effect`
   - `highlightLine`: next process line inside the range
   - `whySpine`: why this hop is on the spine (spine hops)
   - `stepOver` / `stepInto` / `stepOut` as applicable
6. Validate: `codepath validate .codepath/<slug>.json --check-files`

## Phase B — Interactive loop

Keep visit history for `b`.

### Render format (each hop)

```
[Paso X/Y] spine · <title>
<file>:<start>-<end>  ·  <symbol>
why: <whySpine or note>

<<snippet: prefer `codepath show .codepath/<slug>.json --step <id> -c 2` (≤ ~10 focused lines); ▶ = highlightLine>>

> n next · b back · i into · o out · s over · q quit
```

Then **stop**.

### Control messages

| User says | Action |
|-----------|--------|
| `n` or `/cp-n` | Go to `stepOver` (or `next[0]`). Skip `detail`. |
| `b` or `/cp-b` | Previous hop in visit history. |
| `i` or `/cp-i` | Go to `stepInto` if set; else say nothing to into. |
| `o` or `/cp-o` | Go to `stepOut` if set. |
| `s` or `/cp-s` | Step over call: same as `n` (do not enter detail). |
| `q` or `/cp-q` | End: one-line spine `s1 → s2 → …` + JSON path. Stop. |

If the user types anything else mid-walk, briefly remind the control line and stay on the current hop.

## Optional TUI

Only if asked: `codepath view .codepath/<slug>.json`

## Keybindings note

Claude keybindings **cannot** inject `"n\n"`. Valid shortcuts use slash commands, e.g. `"f10": "command:cp-n"`. See INSTALL.md.
