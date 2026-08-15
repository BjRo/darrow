import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import {
  validateAblationDefinitions,
  type AblationDefinition,
} from "./ablation";
import { claudeAdapter } from "./adapters/claude";
import { codexAdapter } from "./adapters/codex";
import { codexGoalAdapter } from "./adapters/codex-goal";
import { hasGatingCellFailure } from "./suite-policy";
import { captureProcess } from "./process";

interface ModeConfig {
  /** Defaults to true. False keeps the mode as comparative evidence only. */
  gating?: boolean;
  condition?: string;
  condition_by_harness?: Record<string, string>;
  entrypoint_by_harness?: Record<string, string>;
  skill_dir?: string;
  additional_skill_dirs?: string[];
  required_skill_activations?: Record<string, string[]>;
  mount_plugin_skills?: boolean;
  require_evaluation_records?: boolean;
  apply_goal_route?: boolean;
  apply_expected_goal_routes?: boolean;
  apply_case_routes?: boolean;
  effort?: string;
  goal_expectations?: string;
  without_skill?: boolean;
}

interface GoalExpectation {
  model: string;
  effort: string;
  profile: string;
  workflow: string;
  risk: "routine" | "elevated" | "high";
}

interface SuiteConfig {
  version: number;
  experiment: string;
  case_filter: string | string[];
  case_match?: "substring" | "exact";
  modes: Record<string, ModeConfig>;
  case_routes?: Record<
    string,
    Record<string, { model: string; effort: string }>
  >;
  goal_expectations?: Record<string, Record<string, GoalExpectation>>;
  ablations?: AblationDefinition[];
}

const REPOSITORY_ROOT = resolve(import.meta.dir, "..", "..");

async function git(args: string[], acceptedExitCodes = [0]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: REPOSITORY_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const { out: stdout, err: stderr, code } = await captureProcess(proc);
  if (!acceptedExitCodes.includes(code))
    throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  return stdout;
}

async function repositoryPatch(): Promise<string> {
  let patch = await git(["diff", "--binary", "HEAD"]);
  const untracked = (
    await git(["ls-files", "--others", "--exclude-standard", "-z"])
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const path of untracked) {
    patch += await git(
      ["diff", "--binary", "--no-index", "--", "/dev/null", path],
      [0, 1],
    );
  }
  return patch;
}

function parseEvidenceLimits(
  rawTrials: string,
  rawThreshold: string,
): { trials: number; threshold: number } {
  const trials = Number(rawTrials);
  const threshold = Number(rawThreshold);
  if (!Number.isInteger(trials) || trials < 1)
    throw new Error("suite trials must be a positive integer");
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1)
    throw new Error("suite threshold must be greater than 0 and at most 1");
  return { trials, threshold };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619) >>> 0;
  }
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const target = (state >>> 0) % (index + 1);
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

const { values } = parseArgs({
  options: {
    suite: { type: "string" },
    harness: { type: "string", multiple: true },
    mode: { type: "string", multiple: true },
    case: { type: "string", multiple: true },
    trials: { type: "string", default: "5" },
    threshold: { type: "string", default: "0.8" },
    effort: { type: "string", default: "medium" },
    "claude-model": { type: "string" },
    "codex-model": { type: "string" },
    output: { type: "string" },
    dry: { type: "boolean", default: false },
    "judge-harness": { type: "string", default: "codex" },
    "judge-model": { type: "string" },
    "judge-effort": { type: "string", default: "low" },
    "no-judge": { type: "boolean", default: false },
    seed: { type: "string" },
  },
});

const defaultSuite = resolve(
  import.meta.dir,
  "..",
  "experiments",
  "orchestration",
  "suite.yaml",
);
const suitePath = values.suite
  ? resolve(process.cwd(), values.suite)
  : defaultSuite;
const suiteDir = dirname(suitePath);
const suite = parseYaml(await readFile(suitePath, "utf8")) as SuiteConfig;
const evidenceLimits = parseEvidenceLimits(values.trials!, values.threshold!);
if (
  suite.version !== 1 ||
  !suite.experiment ||
  !suite.case_filter ||
  !suite.modes
) {
  throw new Error(
    "suite must use version 1 and define experiment, case_filter, and modes",
  );
}
if (
  suite.case_match &&
  suite.case_match !== "substring" &&
  suite.case_match !== "exact"
) {
  throw new Error("suite case_match must be substring or exact");
}

const harnesses = values.harness ?? ["claude", "codex"];
for (const harness of harnesses) {
  if (harness !== "claude" && harness !== "codex") {
    throw new Error(`unsupported suite harness: ${harness}`);
  }
}
const modes = values.mode ?? Object.keys(suite.modes);
for (const mode of modes) {
  if (!suite.modes[mode]) throw new Error(`unknown suite mode: ${mode}`);
}
const ablationErrors = validateAblationDefinitions(
  suite.modes,
  suite.ablations ?? [],
);
if (ablationErrors.length)
  throw new Error(`invalid ablation definitions: ${ablationErrors.join("; ")}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const orderSeed = values.seed ?? stamp;
const outputDir = values.output
  ? resolve(process.cwd(), values.output)
  : resolve(import.meta.dir, "..", "results", suite.experiment, stamp);
await mkdir(outputDir, { recursive: true });
const runnerRevision = (await git(["rev-parse", "HEAD"])).trim();
const runnerStatus = await git(["status", "--porcelain"]);
const runnerPatch = await repositoryPatch();
const runnerPatchSha256 = runnerPatch
  ? new Bun.CryptoHasher("sha256").update(runnerPatch).digest("hex")
  : null;
if (runnerPatch) await writeFile(join(outputDir, "runner.patch"), runnerPatch);

const manifest = {
  format: "darrow-orchestration-suite-v1",
  suite: suitePath,
  startedAt: new Date().toISOString(),
  trials: evidenceLimits.trials,
  threshold: evidenceLimits.threshold,
  effort: values.effort,
  harnesses,
  modes,
  models: {
    claude: values["claude-model"] ?? claudeAdapter.defaultModel,
    codex: values["codex-model"] ?? codexAdapter.defaultModel,
  },
  ablations: suite.ablations ?? [],
  dry: values.dry,
  orderSeed,
  runner: {
    revision: runnerRevision,
    dirty: runnerStatus.length > 0,
    patchSha256: runnerPatchSha256,
    patch: runnerPatch ? join(outputDir, "runner.patch") : null,
  },
  judge:
    values.dry || values["no-judge"]
      ? null
      : {
          harness: values["judge-harness"],
          model:
            values["judge-model"] ??
            (values["judge-harness"] === "claude"
              ? claudeAdapter.defaultModel
              : codexAdapter.defaultModel),
          effort: values["judge-effort"],
        },
  cells: [] as Array<{
    harness: string;
    mode: string;
    fallbackModel: string;
    fallbackEffort: string;
    caseRoutes: Record<string, { model: string; effort: string }> | null;
    entrypoint: string | null;
    gating: boolean;
    result: string;
    exitCode: number;
  }>,
};

const cellPlan = seededShuffle(
  harnesses.flatMap((harness) =>
    modes.map((modeName) => ({ harness, modeName })),
  ),
  orderSeed,
);
for (const { harness, modeName } of cellPlan) {
  const mode = suite.modes[modeName]!;
  const condition = mode.condition_by_harness?.[harness] ?? mode.condition;
  const entrypoint = mode.entrypoint_by_harness?.[harness];
  if (mode.entrypoint_by_harness && !entrypoint?.trim()) {
    throw new Error(
      `${modeName} has no entrypoint adapter for harness ${harness}`,
    );
  }
  const resultPath = join(outputDir, `${harness}-${modeName}.json`);
  const model =
    harness === "claude"
      ? (values["claude-model"] ?? claudeAdapter.defaultModel)
      : (values["codex-model"] ??
        (mode.apply_goal_route
          ? codexGoalAdapter.defaultModel
          : codexAdapter.defaultModel));
  const effort = mode.effort ?? values.effort!;
  const args = [
    "bun",
    resolve(import.meta.dir, "run.ts"),
    "--harness",
    harness,
    "--trials",
    String(evidenceLimits.trials),
    "--threshold",
    String(evidenceLimits.threshold),
    "--effort",
    effort,
    "--model",
    model,
    "--output",
    resultPath,
  ];
  if (condition) {
    args.push(
      "--condition",
      resolve(suiteDir, condition),
      "--condition-label",
      modeName,
    );
  }
  if (entrypoint) args.push("--entrypoint", entrypoint);
  const caseFilters =
    values.case ??
    (Array.isArray(suite.case_filter)
      ? suite.case_filter
      : [suite.case_filter]);
  for (const caseFilter of caseFilters) args.push("--case", caseFilter);
  if (!values.case && suite.case_match === "exact") args.push("--case-exact");
  if (mode.skill_dir) {
    args.push("--skill-dir", resolve(suiteDir, mode.skill_dir));
  }
  for (const skillDir of mode.additional_skill_dirs ?? []) {
    args.push("--additional-skill-dir", resolve(suiteDir, skillDir));
  }
  if (mode.required_skill_activations) {
    args.push(
      "--required-skill-activations",
      JSON.stringify(mode.required_skill_activations),
    );
  }
  if (mode.mount_plugin_skills) args.push("--mount-plugin-skills");
  if (mode.without_skill) args.push("--without-skill");
  if (mode.require_evaluation_records)
    args.push("--require-evaluation-records");
  if (mode.apply_goal_route) args.push("--apply-goal-route");
  if (mode.apply_expected_goal_routes) {
    const routes = suite.case_routes?.[harness];
    if (!routes)
      throw new Error(
        `${modeName} requests expected goal routes but no case routes exist for ${harness}`,
      );
    args.push("--expected-goal-routes", JSON.stringify(routes));
  }
  if (mode.goal_expectations) {
    const expectations = suite.goal_expectations?.[mode.goal_expectations];
    if (!expectations)
      throw new Error(
        `${modeName} names unknown goal expectations: ${mode.goal_expectations}`,
      );
    const routes = Object.fromEntries(
      Object.entries(expectations).map(([caseId, value]) => [
        caseId,
        { model: value.model, effort: value.effort },
      ]),
    );
    const dimensions = Object.fromEntries(
      Object.entries(expectations).map(([caseId, value]) => [
        caseId,
        {
          profile: value.profile,
          workflow: value.workflow,
          risk: value.risk,
        },
      ]),
    );
    args.push("--assert-goal-routes", JSON.stringify(routes));
    args.push("--assert-goal-dimensions", JSON.stringify(dimensions));
  }
  if (mode.apply_case_routes) {
    const routes = suite.case_routes?.[harness];
    if (!routes)
      throw new Error(
        `${modeName} requests case routes but none exist for ${harness}`,
      );
    args.push("--case-routes", JSON.stringify(routes));
  }
  if (values.dry) args.push("--dry");
  if (!values.dry && !values["no-judge"]) {
    args.push(
      "--judge-harness",
      values["judge-harness"]!,
      "--judge-effort",
      values["judge-effort"]!,
    );
    if (values["judge-model"])
      args.push("--judge-model", values["judge-model"]);
  }

  console.log(`\n=== ${harness} / ${modeName} ===`);
  const proc = Bun.spawn(args, {
    cwd: resolve(import.meta.dir, "..", ".."),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  manifest.cells.push({
    harness,
    mode: modeName,
    fallbackModel: model,
    fallbackEffort: effort,
    caseRoutes: mode.apply_case_routes
      ? (suite.case_routes?.[harness] ?? null)
      : null,
    entrypoint: entrypoint ?? null,
    gating: mode.gating !== false,
    result: resultPath,
    exitCode,
  });
  await writeFile(
    join(outputDir, "suite-run.json"),
    JSON.stringify(manifest, null, 2),
  );
  if (exitCode !== 0 && !values.dry) {
    console.error(`${harness}/${modeName} failed; continuing remaining cells`);
  }
}

console.log(`\nSuite results: ${outputDir}`);
console.log(`Manifest: ${join(outputDir, basename("suite-run.json"))}`);
const missingResults = manifest.cells.filter(
  (cell) => !existsSync(cell.result),
);
if (missingResults.length) {
  console.error(
    `Reports skipped: ${missingResults.length} cell result file(s) are missing`,
  );
  process.exit(1);
}
const report = Bun.spawn(
  [
    "bun",
    resolve(import.meta.dir, "report.ts"),
    join(outputDir, "suite-run.json"),
  ],
  {
    cwd: resolve(import.meta.dir, "..", ".."),
    stdout: "inherit",
    stderr: "inherit",
  },
);
const reportExit = await report.exited;
let ablationExit = 0;
if (suite.ablations?.length) {
  const ablation = Bun.spawn(
    [
      "bun",
      resolve(import.meta.dir, "ablation.ts"),
      join(outputDir, "suite-run.json"),
    ],
    {
      cwd: resolve(import.meta.dir, "..", ".."),
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  ablationExit = await ablation.exited;
}
process.exit(
  reportExit !== 0 || ablationExit !== 0 || hasGatingCellFailure(manifest.cells)
    ? 1
    : 0,
);
