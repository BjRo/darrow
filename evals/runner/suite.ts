import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";

interface ModeConfig {
  condition?: string;
  condition_by_harness?: Record<string, string>;
  skill_dir?: string;
  mount_plugin_skills?: boolean;
  require_evaluation_records?: boolean;
  apply_goal_route?: boolean;
}

interface SuiteConfig {
  version: number;
  experiment: string;
  case_filter: string;
  modes: Record<string, ModeConfig>;
}

async function git(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: resolve(import.meta.dir, "..", ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  return stdout;
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
    case: { type: "string" },
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

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const orderSeed = values.seed ?? stamp;
const outputDir = values.output
  ? resolve(process.cwd(), values.output)
  : resolve(import.meta.dir, "..", "results", suite.experiment, stamp);
await mkdir(outputDir, { recursive: true });
const runnerRevision = (await git(["rev-parse", "HEAD"])).trim();
const runnerStatus = await git(["status", "--porcelain"]);
const runnerPatch = await git(["diff", "--binary", "HEAD"]);
const runnerPatchSha256 = runnerPatch
  ? new Bun.CryptoHasher("sha256").update(runnerPatch).digest("hex")
  : null;
if (runnerPatch) await writeFile(join(outputDir, "runner.patch"), runnerPatch);

const manifest = {
  format: "darrow-orchestration-suite-v1",
  suite: suitePath,
  startedAt: new Date().toISOString(),
  trials: Number(values.trials),
  threshold: Number(values.threshold),
  effort: values.effort,
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
          model: values["judge-model"] ?? null,
          effort: values["judge-effort"],
        },
  cells: [] as Array<{
    harness: string;
    mode: string;
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
  if (!condition) {
    throw new Error(`${modeName} has no condition for harness ${harness}`);
  }
  const resultPath = join(outputDir, `${harness}-${modeName}.json`);
  const args = [
    "bun",
    resolve(import.meta.dir, "run.ts"),
    "--harness",
    harness,
    "--condition",
    resolve(suiteDir, condition),
    "--condition-label",
    modeName,
    "--case",
    values.case ?? suite.case_filter,
    "--trials",
    values.trials!,
    "--threshold",
    values.threshold!,
    "--effort",
    values.effort!,
    "--output",
    resultPath,
  ];
  const model =
    harness === "claude" ? values["claude-model"] : values["codex-model"];
  if (model) args.push("--model", model);
  if (mode.skill_dir) {
    args.push("--skill-dir", resolve(suiteDir, mode.skill_dir));
  }
  if (mode.mount_plugin_skills) args.push("--mount-plugin-skills");
  if (mode.require_evaluation_records)
    args.push("--require-evaluation-records");
  if (mode.apply_goal_route) args.push("--apply-goal-route");
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
process.exit(
  reportExit !== 0 || manifest.cells.some((cell) => cell.exitCode !== 0)
    ? 1
    : 0,
);
