---
description: Start a sequential feature-path debugger in chat (n/b/i/o/s/q — no AskUserQuestion)
argument-hint: [feature or event to trace]
allowed-tools: Read, Write, Bash, Grep, Glob
---

# /code-path

Trace: **$ARGUMENTS**

Follow the **code-path** skill.

1. Map spine with forward+backward (entry ↔ effect). Write/validate `.codepath/<slug>.json`.
2. Show **only step 1** (`codepath show … --step <id>`).
3. Print exactly: `> n next · b back · i into · o out · s over · q quit`
4. **STOP** and wait. Do not use AskUserQuestion. Do not dump the path. Do not open an external TUI.
