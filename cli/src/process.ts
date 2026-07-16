import { DarrowError } from "./errors";

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function run(
  command: string[],
  cwd?: string,
  env?: Record<string, string | undefined>,
): ProcessResult {
  const result = Bun.spawnSync(command, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

export function mustRun(
  command: string[],
  cwd?: string,
  category = "infrastructure",
): string {
  const result = run(command, cwd);
  if (result.exitCode !== 0) {
    const detail =
      result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
    throw new DarrowError(`${command[0]} failed: ${detail}`, category);
  }
  return result.stdout.trim();
}
