import chalk from "chalk";
import type { PathDocument, Step } from "../schema.js";
import {
  extractSnippet,
  readFileLines,
  resolveStepFile,
} from "../load.js";
import { copyToClipboard, openInEditor } from "../editor.js";

type Mode = "browse" | "branch" | "jump";

export type ViewOptions = {
  repoRoot: string;
  context: number;
};

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}

function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

function stepMap(doc: PathDocument): Map<string, Step> {
  return new Map(doc.steps.map((s) => [s.id, s]));
}

function defaultNext(step: Step, byId: Map<string, Step>): Step | undefined {
  const id = step.next?.[0];
  return id ? byId.get(id) : undefined;
}

function wrapNote(note: string, width: number): string[] {
  const words = note.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if (`${cur} ${w}`.length <= width) {
      cur = `${cur} ${w}`;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function runView(
  doc: PathDocument,
  options: ViewOptions,
): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "codepath view --here requires a TTY. Use `codepath view <file>` (opens an external terminal) or run inside a real terminal.",
    );
  }

  const byId = stepMap(doc);
  let context = options.context;
  let extraContext = false;
  let mode: Mode = "browse";
  let status = "";
  let branchCursor = 0;
  let jumpBuffer = "";

  const history: string[] = [doc.steps[0]!.id];
  let histIndex = 0;

  const currentStep = (): Step => byId.get(history[histIndex]!)!;

  const effectiveContext = (): number =>
    extraContext ? Math.max(context, 12) : context;

  const goTo = (id: string): void => {
    const step = byId.get(id);
    if (!step) {
      status = `unknown step ${id}`;
      return;
    }
    history.splice(histIndex + 1);
    history.push(id);
    histIndex = history.length - 1;
    status = "";
  };

  const render = (): void => {
    const cols = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;
    const step = currentStep();
    const abs = resolveStepFile(options.repoRoot, step.file);
    const stepNum = doc.steps.findIndex((s) => s.id === step.id) + 1;
    const total = doc.steps.length;

    clearScreen();

    const titleLine = `codepath │ ${doc.title}`;
    const progress = `Step ${stepNum}/${total}`;
    const pad = Math.max(1, cols - titleLine.length - progress.length);
    console.log(
      chalk.bold(titleLine) + " ".repeat(pad) + chalk.dim(progress),
    );
    console.log(chalk.dim("─".repeat(Math.min(cols, 80))));

    const loc = `${step.file}:${step.startLine}-${step.endLine}`;
    const sym = step.symbol ? `  ·  ${step.symbol}` : "";
    console.log(chalk.cyan.bold(loc) + chalk.cyan(sym));
    console.log(chalk.bold(step.title));
    console.log(chalk.dim("─".repeat(Math.min(cols, 80))));

    for (const line of wrapNote(step.note, Math.min(cols, 80))) {
      console.log(line);
    }
    console.log(chalk.dim("─".repeat(Math.min(cols, 80))));

    let codeLinesUsed = 0;
    try {
      const lines = readFileLines(abs);
      const snippet = extractSnippet(
        lines,
        step.startLine,
        step.endLine,
        effectiveContext(),
      );
      const width = String(snippet.sliceEnd).length;
      const maxCodeRows = Math.max(6, rows - 14);
      const visible = snippet.lines.slice(0, maxCodeRows);
      for (const row of visible) {
        const mark = row.focused ? chalk.green("▶") : " ";
        const num = chalk.dim(String(row.lineNo).padStart(width, " "));
        const text = row.focused ? row.text : chalk.dim(row.text);
        console.log(`${mark} ${num} │ ${text}`);
        codeLinesUsed++;
      }
      if (snippet.lines.length > maxCodeRows) {
        console.log(chalk.dim(`  … ${snippet.lines.length - maxCodeRows} more lines (shrink window or use +/-)`));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`(could not read file: ${message})`));
    }

    void codeLinesUsed;

    console.log(chalk.dim("─".repeat(Math.min(cols, 80))));

    if (mode === "branch") {
      const branches = step.branches ?? [];
      console.log(chalk.yellow("Pick a branch (Enter confirm, Esc cancel):"));
      branches.forEach((b, i) => {
        const marker = i === branchCursor ? chalk.green("❯") : " ";
        console.log(`${marker} ${b.label} → ${b.next}`);
      });
    } else if (mode === "jump") {
      console.log(
        chalk.yellow(
          `Jump to step number (1-${total}), Enter confirm: ${jumpBuffer}_`,
        ),
      );
      doc.steps.forEach((s, i) => {
        const marker = s.id === step.id ? chalk.green("•") : " ";
        console.log(
          `${marker} ${String(i + 1).padStart(2, " ")}. ${s.title} ${chalk.dim(`(${s.id})`)}`,
        );
      });
    } else {
      const branchHint =
        step.branches && step.branches.length > 0
          ? chalk.yellow("  b branch")
          : "";
      console.log(
        chalk.dim(
          `j/n next  k/p prev  +/- context  c more  o open${branchHint}  g jump  y yank  q quit`,
        ),
      );
      console.log(
        chalk.dim(
          `context=${effectiveContext()}${extraContext ? " (extra)" : ""}`,
        ),
      );
    }

    if (status) {
      console.log(chalk.magenta(status));
    }
  };

  const cleanup = (): void => {
    showCursor();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    process.stdin.removeListener("data", onData);
  };

  const quit = (): void => {
    cleanup();
    clearScreen();
    console.log(chalk.dim("codepath: bye"));
    process.exit(0);
  };

  const onData = (buf: Buffer): void => {
    const key = buf.toString("utf8");

    if (key === "\u0003") {
      // Ctrl-C
      quit();
      return;
    }

    if (mode === "branch") {
      const branches = currentStep().branches ?? [];
      if (key === "\u001b" || key === "q") {
        mode = "browse";
        status = "branch cancelled";
        render();
        return;
      }
      if (key === "j" || key === "\u001b[B") {
        branchCursor = Math.min(branches.length - 1, branchCursor + 1);
        render();
        return;
      }
      if (key === "k" || key === "\u001b[A") {
        branchCursor = Math.max(0, branchCursor - 1);
        render();
        return;
      }
      if (key === "\r" || key === "\n") {
        const chosen = branches[branchCursor];
        if (chosen) {
          goTo(chosen.next);
          status = `followed branch: ${chosen.label}`;
        }
        mode = "browse";
        render();
        return;
      }
      return;
    }

    if (mode === "jump") {
      if (key === "\u001b") {
        mode = "browse";
        jumpBuffer = "";
        status = "jump cancelled";
        render();
        return;
      }
      if (key === "\u007f" || key === "\b") {
        jumpBuffer = jumpBuffer.slice(0, -1);
        render();
        return;
      }
      if (key === "\r" || key === "\n") {
        const n = Number.parseInt(jumpBuffer, 10);
        if (n >= 1 && n <= doc.steps.length) {
          goTo(doc.steps[n - 1]!.id);
          status = `jumped to step ${n}`;
        } else {
          status = `invalid step number: ${jumpBuffer}`;
        }
        mode = "browse";
        jumpBuffer = "";
        render();
        return;
      }
      if (/^\d$/.test(key)) {
        jumpBuffer += key;
        render();
      }
      return;
    }

    // browse mode
    if (key === "q" || key === "\u001b") {
      quit();
      return;
    }

    if (key === "j" || key === "n" || key === "\u001b[B") {
      const next = defaultNext(currentStep(), byId);
      if (next) {
        goTo(next.id);
        status = "";
      } else if (histIndex < history.length - 1) {
        histIndex += 1;
        status = "";
      } else {
        status = "end of path";
      }
      render();
      return;
    }

    if (key === "k" || key === "p" || key === "\u001b[A") {
      if (histIndex > 0) {
        histIndex -= 1;
        status = "";
      } else {
        status = "start of path";
      }
      render();
      return;
    }

    if (key === "+" || key === "=") {
      context = Math.min(40, context + 2);
      status = `context=${context}`;
      render();
      return;
    }

    if (key === "-" || key === "_") {
      context = Math.max(0, context - 2);
      status = `context=${context}`;
      render();
      return;
    }

    if (key === "c") {
      extraContext = !extraContext;
      status = extraContext ? "extra context on" : "extra context off";
      render();
      return;
    }

    if (key === "o") {
      const step = currentStep();
      const abs = resolveStepFile(options.repoRoot, step.file);
      void openInEditor(abs, step.startLine).then((msg) => {
        status = msg;
        render();
      });
      return;
    }

    if (key === "b") {
      const branches = currentStep().branches ?? [];
      if (branches.length === 0) {
        status = "no branches on this step";
        render();
        return;
      }
      mode = "branch";
      branchCursor = 0;
      status = "";
      render();
      return;
    }

    if (key === "g") {
      mode = "jump";
      jumpBuffer = "";
      status = "";
      render();
      return;
    }

    if (key === "y") {
      const step = currentStep();
      const ref = `${step.file}:${step.startLine}`;
      void copyToClipboard(ref).then((ok) => {
        status = ok ? `yanked ${ref}` : `clipboard unavailable; ${ref}`;
        render();
      });
      return;
    }
  };

  hideCursor();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", onData);
  process.on("SIGWINCH", render);
  render();

  // Keep process alive until quit.
  await new Promise<void>(() => {
    /* resolved via process.exit in quit */
  });
}
