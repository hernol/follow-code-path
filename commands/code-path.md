---
description: Walk a feature code path hop-by-hop in this session (AskUserQuestion after every step)
argument-hint: [feature or event to trace]
allowed-tools: AskUserQuestion, Read, Write, Bash, Grep, Glob
---

# /code-path

Interactively walk: **$ARGUMENTS**

Follow the **code-path** skill exactly.

Mandatory loop:
1. Build/validate `.codepath/<slug>.json` if needed.
2. Show **one** hop only (`codepath show … --step …`).
3. Call **AskUserQuestion** (Next / Prev / More context / Open file / Branch… / Outline / Done).
4. Repeat until Done.

Do not dump the full path. Do not open an external TUI unless the user asks.
