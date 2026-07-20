import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

function which(cmd: string): string | null {
  const pathEnv = process.env.PATH ?? "";
  const sep = platform() === "win32" ? ";" : ":";
  const exts =
    platform() === "win32"
      ? (process.env.PATHEXT ?? ".EXE").split(";").map((e) => e.toLowerCase())
      : [""];

  for (const dir of pathEnv.split(sep)) {
    for (const ext of exts) {
      const candidate = `${dir}/${cmd}${ext}`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export async function openInEditor(file: string, line: number): Promise<string> {
  const custom = process.env.CODEPATH_EDITOR;
  if (custom) {
    const cmd = custom
      .replaceAll("{file}", file)
      .replaceAll("{line}", String(line));
    await runShell(cmd);
    return `opened via CODEPATH_EDITOR`;
  }

  if (which("cursor")) {
    await runDetached("cursor", ["-g", `${file}:${line}`]);
    return `cursor -g ${file}:${line}`;
  }

  if (which("code")) {
    await runDetached("code", ["-g", `${file}:${line}`]);
    return `code -g ${file}:${line}`;
  }

  const editor = process.env.EDITOR ?? process.env.VISUAL;
  if (editor) {
    await runDetached(editor, [`+${line}`, file]);
    return `${editor} +${line} ${file}`;
  }

  return `no editor found; open ${file}:${line} manually`;
}

function runShell(command: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: "ignore",
      detached: true,
    });
    child.on("error", reject);
    child.unref();
    resolvePromise();
  });
}

function runDetached(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, {
      stdio: "ignore",
      detached: true,
    });
    child.on("error", reject);
    child.unref();
    resolvePromise();
  });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  const tryCmds: Array<{ cmd: string; args: string[] }> = [];
  if (platform() === "darwin") {
    tryCmds.push({ cmd: "pbcopy", args: [] });
  } else if (platform() === "win32") {
    tryCmds.push({ cmd: "clip", args: [] });
  } else {
    tryCmds.push({ cmd: "wl-copy", args: [] });
    tryCmds.push({ cmd: "xclip", args: ["-selection", "clipboard"] });
    tryCmds.push({ cmd: "xsel", args: ["--clipboard", "--input"] });
  }

  for (const { cmd, args } of tryCmds) {
    if (!which(cmd)) continue;
    try {
      await new Promise<void>((resolvePromise, reject) => {
        const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) resolvePromise();
          else reject(new Error(`${cmd} exited ${code}`));
        });
        child.stdin?.write(text);
        child.stdin?.end();
      });
      return true;
    } catch {
      // try next
    }
  }
  return false;
}
