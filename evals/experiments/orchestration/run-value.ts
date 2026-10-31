import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { callerHostOptions } from "../../sevro-extension/caller-host-options";
import { CODEX_EVAL_ROLE_DEFAULTS } from "../../sevro-extension/model-defaults";
import { runSuite } from "../../sevro-extension/suite";
import { historicalTasks, type prepareValue } from "./prepare-value";
import { startValueCI } from "./fixtures/value-ci";
type PreparedValue = Awaited<ReturnType<typeof prepareValue>>;

function absoluteOption(value: string | undefined) {
  if (!value || !isAbsolute(value))
    throw new Error("--snapshot and --output must be absolute");
  return value;
}

/** One cell per invocation: inspect failures before requesting another cell. */
function valueOptions(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      snapshot: { type: "string" },
      output: { type: "string" },
      track: { type: "string" },
      mode: { type: "string" },
      case: { type: "string" },
      dry: { type: "boolean", default: false },
    },
    strict: true,
  });
  const { track, mode, case: task } = values;
  const snapshot = absoluteOption(values.snapshot);
  const output = absoluteOption(values.output);
  if (track !== "implementation" && track !== "delivery")
    throw new Error("--track must be implementation or delivery");
  if (!task || !historicalTasks.includes(task))
    throw new Error("--case must name one of the four historical tasks");
  const candidate = track === "delivery" ? "ticket-to-pr" : "adaptive-goal";
  if (mode !== "vanilla" && mode !== candidate)
    throw new Error(`--mode must be vanilla or ${candidate}`);
  return { snapshot, output, track, mode, task, dry: values.dry };
}

function nativeHost(
  prepared: PreparedValue,
  mode: string,
  track: string,
  runtimeFile?: string,
) {
  return callerHostOptions(
    [
      "--runtime-config-file",
      runtimeFile ??
        join(
          prepared.project,
          `runtime-${mode === "vanilla" ? "vanilla" : `candidate-${track}`}.json`,
        ),
      "--jobs",
      "1",
      "--codex-timeout-ms",
      "1800000",
      "--retain-host-diagnostics",
    ],
    "codex",
    [],
    { projectRoot: prepared.project },
  );
}

export async function valueArguments(argv: string[], runtimeFile?: string) {
  const { snapshot, output, track, mode, task, dry } = valueOptions(argv);
  const prepared = (await Bun.file(
    join(snapshot, "benchmark.json"),
  ).json()) as PreparedValue;
  if (prepared.format !== "darrow-current-value-v1")
    throw new Error("Not a current-value snapshot");
  return [
    "--suite",
    prepared.suites[track]!,
    "--project-root",
    prepared.project,
    "--results-root",
    output,
    "--harness",
    "codex",
    "--mode",
    mode,
    "--case",
    `current-${track}-oss-${task}`,
    "--trials",
    "1",
    "--threshold",
    "1",
    "--seed",
    "current-value-n1",
    "--",
    "--host",
    "codex",
    "--model",
    prepared.candidate.model,
    "--effort",
    prepared.candidate.effort,
    "--semantic-host",
    "codex",
    "--semantic-model",
    CODEX_EVAL_ROLE_DEFAULTS.semanticOutputGrader.model,
    "--semantic-effort",
    CODEX_EVAL_ROLE_DEFAULTS.semanticOutputGrader.effort,
    ...nativeHost(prepared, mode, track, runtimeFile),
    "--codex-entrypoint",
    "app-server",
    ...(dry ? ["--dry"] : []),
  ];
}

async function deliveryRuntime(argv: string[]) {
  const options = valueOptions(argv);
  if (options.track !== "delivery") return null;
  const prepared = (await Bun.file(
    join(options.snapshot, "benchmark.json"),
  ).json()) as PreparedValue;
  await mkdir(options.output);
  const directory = join(
    prepared.project,
    "evals/experiments/current-value/cases",
    options.task,
  );
  const server = await startValueCI(
    join(directory, "task.json"),
    join(options.output, "ci-server.jsonl"),
  );
  const profile = `runtime-${options.mode === "vanilla" ? "vanilla" : "candidate-delivery"}.json`;
  const runtime = JSON.parse(
    await readFile(join(prepared.project, profile), "utf8"),
  );
  runtime.environment.set.DARROW_BENCHMARK_CI_URL = server.url.toString();
  const runtimeFile = join(options.output, "runtime.json");
  await writeFile(runtimeFile, JSON.stringify(runtime, null, 2));
  return { server, runtimeFile };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  let runtime: Awaited<ReturnType<typeof deliveryRuntime>> = null;
  try {
    runtime = await deliveryRuntime(argv);
    const result = await runSuite(
      await valueArguments(argv, runtime?.runtimeFile),
    );
    console.log(JSON.stringify(result));
    process.exitCode =
      result.interrupted === "SIGINT"
        ? 130
        : result.interrupted === "SIGTERM"
          ? 143
          : result.failed ||
              result.activationFailed ||
              result.activationUnavailable ||
              result.report.error ||
              result.qualityReport.error
            ? 1
            : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 64;
  } finally {
    runtime?.server.stop(true);
  }
}
