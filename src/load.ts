import { readFileSync, existsSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  checkGraphIntegrity,
  parsePathDocument,
  type PathDocument,
  type ValidationIssue,
} from "./schema.js";

export type LoadResult = {
  doc?: PathDocument;
  absolutePath: string;
  issues: ValidationIssue[];
};

export function resolveRepoRoot(
  doc: PathDocument,
  _pathFile: string,
  override?: string,
): string {
  if (override) {
    return resolve(override);
  }
  // Agents run from the repo root; repoRoot is relative to cwd unless absolute.
  if (isAbsolute(doc.repoRoot)) {
    return doc.repoRoot;
  }
  return resolve(process.cwd(), doc.repoRoot);
}

export function resolveStepFile(repoRoot: string, file: string): string {
  return isAbsolute(file) ? file : resolve(repoRoot, file);
}

export function loadPathDocument(filePath: string): LoadResult {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) {
    return {
      absolutePath,
      issues: [{ path: "(file)", message: `file not found: ${absolutePath}` }],
    };
  }

  let raw: unknown;
  try {
    const text = readFileSync(absolutePath, "utf8");
    raw = JSON.parse(text) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      absolutePath,
      issues: [{ path: "(file)", message: `failed to parse JSON: ${message}` }],
    };
  }

  const { doc, issues } = parsePathDocument(raw);
  if (!doc) {
    return { absolutePath, issues };
  }

  const graphIssues = checkGraphIntegrity(doc);
  return { doc, absolutePath, issues: graphIssues };
}

export function checkFilesExist(
  doc: PathDocument,
  repoRoot: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const step of doc.steps) {
    const abs = resolveStepFile(repoRoot, step.file);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      issues.push({
        path: `steps[id=${step.id}].file`,
        message: `file not found: ${step.file} (resolved: ${abs})`,
      });
      continue;
    }

    const content = readFileSync(abs, "utf8");
    const lineCount = content.length === 0 ? 0 : content.split(/\r?\n/).length;

    if (step.startLine > lineCount) {
      issues.push({
        path: `steps[id=${step.id}].startLine`,
        message: `startLine ${step.startLine} exceeds file length ${lineCount} (${step.file})`,
      });
    }
    if (step.endLine > lineCount) {
      issues.push({
        path: `steps[id=${step.id}].endLine`,
        message: `endLine ${step.endLine} exceeds file length ${lineCount} (${step.file})`,
      });
    }
  }

  return issues;
}

export function readFileLines(absPath: string): string[] {
  const content = readFileSync(absPath, "utf8");
  if (content.length === 0) return [];
  return content.split(/\r?\n/);
}

export function extractSnippet(
  lines: string[],
  startLine: number,
  endLine: number,
  context: number,
): {
  sliceStart: number;
  sliceEnd: number;
  lines: { lineNo: number; text: string; focused: boolean }[];
} {
  const sliceStart = Math.max(1, startLine - context);
  const sliceEnd = Math.min(lines.length, endLine + context);
  const out: { lineNo: number; text: string; focused: boolean }[] = [];

  for (let lineNo = sliceStart; lineNo <= sliceEnd; lineNo++) {
    out.push({
      lineNo,
      text: lines[lineNo - 1] ?? "",
      focused: lineNo >= startLine && lineNo <= endLine,
    });
  }

  return { sliceStart, sliceEnd, lines: out };
}
