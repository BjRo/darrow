#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { stringify as stringifyYaml } from "yaml";
import { analyze } from "./src/analyze";
import {
  loadCorpus,
  loadProtocol,
  parseSourceArgs,
  REPO_ROOT,
  SUITE_ROOT,
} from "./src/config";
import { buildSchedule } from "./src/schedule";
import { poweredTasks } from "./src/stats";
import { runAssignment } from "./src/runner";
import { exportBlindBundles, importBlindGrades } from "./src/grading";
import { preflightSources } from "./src/preflight";
import { importAnnotations } from "./src/annotations";
import type { Harness, Phase, Treatment } from "./src/types";

const command = process.argv[2];
const { values } = parseArgs({
  args: process.argv.slice(3),
  options: {
    phase: { type: "string", default: "pilot" },
    source: { type: "string", multiple: true, default: [] },
    task: { type: "string" },
    harness: { type: "string" },
    treatment: { type: "string" },
    results: {
      type: "string",
      default: resolve(SUITE_ROOT, "results"),
    },
    grades: { type: "string" },
    annotations: { type: "string" },
  },
});
const protocol = await loadProtocol();
const corpus = await loadCorpus();
const phase = values.phase as Phase;
if (phase !== "pilot" && phase !== "confirmatory")
  throw new Error("--phase must be pilot or confirmatory");
const schedule = buildSchedule(protocol, corpus, phase);

async function phaseSpend(resultsRoot: string) {
  let costUsd = 0;
  let tokens = 0;
  const glob = new Bun.Glob("runs/*/observation.json");
  for await (const rel of glob.scan(resultsRoot)) {
    const observation = JSON.parse(
      await readFile(join(resultsRoot, rel), "utf8"),
    );
    if (observation.assignment?.phase !== phase) continue;
    if (typeof observation.costUsd === "number") costUsd += observation.costUsd;
    if (typeof observation.inputTokens === "number")
      tokens += observation.inputTokens;
    if (typeof observation.outputTokens === "number")
      tokens += observation.outputTokens;
  }
  return { costUsd, tokens };
}

function assertBudget(spend: { costUsd: number; tokens: number }) {
  const costLimit =
    phase === "pilot"
      ? protocol.budgets.pilotCostUsd
      : protocol.budgets.confirmatoryCostUsd;
  const tokenLimit =
    phase === "pilot"
      ? protocol.budgets.pilotTokens
      : protocol.budgets.confirmatoryTokens;
  if (spend.costUsd >= costLimit || spend.tokens >= tokenLimit)
    throw new Error(
      `${phase} operational budget reached: $${spend.costUsd.toFixed(2)}/${costLimit}, ${spend.tokens}/${tokenLimit} tokens`,
    );
}

function assertConfirmatoryFrozen() {
  if (phase !== "confirmatory") return;
  const status = Bun.spawnSync(
    [
      "git",
      "status",
      "--porcelain",
      "--",
      "evals/product-value",
      "docs/specs/product-value-evaluation.md",
      "docs/product-spec.md",
    ],
    { cwd: REPO_ROOT },
  );
  const output = status.stdout.toString().trim();
  if (status.exitCode !== 0 || output)
    throw new Error(
      `confirmatory evaluation requires committed frozen inputs${output ? `:\n${output}` : ""}`,
    );
}

if (command === "install-toolchain") {
  const proc = Bun.spawn(
    [
      protocol.paths.bunExecutable,
      resolve(SUITE_ROOT, "..", "..", "cli", "src", "install.ts"),
      "--scope",
      "global",
    ],
    {
      cwd: resolve(SUITE_ROOT, "..", ".."),
      env: {
        ...process.env,
        DARROW_TOOLCHAIN_HOME: resolve(
          SUITE_ROOT,
          "..",
          "..",
          protocol.paths.toolchainHome,
        ),
      },
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  process.exit(await proc.exited);
} else if (command === "preflight") {
  const required = poweredTasks(
    protocol.design.alpha,
    protocol.design.power,
    protocol.design.pairedTaskSd,
    protocol.design.usefulQualityGain,
  );
  const confirmatory = new Set(
    corpus.tasks
      .filter((task) => task.phase === "confirmatory")
      .map((task) => task.id),
  ).size;
  if (confirmatory < required)
    throw new Error(
      `confirmatory corpus has ${confirmatory} tasks; power requires ${required}`,
    );
  const counts = Object.fromEntries(
    ["mynab", "credfolio2"].flatMap((repository) =>
      ["simple", "orchestrated"].map((stratum) => [
        `${repository}:${stratum}`,
        corpus.tasks.filter(
          (task) => task.repository === repository && task.stratum === stratum,
        ).length,
      ]),
    ),
  );
  const environment = await preflightSources(
    protocol,
    corpus,
    parseSourceArgs(values.source),
  );
  console.log(
    JSON.stringify(
      {
        status: "ready",
        tasks: corpus.tasks.length,
        confirmatory,
        poweredDistinctTasks: required,
        assignments: schedule.length,
        counts,
        environment,
      },
      null,
      2,
    ),
  );
} else if (command === "schedule") {
  console.log(stringifyYaml(schedule));
} else if (command === "run") {
  assertConfirmatoryFrozen();
  const sources = parseSourceArgs(values.source);
  await mkdir(values.results!, { recursive: true });
  const selected = schedule.filter(
    (assignment) =>
      (!values.task || assignment.taskId === values.task) &&
      (!values.harness || assignment.harness === (values.harness as Harness)) &&
      (!values.treatment ||
        assignment.treatment === (values.treatment as Treatment)),
  );
  if (!selected.length) throw new Error("no assignments matched");
  for (const assignment of selected) {
    assertBudget(await phaseSpend(values.results!));
    console.log(
      `[${assignment.ordinal}/${schedule.length}] ${assignment.taskId} ${assignment.harness}/${assignment.treatment} r${assignment.repeat}`,
    );
    const observation = await runAssignment(
      protocol,
      corpus,
      assignment,
      sources,
      values.results!,
    );
    console.log(`  ${observation.status} quality=${observation.quality}`);
  }
} else if (command === "analyze") {
  const report = await analyze(protocol, corpus, values.results!);
  await mkdir(values.results!, { recursive: true });
  await writeFile(
    resolve(values.results!, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} else if (command === "blind") {
  console.log(
    JSON.stringify(
      await exportBlindBundles(
        corpus,
        values.results!,
        protocol.frozenSeed,
        phase,
      ),
      null,
      2,
    ),
  );
} else if (command === "import-grades") {
  if (!values.grades) throw new Error("import-grades requires --grades <path>");
  console.log(
    JSON.stringify(
      await importBlindGrades(corpus, values.results!, resolve(values.grades)),
      null,
      2,
    ),
  );
} else if (command === "import-annotations") {
  if (!values.annotations)
    throw new Error("import-annotations requires --annotations <path>");
  console.log(
    JSON.stringify(
      await importAnnotations(values.results!, resolve(values.annotations)),
      null,
      2,
    ),
  );
} else {
  console.error(
    "Usage: bun evals/product-value/cli.ts install-toolchain|preflight|schedule|run|blind|import-grades|import-annotations|analyze [options]",
  );
  process.exit(1);
}
