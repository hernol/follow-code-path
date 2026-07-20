import chalk from "chalk";
import {
  effectiveStepOver,
  spineSteps,
  type PathDocument,
  type Step,
} from "./schema.js";
import {
  extractSnippet,
  readFileLines,
  resolveStepFile,
} from "./load.js";

export function findStep(
  doc: PathDocument,
  stepRef: string,
): Step | undefined {
  const byId = doc.steps.find((s) => s.id === stepRef);
  if (byId) return byId;
  const n = Number.parseInt(stepRef, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= doc.steps.length) {
    return doc.steps[n - 1];
  }
  return undefined;
}

export function showStep(
  doc: PathDocument,
  step: Step,
  repoRoot: string,
  context: number,
): void {
  const spine = spineSteps(doc);
  const spineIndex = spine.findIndex((s) => s.id === step.id);
  const role = step.role ?? "spine";
  const progress =
    spineIndex >= 0
      ? `Paso ${spineIndex + 1}/${spine.length}`
      : `detail · ${step.id}`;

  const loc = `${step.file}:${step.startLine}-${step.endLine}`;
  const symbol = step.symbol ? `  ·  ${step.symbol}` : "";
  const highlight = step.highlightLine ?? step.startLine;

  console.log(chalk.bold(`[${progress}] ${role} · ${step.title}`));
  console.log(chalk.cyan.bold(loc) + chalk.cyan(symbol));
  if (step.whySpine) {
    console.log(chalk.dim(`why: ${step.whySpine}`));
  } else {
    console.log(step.note);
  }

  const over = effectiveStepOver(step);
  if (over) console.log(chalk.dim(`stepOver→${over}`));
  if (step.stepInto) console.log(chalk.dim(`stepInto→${step.stepInto}`));
  if (step.stepOut) console.log(chalk.dim(`stepOut→${step.stepOut}`));
  if (step.branches && step.branches.length > 0) {
    console.log(
      chalk.yellow(
        `branches: ${step.branches.map((b) => `${b.label}→${b.next}`).join(", ")}`,
      ),
    );
  }

  console.log(chalk.dim("─".repeat(60)));

  const abs = resolveStepFile(repoRoot, step.file);
  try {
    const lines = readFileLines(abs);
    const snippet = extractSnippet(
      lines,
      step.startLine,
      step.endLine,
      context,
    );
    const width = String(snippet.sliceEnd).length;
    for (const row of snippet.lines) {
      const isHighlight = row.lineNo === highlight;
      const inRange =
        row.lineNo >= step.startLine && row.lineNo <= step.endLine;
      const mark = isHighlight
        ? chalk.green("▶")
        : inRange
          ? chalk.green("·")
          : " ";
      const num = chalk.dim(String(row.lineNo).padStart(width, " "));
      const text = isHighlight
        ? chalk.bold(row.text)
        : inRange
          ? row.text
          : chalk.dim(row.text);
      console.log(`${mark} ${num} │ ${text}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(`(could not read file: ${message})`));
  }

  console.log("");
  console.log(
    chalk.bold(
      "> n next · b back · i into · o out · s over · q quit",
    ),
  );
}
