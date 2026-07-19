export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

function processTree(rootPid: number): number[] {
  if (!Number.isSafeInteger(rootPid) || rootPid <= 1) return [];
  const result = Bun.spawnSync(["ps", "-axo", "pid=,ppid="], {
    stdout: "pipe",
    stderr: "ignore",
  });
  if (result.exitCode !== 0) return [rootPid];
  const children = new Map<number, number[]>();
  for (const line of result.stdout.toString().split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
    if (!match) continue;
    const pid = Number(match[1]);
    const parent = Number(match[2]);
    const siblings = children.get(parent) ?? [];
    siblings.push(pid);
    children.set(parent, siblings);
  }
  const tree: number[] = [];
  const visit = (pid: number) => {
    for (const child of children.get(pid) ?? []) visit(child);
    tree.push(pid);
  };
  visit(rootPid);
  return tree;
}

function signalProcesses(pids: number[], signal: NodeJS.Signals): void {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // The process may have exited between discovery and signaling.
    }
  }
}

export async function terminateProcessTree(
  rootPid: number,
  graceMs = 1_000,
): Promise<void> {
  const initial = processTree(rootPid);
  signalProcesses(initial, "SIGTERM");
  if (graceMs > 0) await Bun.sleep(graceMs);
  signalProcesses(
    [...new Set([...initial, ...processTree(rootPid)])],
    "SIGKILL",
  );
}

export async function command(
  argv: string[],
  cwd: string,
  env: Record<string, string | undefined> = process.env,
  timeoutMs = 30 * 60_000,
): Promise<CommandResult> {
  const started = performance.now();
  let timedOut = false;
  const proc = Bun.spawn(argv, {
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  let timeoutTree: number[] = [];
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  const timer = setTimeout(() => {
    timedOut = true;
    timeoutTree = processTree(proc.pid);
    signalProcesses(timeoutTree, "SIGTERM");
    forceTimer = setTimeout(
      () =>
        signalProcesses(
          [...new Set([...timeoutTree, ...processTree(proc.pid)])],
          "SIGKILL",
        ),
      1_000,
    );
  }, timeoutMs);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);
  if (forceTimer) clearTimeout(forceTimer);
  return {
    code,
    stdout,
    stderr,
    durationMs: performance.now() - started,
    timedOut,
  };
}

export async function checked(
  argv: string[],
  cwd: string,
  env?: Record<string, string | undefined>,
): Promise<string> {
  const result = await command(argv, cwd, env);
  if (result.code !== 0)
    throw new Error(
      `${argv.join(" ")} failed (${result.code}): ${result.stderr.trim()}`,
    );
  return result.stdout.trim();
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
