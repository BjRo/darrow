import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { optionValue } from "./suite-routes";
import { sevroCommand } from "./sevro-command";

const repositoryRoot = resolve(import.meta.dir, "../..");
const nativeOptions = new Set([
  "--codex-bin",
  "--codex-auth-file",
  "--claude-bin",
  "--claude-credential-file",
  "--claude-uv-cache-dir",
  "--claude-project-settings",
  "--toolchain-bin-dir",
  "--config-root",
  "--run-state-root",
  "--protected-root",
  "--jobs",
  "--shell-isolation",
]);
const claudeOptions = new Set([
  "--claude-bin",
  "--claude-credential-file",
  "--claude-uv-cache-dir",
  "--claude-project-settings",
]);

function nativeOption(args: string[], index: number) {
  const token = args[index]!;
  const name = token.split("=", 1)[0]!;
  if (!nativeOptions.has(name))
    throw new Error(`Benchmark option cannot be forwarded: ${name}`);
  const takesValue = ![
    "--shell-isolation",
    "--claude-project-settings",
  ].includes(name);
  if (!takesValue || token.includes("="))
    return { name, args: [token], next: index + 1 };
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--"))
    throw new Error(`Missing value for ${name}`);
  return { name, args: [token, value], next: index + 2 };
}

function nativeArguments(args: string[], host: string) {
  const result: string[] = [];
  for (let index = 0; index < args.length;) {
    const option = nativeOption(args, index);
    if (host === "claude" || !claudeOptions.has(option.name))
      result.push(...option.args);
    index = option.next;
  }
  return result;
}

function binary(name: string) {
  const path = Bun.which(name);
  if (!path) throw new Error(`${name} command is unavailable`);
  return path;
}

function invocation(argv: string[]) {
  const separator = argv.indexOf("--");
  const { values } = parseArgs({
    args: separator < 0 ? argv : argv.slice(0, separator),
    options: {
      suite: { type: "string" },
      harness: { type: "string", multiple: true },
      mode: { type: "string", multiple: true },
      case: { type: "string", multiple: true },
      trials: { type: "string", default: "5" },
      threshold: { type: "string", default: "0.8" },
      seed: { type: "string" },
      output: { type: "string" },
      "project-root": { type: "string" },
      effort: { type: "string", default: "medium" },
      "codex-model": { type: "string", default: "gpt-5.6-terra" },
      "claude-model": { type: "string", default: "claude-sonnet-5" },
      dry: { type: "boolean", default: false },
      "no-judge": { type: "boolean", default: false },
      "semantic-check-harness": { type: "string", default: "codex" },
      "semantic-check-model": { type: "string", default: "gpt-5.6-luna" },
      "semantic-check-effort": { type: "string", default: "low" },
      "judge-harness": { type: "string", default: "codex" },
      "judge-model": { type: "string", default: "gpt-5.6-sol" },
      "judge-effort": { type: "string", default: "low" },
    },
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
  const args = nativeArguments(request.forwarded, host);
  const defaults: Array<[string, () => string]> = [
    ["--codex-bin", () => binary("codex")],
    [
      "--codex-auth-file",
      () =>
        join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
    ],
    ...(host === "claude"
      ? [["--claude-bin", () => binary("claude")] as [string, () => string]]
      : []),
  ];
  for (const [name, value] of defaults)
    if (optionValue(args, name) === null) args.push(name, value());
  if (host === "claude" && !args.includes("--claude-project-settings"))
    args.push("--claude-project-settings");
  if (!args.includes("--shell-isolation")) args.push("--shell-isolation");
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
