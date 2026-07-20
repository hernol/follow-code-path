import chalk from "chalk";
import type { PathDocument, Step } from "./schema.js";
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
  const index = doc.steps.findIndex((s) => s.id === step.id) + 1;
  const total = doc.steps.length;
  const loc = `${step.file}:${step.startLine}-${step.endLine}`;
  const symbol = step.symbol ? `  ·  ${step.symbol}` : "";

  console.log(chalk.bold(`${doc.title}  ·  Step ${index}/${total}`));
  console.log(chalk.cyan.bold(loc) + chalk.cyan(symbol));
  console.log(chalk.bold(step.title));
  console.log(step.note);

  if (step.next && step.next.length > 0) {
    console.log(chalk.dim(`next: ${step.next.join(", ")}`));
  }
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
      const mark = row.focused ? chalk.green("▶") : " ";
      const num = chalk.dim(String(row.lineNo).padStart(width, " "));
      const text = row.focused ? row.text : chalk.dim(row.text);
      console.log(`${mark} ${num} │ ${text}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(`(could not read file: ${message})`));
  }
}
