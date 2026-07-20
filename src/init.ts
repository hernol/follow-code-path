import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PathDocument } from "./schema.js";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "path";
}

export function buildStubDocument(title: string, query?: string): PathDocument {
  return {
    version: 1,
    title,
    query: query ?? title,
    repoRoot: ".",
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: "s1",
        title: "Entry point",
        file: "src/index.ts",
        startLine: 1,
        endLine: 1,
        symbol: "main",
        note: "Replace with the real entry hop for this feature.",
        next: ["s2"],
      },
      {
        id: "s2",
        title: "Next hop",
        file: "src/index.ts",
        startLine: 1,
        endLine: 1,
        note: "Replace with the next hop; remove or extend as needed.",
      },
    ],
  };
}

export function writeStubToCodepathDir(
  cwd: string,
  title: string,
  query?: string,
): { path: string; doc: PathDocument } {
  const doc = buildStubDocument(title, query);
  const dir = resolve(cwd, ".codepath");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `${slugify(title)}.json`);
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return { path, doc };
}
