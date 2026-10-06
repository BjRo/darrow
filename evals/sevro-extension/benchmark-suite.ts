import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { callerHostOptions } from "./caller-host-options";
import { CODEX_EVAL_ROLE_DEFAULTS } from "./model-defaults";
import { sevroCommand } from "./sevro-command";

const repositoryRoot = resolve(import.meta.dir, "../..");
const benchmarkOptions = {
  suite: { type: "string" },
  harness: { type: "string", multiple: true },
  mode: { type: "string", multiple: true },
  case: { type: "string", multiple: true },
  trials: { type: "string", default: "5" },
  threshold: { type: "string", default: "0.8" },
  seed: { type: "string" },
  output: { type: "string" },
  "project-root": { type: "string" },
  effort: {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.candidate.effort,
  },
  "codex-model": {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.candidate.model,
  },
  "claude-model": { type: "string", default: "claude-sonnet-5-5" },
  dry: { type: "boolean", default: false },
  "no-judge": { type: "boolean", default: false },
  "semantic-check-harness": { type: "string", default: "codex" },
  "semantic-check-model": {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.semanticOutputGrader.model,
  },
  "semantic-check-effort": {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.semanticOutputGrader.effort,
  },
  "judge-harness": { type: "string", default: "codex" },
  "judge-model": {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.qualityJudge.model,
  },
  "judge-effort": {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.qualityJudge.effort,
  },
} as const;

function invocation(argv: string[]) {
  const separator = argv.indexOf("--");
  const { values } = parseArgs({
    args: separator < 0 ? argv : argv.slice(0, separator),
    options: benchmarkOptions,
    strict: true,
  });
  const projectRoot = values["project-root"] ?? repositoryRoot;
  if (!isAbsolute(projectRoot))
    throw new Error("--project-root must be absolute");
  if (values["semantic-check-harness"] !== "codex")
    throw new Error(
      "Sevro benchmark semantic grading currently requires Codex",
    );
  if (!values.dry && !values["no-judge"] && values["judge-harness"] !== "codex")
    throw new Error(
      "Sevro benchmark advisory grading currently requires Codex",
    );
  return {
    values,
    projectRoot,
    suitePath: resolve(
      values.suite ??
        join(projectRoot, "evals/experiments/orchestration/suite.yaml"),
    ),
    forwarded: separator < 0 ? [] : argv.slice(separator + 1),
  };
}
type Request = ReturnType<typeof invocation>;

function hostArguments(host: string, request: Request) {
  const args = callerHostOptions(request.forwarded, host);
  return [
    "--host",
    host,
    "--model",
    request.values[host === "codex" ? "codex-model" : "claude-model"]!,
    "--effort",
    request.values.effort!,
    "--semantic-host",
    "codex",
    "--semantic-model",
    request.values["semantic-check-model"]!,
    "--semantic-effort",
    request.values["semantic-check-effort"]!,
    ...(!request.values.dry && !request.values["no-judge"]
      ? [
          "--advisory-host",
          "codex",
          "--advisory-model",
          request.values["judge-model"]!,
          "--advisory-effort",
          request.values["judge-effort"]!,
        ]
      : []),
    ...args,
  ];
}

function selectedHarnesses(harnesses: unknown): string[] {
  if (
    !Array.isArray(harnesses) ||
    !harnesses.length ||
    new Set(harnesses).size !== harnesses.length ||
    harnesses.some((host) => !["codex", "claude"].includes(host))
  )
    throw new Error("Benchmark harness selection must be unique and supported");
  return harnesses as string[];
}

function outputDirectory(request: Request, experiment: unknown) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (
    typeof experiment !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(experiment)
  )
    throw new Error("Benchmark suite requires an experiment directory name");
  return request.values.output === undefined
    ? join(request.projectRoot, "evals/results", experiment, stamp)
    : resolve(request.values.output);
}

async function suiteArguments(request: Request) {
  const suite = parseYaml(await readFile(request.suitePath, "utf8")) as {
    experiment?: unknown;
    harnesses?: unknown;
  };
  const harnesses = selectedHarnesses(
    request.values.harness ?? suite.harnesses ?? ["claude", "codex"],
  );
  const output = outputDirectory(request, suite.experiment);
  const routes = Object.fromEntries(
    harnesses.map((host) => [host, hostArguments(host, request)]),
  );
  await mkdir(output, { recursive: true });
  const hostOptionsFile = join(output, "caller-host-options.json");
  await writeFile(hostOptionsFile, JSON.stringify(routes, null, 2));
  process.stderr.write(`Suite evidence: ${output}\n`);
  return [
    "--suite",
    request.suitePath,
    "--project-root",
    request.projectRoot,
    "--results-root",
    output,
    "--host-options-file",
    hostOptionsFile,
    "--trials",
    request.values.trials!,
    "--threshold",
    request.values.threshold!,
    ...harnesses.flatMap((host) => ["--harness", host]),
    ...(request.values.mode ?? []).flatMap((mode) => ["--mode", mode]),
    ...(request.values.case ?? []).flatMap((filter) => ["--case", filter]),
    ...(request.values.seed === undefined
      ? []
      : ["--seed", request.values.seed]),
    "--",
    ...(request.values.dry ? ["--dry"] : []),
  ];
}

/** Preserve the benchmark caller while selecting the public Sevro suite route. */
export async function runSevroBenchmarkSuite(argv: string[]) {
  try {
    sevroCommand();
    const args = await suiteArguments(invocation(argv));
    const child = Bun.spawn(
      [process.execPath, join(import.meta.dir, "suite.ts"), ...args],
      {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    const interrupt = () => child.kill("SIGINT");
    const terminate = () => child.kill("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    try {
      return await child.exited;
    } finally {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
    }
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 64;
  }
}
