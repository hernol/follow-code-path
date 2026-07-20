import chalk from "chalk";
import type { PathDocument, Step } from "./schema.js";
import {
  extractSnippet,
  readFileLines,
  resolveStepFile,
} from "./load.js";

function stepIndex(doc: PathDocument): Map<string, Step> {
  return new Map(doc.steps.map((s) => [s.id, s]));
}

/** Walk default `next` chain from the first step; fall back to array order. */
export function linearizePrimaryPath(doc: PathDocument): Step[] {
  const byId = stepIndex(doc);
  const first = doc.steps[0];
  if (!first) return [];

  const ordered: Step[] = [];
  const visited = new Set<string>();
  let current: Step | undefined = first;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    ordered.push(current);
    const nextId: string | undefined = current.next?.[0];
    current = nextId ? byId.get(nextId) : undefined;
  }

  // Include remaining steps not on the primary spine (for print completeness).
  for (const step of doc.steps) {
    if (!visited.has(step.id)) {
      ordered.push(step);
    }
  }

  return ordered;
}

export function printPathDocument(
  doc: PathDocument,
  repoRoot: string,
  context: number,
): void {
  console.log(chalk.bold(`# ${doc.title}`));
  console.log(chalk.dim(`query: ${doc.query}`));
  console.log(chalk.dim(`repoRoot: ${repoRoot}`));
  console.log("");

  const steps = linearizePrimaryPath(doc);
  for (const [i, step] of steps.entries()) {
    const header = `${step.file}:${step.startLine}-${step.endLine}`;
    const symbol = step.symbol ? `  ·  ${step.symbol}` : "";
    console.log(chalk.cyan.bold(`@@ step ${i + 1}/${steps.length} ${header}${symbol}`));
    console.log(chalk.bold(step.title));
    console.log(step.note);

    if (step.branches && step.branches.length > 0) {
      console.log(
        chalk.yellow(
          `branches: ${step.branches.map((b) => `${b.label}→${b.next}`).join(", ")}`,
        ),
      );
    }

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
        const num = String(row.lineNo).padStart(width, " ");
        const text = row.focused ? row.text : chalk.dim(row.text);
        console.log(`${mark} ${chalk.dim(num)} │ ${text}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`  (could not read file: ${message})`));
    }

    console.log("");
  }
}
