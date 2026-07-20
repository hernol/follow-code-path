#!/usr/bin/env node
import { resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import {
  checkFilesExist,
  loadPathDocument,
  resolveRepoRoot,
} from "./load.js";
import { printPathDocument } from "./print.js";
import { runView } from "./tui/view.js";
import { buildStubDocument, writeStubToCodepathDir } from "./init.js";

const program = new Command();

program
  .name("codepath")
  .description(
    "Interactive code-path walker for Cursor Agent and Claude Code",
  )
  .version("1.0.0");

program
  .command("validate")
  .description("Validate a Path Document (schema + graph integrity)")
  .argument("<file>", "Path Document JSON file")
  .option("--check-files", "Verify files exist and line ranges are in bounds", false)
  .option("--repo-root <dir>", "Override repoRoot from the document")
  .action((file: string, opts: { checkFiles: boolean; repoRoot?: string }) => {
    const loaded = loadPathDocument(file);
    if (!loaded.doc) {
      printIssues(loaded.issues);
      process.exitCode = 1;
      return;
    }

    const issues = [...loaded.issues];
    if (opts.checkFiles) {
      const repoRoot = resolveRepoRoot(
        loaded.doc,
        loaded.absolutePath,
        opts.repoRoot,
      );
      issues.push(...checkFilesExist(loaded.doc, repoRoot));
    }

    if (issues.length > 0) {
      printIssues(issues);
      process.exitCode = 1;
      return;
    }

    console.log(chalk.green(`OK ${resolve(file)} (${loaded.doc.steps.length} steps)`));
  });

program
  .command("print")
  .description("Print a sequential diff-style walkthrough")
  .argument("<file>", "Path Document JSON file")
  .option("--repo-root <dir>", "Override repoRoot from the document")
  .option("-c, --context <n>", "Context lines around each range", "3")
  .action(
    (file: string, opts: { repoRoot?: string; context: string }) => {
      const loaded = loadPathDocument(file);
      if (!loaded.doc || loaded.issues.length > 0) {
        printIssues(loaded.issues);
        process.exitCode = 1;
        return;
      }
      const repoRoot = resolveRepoRoot(
        loaded.doc,
        loaded.absolutePath,
        opts.repoRoot,
      );
      const context = Number.parseInt(opts.context, 10);
      if (Number.isNaN(context) || context < 0) {
        console.error(chalk.red("invalid --context"));
        process.exitCode = 1;
        return;
      }
      printPathDocument(loaded.doc, repoRoot, context);
    },
  );

program
  .command("view")
  .description("Interactive TUI walkthrough (requires a TTY)")
  .argument("<file>", "Path Document JSON file")
  .option("--repo-root <dir>", "Override repoRoot from the document")
  .option("-c, --context <n>", "Initial context lines around each range", "3")
  .action(
    async (file: string, opts: { repoRoot?: string; context: string }) => {
      const loaded = loadPathDocument(file);
      if (!loaded.doc || loaded.issues.length > 0) {
        printIssues(loaded.issues);
        process.exitCode = 1;
        return;
      }
      const repoRoot = resolveRepoRoot(
        loaded.doc,
        loaded.absolutePath,
        opts.repoRoot,
      );
      const context = Number.parseInt(opts.context, 10);
      if (Number.isNaN(context) || context < 0) {
        console.error(chalk.red("invalid --context"));
        process.exitCode = 1;
        return;
      }
      try {
        await runView(loaded.doc, { repoRoot, context });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(message));
        process.exitCode = 1;
      }
    },
  );

program
  .command("init")
  .description("Create a stub Path Document")
  .argument("[title]", "Walkthrough title", "New code path")
  .option("-q, --query <text>", "Original query / intent")
  .option("--stdout", "Write JSON to stdout instead of .codepath/", false)
  .action(
    (
      title: string,
      opts: { query?: string; stdout: boolean },
    ) => {
      if (opts.stdout) {
        const doc = buildStubDocument(title, opts.query);
        console.log(JSON.stringify(doc, null, 2));
        return;
      }
      const { path } = writeStubToCodepathDir(process.cwd(), title, opts.query);
      console.log(chalk.green(`wrote ${path}`));
    },
  );

function printIssues(
  issues: { path: string; message: string }[],
): void {
  console.error(chalk.red("Validation failed:"));
  for (const issue of issues) {
    console.error(chalk.red(`  - ${issue.path}: ${issue.message}`));
  }
}

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(message));
  process.exit(2);
});
