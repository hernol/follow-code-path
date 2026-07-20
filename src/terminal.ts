import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { resolve } from "node:path";

function which(cmd: string): string | null {
  const pathEnv = process.env.PATH ?? "";
  const sep = platform() === "win32" ? ";" : ":";
  for (const dir of pathEnv.split(sep)) {
    const candidate = resolve(dir, cmd);
    if (existsSync(candidate)) return candidate;
    if (platform() === "win32" && existsSync(`${candidate}.exe`)) {
      return `${candidate}.exe`;
    }
  }
  return null;
}

export function isInteractiveTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Rebuild argv so the external terminal runs the same CLI with --here. */
export function buildViewArgv(
  pathFile: string,
  opts: { repoRoot?: string; context?: string },
): string[] {
  const self = resolveSelfInvoker();
  const args = [...self, "view", "--here", resolve(pathFile)];
  if (opts.repoRoot) {
    args.push("--repo-root", opts.repoRoot);
  }
  if (opts.context !== undefined) {
    args.push("--context", opts.context);
  }
  return args;
}

function resolveSelfInvoker(): string[] {
  if (process.env.CODEPATH_BIN) {
    return [process.env.CODEPATH_BIN];
  }
  const onPath = which("codepath");
  if (onPath) {
    return [onPath];
  }
  // Running via `node dist/cli.js` or `tsx src/cli.ts`
  const script = process.argv[1];
  if (script) {
    return [process.execPath, script];
  }
  return ["codepath"];
}

type SpawnResult =
  | { ok: true; label: string }
  | { ok: false; reason: string };

/**
 * Open a real terminal emulator and run `argv` inside it.
 * Used when agents (Claude/Cursor/Codex) have no TTY.
 */
export function spawnInExternalTerminal(argv: string[]): SpawnResult {
  if (process.env.CODEPATH_EXTERNAL_SPAWNED === "1") {
    return {
      ok: false,
      reason: "already inside an external spawn (refusing to nest)",
    };
  }

  const env = {
    ...process.env,
    CODEPATH_EXTERNAL_SPAWNED: "1",
  };

  const custom = process.env.CODEPATH_TERMINAL;
  if (custom) {
    // CODEPATH_TERMINAL is a shell command; {cmd} is replaced with a
    // shell-escaped join of argv, or appended if placeholder missing.
    const joined = argv.map(shellQuote).join(" ");
    const command = custom.includes("{cmd}")
      ? custom.replaceAll("{cmd}", joined)
      : `${custom} ${joined}`;
    try {
      const child = spawn(command, {
        shell: true,
        detached: true,
        stdio: "ignore",
        env,
      });
      child.unref();
      return { ok: true, label: `CODEPATH_TERMINAL (${custom})` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `CODEPATH_TERMINAL failed: ${message}` };
    }
  }

  const candidates = terminalCandidates(argv);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const child = spawn(candidate.cmd, candidate.args, {
        detached: true,
        stdio: "ignore",
        env,
      });
      child.unref();
      return { ok: true, label: candidate.label };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${candidate.label}: ${message}`);
    }
  }

  return {
    ok: false,
    reason:
      errors.length > 0
        ? `no terminal worked (${errors.join("; ")})`
        : "no supported terminal emulator found (set CODEPATH_TERMINAL)",
  };
}

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_./:=+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function terminalCandidates(
  argv: string[],
): Array<{ label: string; cmd: string; args: string[] }> {
  const out: Array<{ label: string; cmd: string; args: string[] }> = [];
  const os = platform();

  const tryAdd = (
    label: string,
    bin: string,
    args: string[],
  ): void => {
    const path = which(bin);
    if (path) out.push({ label, cmd: path, args });
  };

  if (os === "darwin") {
    // osascript opens Terminal.app with the command
    const cmdline = argv.map(shellQuote).join(" ");
    tryAdd("Terminal.app", "osascript", [
      "-e",
      `tell application "Terminal" to do script ${JSON.stringify(cmdline)}`,
      "-e",
      'tell application "Terminal" to activate',
    ]);
    tryAdd("iTerm", "osascript", [
      "-e",
      'tell application "iTerm" to create window with default profile',
      "-e",
      `tell application "iTerm" to tell current session of current window to write text ${JSON.stringify(cmdline)}`,
    ]);
  }

  if (os === "win32") {
    tryAdd("Windows Terminal", "wt", ["-w", "0", "nt", ...argv]);
    tryAdd("cmd", "cmd.exe", ["/c", "start", "cmd.exe", "/k", ...argv]);
  }

  // Linux / general
  tryAdd("kitty", "kitty", ["-e", ...argv]);
  tryAdd("ghostty", "ghostty", ["-e", ...argv]);
  tryAdd("alacritty", "alacritty", ["-e", ...argv]);
  tryAdd("wezterm", "wezterm", ["start", "--", ...argv]);
  tryAdd("foot", "foot", [...argv]);
  tryAdd("gnome-terminal", "gnome-terminal", ["--", ...argv]);
  tryAdd("konsole", "konsole", ["-e", ...argv]);
  tryAdd("xfce4-terminal", "xfce4-terminal", ["-e", argv.map(shellQuote).join(" ")]);
  tryAdd("xterm", "xterm", ["-e", ...argv]);

  return out;
}
