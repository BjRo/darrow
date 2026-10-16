import { afterEach } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const commandRoots: string[] = [];
afterEach(async () => {
  await Promise.all(
    commandRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

function commandEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name, value]) =>
        value !== undefined &&
        !/(?:api[_-]?key|token|secret|password|credential)/i.test(name),
    ),
  );
}

type CommandOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeout?: number;
};

export async function spawnTestCommand(
  argv: string[],
  input?: string,
  options: CommandOptions = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "darrow-fixture-command-"));
  commandRoots.push(directory);
  const stdoutFile = join(directory, "stdout");
  const stderrFile = join(directory, "stderr");
  const stdinFile = join(directory, "stdin");
  await Promise.all([
    writeFile(stdoutFile, ""),
    writeFile(stderrFile, ""),
    ...(input === undefined ? [] : [writeFile(stdinFile, input)]),
  ]);
  const command = Bun.spawn(argv, {
    ...options,
    env: options.env ?? commandEnvironment(),
    stdin: input === undefined ? "ignore" : Bun.file(stdinFile),
    stdout: Bun.file(stdoutFile),
    stderr: Bun.file(stderrFile),
  });
  const result = command.exited.then(async (exitCode) => {
    const [stdout, stderr] = await Promise.all([
      readFile(stdoutFile, "utf8"),
      readFile(stderrFile, "utf8"),
    ]);
    return { stdout, stderr, exitCode };
  });
  return { child: command, result };
}

export async function captureTestCommand(
  argv: string[],
  input?: string,
  options: CommandOptions = {},
) {
  return (await spawnTestCommand(argv, input, options)).result;
}
