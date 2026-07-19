export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
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
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGTERM");
    forceTimer = setTimeout(() => proc.kill("SIGKILL"), 1_000);
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
