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
import {
  buildViewArgv,
  isInteractiveTty,
  spawnInExternalTerminal,
} from "./terminal.js";

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
  .description(
    "Interactive TUI walkthrough (opens an external terminal when stdin is not a TTY)",
  )
  .argument("<file>", "Path Document JSON file")
  .option("--repo-root <dir>", "Override repoRoot from the document")
  .option("-c, --context <n>", "Initial context lines around each range", "3")
  .option(
    "--here",
    "Force TUI in this process (do not spawn an external terminal)",
    false,
  )
  .option(
    "--external",
    "Always open an external terminal, even if this process has a TTY",
    false,
  )
  .action(
    async (
      file: string,
      opts: {
        repoRoot?: string;
        context: string;
        here: boolean;
        external: boolean;
      },
    ) => {
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

      const wantExternal =
        opts.external ||
        (!opts.here && !isInteractiveTty());

      if (wantExternal) {
        const argv = buildViewArgv(file, {
          repoRoot: opts.repoRoot,
          context: opts.context,
        });
        const spawned = spawnInExternalTerminal(argv);
        if (spawned.ok) {
          console.log(
            chalk.green(
              `Opened interactive walkthrough in ${spawned.label}.`,
            ),
          );
          console.log(chalk.dim(`Path document: ${resolve(file)}`));
          console.log(
            chalk.dim(
              "Keys: j/n next · k/p prev · +/- context · o open · b branch · q quit",
            ),
          );
          return;
        }
        console.error(
          chalk.yellow(
            `Could not open an external terminal (${spawned.reason}).`,
          ),
        );
        if (!isInteractiveTty()) {
          console.error(
            chalk.yellow(
              `Run locally: codepath view --here ${resolve(file)}`,
            ),
          );
          console.error(
            chalk.dim(
              "Tip: set CODEPATH_TERMINAL to your emulator, e.g. 'kitty -e {cmd}'",
            ),
          );
          process.exitCode = 1;
          return;
        }
        // Fall through to in-process TUI if we somehow have a TTY.
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
