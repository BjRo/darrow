import { afterEach } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

export type OracleCheck = { name: string; run: string; exit_code?: number };
export type FixtureCase = {
  id: string;
  fixture: Record<string, unknown> & { setup?: string };
  checks: OracleCheck[];
};
type CliResult = {
  format: string;
  exitCode: number;
  execution: { status: string };
  grading: { status: string };
  task: { verdict: string };
  evidencePath: string | null;
  cases: {
    caseId: string;
    trials: { checks: { id: string; status: string; detail?: string }[] }[];
  }[];
};

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

export async function readFixtureCase(source: URL): Promise<FixtureCase> {
  return parse(await readFile(source, "utf8")) as FixtureCase;
}

type OracleOptions = {
  source: URL;
  checks: OracleCheck[];
  setupPrefix?: string;
};

async function prepareOracle(root: string, options: OracleOptions) {
  const canonical = await readFixtureCase(options.source);
  const caseDir = join(root, "evals/experiments/fixture-oracle/cases");
  await mkdir(caseDir, { recursive: true });
  const id = `oracle-${canonical.id}`;
  const fixture = { ...canonical.fixture };
  if (options.setupPrefix !== undefined)
    fixture.setup = [options.setupPrefix, fixture.setup ?? ""].join("\n");
  await writeFile(
    join(caseDir, "oracle.yaml"),
    JSON.stringify({
      id,
      invariant: "SE-C28",
      prompt: "Return fixture ready. This is a deterministic oracle test.",
      fixture,
      checks: options.checks,
    }),
  );
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
  id: "darrow.host.fixture-oracle", model: "fixture-oracle-v1", effort: "none",
  async run() { return { finalMessage: "fixture ready", complete: true }; },
};
`,
  );
  return { id, adapter };
}

function commandEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name, value]) =>
        value !== undefined &&
        !/(?:api[_-]?key|token|secret|password|credential)/i.test(name),
    ),
  );
}

async function resolvedCheckIds(root: string, id: string) {
  const command = Bun.spawn(
    [process.execPath, resolve(import.meta.dir, "../sevro-extension/index.ts")],
    {
      env: commandEnvironment(),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  await command.stdin.write(
    JSON.stringify({
      protocol: "sevro.extension.v1",
      id: "oracle-resolve",
      method: "resolve",
      params: {
        projectRoot: pathToFileURL(root).href,
        selectors: { caseIds: [id] },
        configuration: {},
      },
    }),
  );
  await command.stdin.end();
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(command.stdout).text(),
    new Response(command.stderr).text(),
    command.exited,
  ]);
  const reply = JSON.parse(stdout) as {
    id: string;
    result?: { cases: { id: string; checks: { id: string }[] }[] };
  };
  const selected = reply.result?.cases[0];
  if (exitCode !== 0 || reply.id !== "oracle-resolve" || selected?.id !== id)
    throw new Error(`fixture resolution failed: ${stderr || stdout}`);
  return selected.checks.map((check) => check.id);
}

function oracleCommand(root: string, id: string, adapter: string) {
  return [
    process.execPath,
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
    "--case-id",
    id,
    "--project-root",
    root,
    "--results-root",
    join(root, "results"),
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
    "--condition",
    "passive",
    "--jobs",
    "1",
    "--trials",
    "1",
    "--threshold",
    "1",
  ];
}

function readResult(
  stdout: string,
  stderr: string,
  id: string,
  exitCode: number,
) {
  const value = JSON.parse(stdout) as CliResult;
  if (
    value.format !== "sevro.cli-result.v1" ||
    value.exitCode !== exitCode ||
    (value.cases.length > 0 && value.cases[0]?.caseId !== id)
  )
    throw new Error(`invalid fixture result: ${stderr || stdout}`);
  return value;
}

/** Exercise a canonical Darrow fixture and its oracles through public commands. */
export async function runFixtureChecks(options: OracleOptions) {
  const root = await mkdtemp(join(tmpdir(), "darrow-fixture-oracle-"));
  roots.push(root);
  const { id, adapter } = await prepareOracle(root, options);
  const checkIds = await resolvedCheckIds(root, id);
  if (checkIds.length !== options.checks.length)
    throw new Error("resolved fixture checks differ from the oracle input");
  const command = Bun.spawn(oracleCommand(root, id, adapter), {
    env: commandEnvironment(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(command.stdout).text(),
    new Response(command.stderr).text(),
    command.exited,
  ]);
  const value = readResult(stdout, stderr, id, exitCode);
  const checks = value.cases[0]?.trials[0]?.checks ?? [];
  return {
    exitCode,
    value,
    diagnostic: stderr || stdout,
    checks: options.checks.map((check, index) => ({
      name: check.name,
      ...checks.find((result) => result.id === checkIds[index]),
    })),
  };
}
