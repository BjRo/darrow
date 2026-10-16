import { isDeepStrictEqual } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import schema from "@bjoernrochel/sevro/schemas/cli-result-v1.schema.json";
import { optionValue } from "./suite-routes";
import { sevroEnvironment } from "./sevro-command";
import {
  prepareRepositoryRuntime,
  repositorySkillRuntimeFile,
} from "./uv-seed-cache";
import { preflightCaseDetails } from "./index";
import { activationGate, type ActivationExpectation } from "./activation";

const validate = new Ajv2020({ strict: false }).compile(schema);
type GuideOptions = {
  root: string;
  output: string;
  questions: Array<{ id: string }>;
  hosts: string[];
  dry: boolean;
  withoutSkill: boolean;
  forwarded: string[];
};
type Outcomes = {
  execution: { status: string };
  grading: { status: string };
  task: { verdict: string };
};
type PublicResult = Outcomes & {
  format: string;
  runId: string | null;
  evidencePath: string | null;
  exitCode: number;
  cases: Array<Outcomes & { caseId: string; trials: Outcomes[] }>;
};
type GuideCell = {
  id: string;
  args: string[];
  resultsRoot: string;
  destination: string;
  activation: ActivationExpectation | null;
};
type Cancellation = {
  active: ReturnType<typeof Bun.spawn> | undefined;
  exitCode: number | undefined;
};

function binary(name: string) {
  const path = Bun.which(name);
  if (!path) throw new Error(`${name} command is unavailable`);
  return path;
}

const owned = new Set([
  "--host",
  "--condition",
  "--trials",
  "--jobs",
  "--threshold",
  "--dry",
  "--case-id",
  "--case-file",
  "--project-root",
  "--results-root",
  "--json",
  "--adapter-module",
  "--semantic-adapter-module",
]);

function forwardedHostArguments(host: string, forwarded: string[]) {
  const args: string[] = [];
  for (let index = 0; index < forwarded.length; index++) {
    const token = forwarded[index]!;
    const name = token.split("=", 1)[0]!;
    if (owned.has(name) || token === "--")
      throw new Error(`Guide option cannot be overridden: ${name}`);
    if (host !== "claude" && name.startsWith("--claude-")) {
      if (!token.includes("=") && name !== "--claude-project-settings") index++;
    } else args.push(token);
  }
  return args;
}

function hostDefaults(host: string): Array<[string, () => string]> {
  return [
    ["--model", () => (host === "codex" ? "gpt-6-luna" : "claude-sonnet-5-5")],
    ["--effort", () => "medium"],
    ["--codex-bin", () => binary("codex")],
    [
      "--codex-auth-file",
      () =>
        join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
    ],
    ["--semantic-host", () => "codex"],
    ["--semantic-model", () => "gpt-6-luna"],
    ["--semantic-effort", () => "medium"],
    ...(host === "claude"
      ? [["--claude-bin", () => binary("claude")] as [string, () => string]]
      : []),
  ];
}

function hostArguments(host: string, forwarded: string[], root: string) {
  const args = forwardedHostArguments(host, forwarded);
  const runtime = repositorySkillRuntimeFile(root);
  const defaults: Array<[string, () => string]> = [
    ...hostDefaults(host),
    ...(runtime
      ? [["--runtime-config-file", () => runtime] as [string, () => string]]
      : []),
  ];
  for (const [name, value] of defaults)
    if (optionValue(args, name) === null) args.push(name, value());
  return [
    "--host",
    host,
    ...args,
    ...(host === "claude" && !args.includes("--claude-project-settings")
      ? ["--claude-project-settings"]
      : []),
    "--condition",
    "passive",
    "--trials",
    "1",
    "--jobs",
    "1",
    "--threshold",
    "1",
    "--shell-isolation",
  ];
}

function selectedCase(result: PublicResult, code: number, id: string) {
  if ((code === 64 || code === 70) && result.cases.length === 0) return true;
  return result.cases.length === 1 && result.cases[0]?.caseId === id;
}

async function validateRetention(result: PublicResult, id: string) {
  if (
    [64, 70].includes(result.exitCode) &&
    result.evidencePath === null &&
    result.runId === null
  )
    return;
  if (!result.runId || !result.evidencePath || !isAbsolute(result.evidencePath))
    throw new Error(`Missing retained Sevro evidence for ${id}`);
  const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
  if (
    evidence.format !== "sevro.run-evidence.v1" ||
    evidence.runId !== result.runId ||
    !isDeepStrictEqual(evidence.result, result)
  )
    throw new Error(`Retained Sevro evidence differs for ${id}`);
}

async function publicResult(stdout: string, code: number, id: string) {
  const result = JSON.parse(stdout) as PublicResult;
  if (
    !validate(result) ||
    result.exitCode !== code ||
    !selectedCase(result, code, id)
  )
    throw new Error(`Invalid public Sevro result for ${id}`);
  await validateRetention(result, id);
  return result;
}

async function guideExpectations(options: GuideOptions) {
  const expectations = new Map<string, ActivationExpectation | null>();
  for (const question of options.questions) {
    const details = await preflightCaseDetails({
      projectRoot: pathToFileURL(options.root).href,
      selectors: { caseIds: [question.id] },
      configuration: {},
    });
    expectations.set(
      question.id,
      options.withoutSkill
        ? null
        : ((details.activation as ActivationExpectation | undefined) ?? null),
    );
  }
  return expectations;
}

function guideCells(
  options: GuideOptions,
  expectations: Map<string, ActivationExpectation | null>,
) {
  const routes = options.hosts.map((host) => ({
    host,
    args: hostArguments(host, options.forwarded, options.root),
  }));
  return options.questions.flatMap(({ id }) =>
    routes.map(({ host, args }) => {
      const resultsRoot = join(options.output, `${id}-${host}`);
      return {
        id,
        args,
        resultsRoot,
        destination: `${resultsRoot}.json`,
        activation: expectations.get(id) ?? null,
      };
    }),
  );
}

function cancellationControl() {
  const state: Cancellation = { active: undefined, exitCode: undefined };
  const cancel = (signal: "SIGINT" | "SIGTERM") => {
    state.exitCode ??= signal === "SIGINT" ? 130 : 143;
    state.active?.kill(signal);
  };
  const interrupt = () => cancel("SIGINT");
  const terminate = () => cancel("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  return {
    state,
    async dispose() {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
      if (state.active) {
        state.active.kill("SIGTERM");
        await state.active.exited;
      }
    },
  };
}

function guideCommand(options: GuideOptions, cell: GuideCell) {
  return [
    process.execPath,
    join(import.meta.dir, "run.ts"),
    "--case-id",
    cell.id,
    "--project-root",
    options.root,
    "--results-root",
    cell.resultsRoot,
    ...(options.withoutSkill ? ["--without-skill"] : []),
    "--",
    ...cell.args,
    ...(options.dry ? ["--dry"] : []),
  ];
}

async function captureCell(
  options: GuideOptions,
  cell: GuideCell,
  state: Cancellation,
) {
  const child = Bun.spawn(guideCommand(options, cell), {
    env: sevroEnvironment(),
    cwd: options.root,
    stdout: "pipe",
    stderr: "pipe",
  });
  state.active = child;
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  state.active = undefined;
  await writeFile(cell.destination, stdout);
  if (stderr) process.stderr.write(stderr);
  return { stdout, code };
}

async function validatedCellResult(
  captured: { stdout: string; code: number },
  cell: GuideCell,
  state: Cancellation,
) {
  try {
    return await publicResult(captured.stdout, captured.code, cell.id);
  } catch (error) {
    const diagnosticPath = join(cell.resultsRoot, "guide-result-error.json");
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(
      diagnosticPath,
      JSON.stringify(
        {
          format: "darrow-sevro-guide-result-error-v1",
          rawOutputPath: cell.destination,
          processExitCode: captured.code,
          cancellationExitCode: state.exitCode ?? null,
          error: message,
          result: null,
        },
        null,
        2,
      ) + "\n",
    );
    process.stderr.write(
      `Guide result unavailable: ${message}; inspect ${diagnosticPath}\n`,
    );
    return null;
  }
}

function successfulOutcomes(result: PublicResult, dry: boolean) {
  const expected = dry
    ? ["not_run", "not_requested", "not_assessed"]
    : ["completed", "completed", "passed"];
  const selected = result.cases[0]!;
  const outcomes = [result, selected, ...selected.trials];
  return (
    selected.trials.length === 1 &&
    outcomes.every(
      (row) =>
        row.execution.status === expected[0] &&
        row.grading.status === expected[1] &&
        row.task.verdict === expected[2],
    )
  );
}

function activationExit(result: PublicResult, cell: GuideCell, dry: boolean) {
  const activation = activationGate(
    cell.activation,
    { trials: 1, threshold: 1 },
    result.cases[0],
  );
  if (
    dry ||
    activation.status === "not_requested" ||
    activation.status === "passed"
  )
    return 0;
  process.stderr.write(
    `Guide activation ${activation.status}; inspect ${cell.destination} before continuing\n`,
  );
  return 1;
}

async function runCell(
  options: GuideOptions,
  cell: GuideCell,
  state: Cancellation,
) {
  if (state.exitCode !== undefined) return state.exitCode;
  await mkdir(cell.resultsRoot, { recursive: true });
  if (state.exitCode !== undefined) return state.exitCode;
  const captured = await captureCell(options, cell, state);
  const result = await validatedCellResult(captured, cell, state);
  if (state.exitCode !== undefined) return state.exitCode;
  if (captured.code !== 0) return captured.code;
  if (result === null) return 1;
  if (!successfulOutcomes(result, options.dry))
    throw new Error(
      `Guide case failed; inspect ${cell.destination} before continuing`,
    );
  return activationExit(result, cell, options.dry);
}

/** Run guide cells sequentially through Darrow's public Sevro command binding. */
export async function runSevroGuide(options: GuideOptions) {
  prepareRepositoryRuntime(options.root);
  const expectations = await guideExpectations(options);
  const cells = guideCells(options, expectations);
  const control = cancellationControl();
  try {
    for (const cell of cells) {
      const code = await runCell(options, cell, control.state);
      if (code !== 0) return code;
    }
    return control.state.exitCode ?? 0;
  } finally {
    await control.dispose();
  }
}
