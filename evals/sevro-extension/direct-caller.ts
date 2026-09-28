import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { callerHostOptions } from "./caller-host-options";
import { CODEX_EVAL_ROLE_DEFAULTS } from "./model-defaults";
import { runSelection, type SelectionRun } from "./selection";
import { activationGate, type ActivationExpectation } from "./activation";
import { preflightCaseDetails } from "./index";
import { invocation } from "./run";
import { sevroCommand } from "./sevro-command";
import { suiteCaseRoutes } from "./suite-routes";
import { readCorpusManifest } from "../corpus/orchestration/source";

const directOptions = {
  "project-root": { type: "string" },
  "results-root": { type: "string" },
  "config-root": { type: "string" },
  "run-state-root": { type: "string" },
  output: { type: "string" },
  skill: { type: "string" },
  plugin: { type: "string" },
  "skill-dir": { type: "string" },
  "corpus-manifest": { type: "string" },
  "without-skill": { type: "boolean" },
  "mount-plugin-skills": { type: "boolean" },
  condition: { type: "string" },
  "condition-label": { type: "string" },
  "require-evaluation-records": { type: "boolean" },
  "assert-effective-owner-routes": { type: "string" },
  harness: { type: "string" },
  model: { type: "string" },
  effort: {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.candidate.effort,
  },
  "case-routes": { type: "string" },
  "semantic-check-harness": { type: "string", default: "codex" },
  "semantic-check-model": {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.semanticOutputGrader.model,
  },
  "semantic-check-effort": {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.semanticOutputGrader.effort,
  },
  "judge-harness": { type: "string" },
  "judge-model": {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.qualityJudge.model,
  },
  "judge-effort": {
    type: "string",
    default: CODEX_EVAL_ROLE_DEFAULTS.qualityJudge.effort,
  },
  case: { type: "string", multiple: true },
  trials: { type: "string", default: "5" },
  jobs: { type: "string", default: "3" },
  threshold: { type: "string", default: "0.8" },
  "owner-evaluation": { type: "string", default: "enforced" },
  dry: { type: "boolean", default: false },
  "no-color": { type: "boolean" },
  "no-emoji": { type: "boolean" },
  "no-progress": { type: "boolean" },
} as const;

function parseOptions(argv: string[]) {
  const separator = argv.indexOf("--");
  const { values } = parseArgs({
    args: separator < 0 ? argv : argv.slice(0, separator),
    options: directOptions,
    strict: true,
  });
  return { values, forwarded: separator < 0 ? [] : argv.slice(separator + 1) };
}

type Values = ReturnType<typeof parseOptions>["values"];

function candidateHost(host: string | undefined) {
  if (host !== "codex" && host !== "claude")
    throw new Error("--harness must be codex or claude");
  return host;
}

function validateLimits(values: Values) {
  for (const name of ["trials", "jobs"] as const) {
    const value = Number(values[name]);
    if (!Number.isInteger(value) || value < 1)
      throw new Error(`--${name} must be a positive integer`);
  }
  const threshold = Number(values.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1)
    throw new Error("--threshold must be greater than 0 and at most 1");
  if (!["passive", "enforced"].includes(values["owner-evaluation"]!))
    throw new Error("--owner-evaluation must be passive or enforced");
}

function validateGraders(values: Values) {
  if (
    values["semantic-check-harness"] !== "codex" ||
    (values["judge-harness"] !== undefined &&
      values["judge-harness"] !== "codex")
  )
    throw new Error("Sevro direct caller graders currently require Codex");
}

function requestOptions(argv: string[]) {
  const { values, forwarded } = parseOptions(argv);
  const host = candidateHost(values.harness);
  validateLimits(values);
  validateGraders(values);
  const caseRoutes =
    values["case-routes"] === undefined
      ? undefined
      : suiteCaseRoutes({ [host]: JSON.parse(values["case-routes"]) })[host];
  const projectRoot = resolve(
    values["project-root"] ?? join(import.meta.dir, "../.."),
  );
  const resultsRoot = resolve(
    values["results-root"] ?? join(projectRoot, "evals/results"),
  );
  const outputPath =
    values.output === undefined ? undefined : resolve(values.output);
  return {
    values,
    forwarded,
    host,
    caseRoutes,
    projectRoot,
    resultsRoot,
    outputPath,
    filters: values.case ?? [],
  };
}
type Request = ReturnType<typeof requestOptions>;

function ownArguments(request: Request) {
  const { values } = request;
  const args = [
    "--project-root",
    request.projectRoot,
    "--results-root",
    request.resultsRoot,
  ];
  const strings = [
    ["skill", "--skill", false],
    ["plugin", "--plugin", false],
    ["skill-dir", "--skill-dir", true],
    ["corpus-manifest", "--corpus-manifest", true],
    ["condition", "--benchmark-condition-file", true],
    ["condition-label", "--benchmark-condition-label", false],
    ["assert-effective-owner-routes", "--assert-effective-owner-routes", false],
  ] as const;
  for (const [field, option, path] of strings) {
    const value = values[field];
    if (value !== undefined) args.push(option, path ? resolve(value) : value);
  }
  for (const name of [
    "without-skill",
    "mount-plugin-skills",
    "require-evaluation-records",
  ] as const)
    if (values[name]) args.push("--" + name);
  return [...args, ...request.filters.flatMap((filter) => ["--case", filter])];
}

function routeArguments(request: Request) {
  const { values, host } = request;
  return [
    "--host",
    host,
    "--model",
    values.model ??
      (host === "codex"
        ? CODEX_EVAL_ROLE_DEFAULTS.candidate.model
        : "claude-sonnet-5"),
    "--effort",
    values.effort!,
    "--semantic-host",
    "codex",
    "--semantic-model",
    values["semantic-check-model"]!,
    "--semantic-effort",
    values["semantic-check-effort"]!,
    ...(values["judge-harness"]
      ? [
          "--advisory-host",
          "codex",
          "--advisory-model",
          values["judge-model"]!,
          "--advisory-effort",
          values["judge-effort"]!,
        ]
      : []),
    "--condition",
    values["owner-evaluation"]!,
    "--trials",
    values.trials!,
    "--threshold",
    values.threshold!,
    "--jobs",
    values.jobs!,
    ...(values.dry ? ["--dry"] : []),
  ];
}

async function nativeArguments(request: Request) {
  const args = callerHostOptions(
    request.forwarded,
    request.host,
    ["--config-root", "--run-state-root", "--jobs"],
    "Direct caller",
  );
  for (const name of ["config-root", "run-state-root"] as const)
    if (request.values[name] !== undefined)
      args.push("--" + name, resolve(request.values[name]));
  args.push("--protected-root", request.resultsRoot);
  if (request.outputPath) {
    await mkdir(dirname(request.outputPath), { recursive: true });
    args.push("--protected-root", dirname(request.outputPath));
  }
  return args;
}

async function directActivation(
  request: Request,
  run: SelectionRun,
  argv: string[],
) {
  const limits = {
    trials: Number(request.values.trials),
    threshold: Number(request.values.threshold),
  };
  const selected = invocation(argv);
  if (selected.withoutSkill) return activationGate(null, limits, null);
  const configuration = selected.command.includes(
    "--extension-configuration-file",
  )
    ? JSON.parse(
        await readFile(
          join(selected.resultsRoot, "darrow-extension-configuration.json"),
          "utf8",
        ),
      )
    : {};
  const details = await preflightCaseDetails({
    projectRoot: pathToFileURL(selected.projectRoot).href,
    selectors: { caseIds: [run.caseId] },
    configuration,
  });
  const result = run.result as { cases?: unknown[] } | null;
  return activationGate(
    (details.activation as ActivationExpectation | undefined) ?? null,
    limits,
    result?.cases?.[0],
  );
}

/** Map the existing direct evaluation command to the public Sevro selection route. */
export async function runSevroDirect(argv: string[]) {
  try {
    sevroCommand();
    const request = requestOptions(argv);
    if (request.values["corpus-manifest"] !== undefined)
      await readCorpusManifest(resolve(request.values["corpus-manifest"]));
    const args = [
      ...ownArguments(request),
      "--",
      ...routeArguments(request),
      ...(await nativeArguments(request)),
    ];
    return await runSelection(args, {
      projectRoot: request.projectRoot,
      resultsRoot: request.resultsRoot,
      filters: request.filters,
      skill: request.values.skill,
      plugin: request.values.plugin,
      caseRoutes: request.caseRoutes,
      outputPath: request.outputPath,
      assessActivation: (run, argv) => directActivation(request, run, argv),
    });
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 64;
  }
}
