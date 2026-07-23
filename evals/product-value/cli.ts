#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { stringify as stringifyYaml } from "yaml";
import { analyze } from "./src/analyze";
import {
  loadCorpus,
  loadOperationalDiagnostic,
  loadProtocol,
  parseSourceArgs,
  REPO_ROOT,
  SUITE_ROOT,
} from "./src/config";
import {
  buildOperationalDiagnosticSchedule,
  buildPolicyDiagnosticSchedule,
  buildSchedule,
} from "./src/schedule";
import { poweredTasks } from "./src/stats";
import { runAssignment } from "./src/runner";
import { exportBlindBundles, importBlindGrades } from "./src/grading";
import { preflightSources } from "./src/preflight";
import { importAnnotations } from "./src/annotations";
import { analyzeOperationalDiagnostic } from "./src/operations";
import type {
  Harness,
  Observation,
  Phase,
  RepositoryDefinition,
  TaskDefinition,
  Treatment,
} from "./src/types";
import { reverifyPatch } from "./src/workspace";
import { createOperatorAttentionSession } from "./src/operator-attention";

const command = process.argv[2];
const { values } = parseArgs({
  args: process.argv.slice(3),
  options: {
    phase: { type: "string", default: "smoke" },
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
    reverification: { type: "string" },
    "operator-timed": { type: "boolean", default: false },
  },
});
const protocol = await loadProtocol();
const corpus = await loadCorpus();
const operationalDiagnostic = await loadOperationalDiagnostic();
const phase = values.phase as Phase;
if (phase !== "smoke" && phase !== "pilot" && phase !== "confirmatory")
  throw new Error("--phase must be smoke, pilot, or confirmatory");
const schedule = buildSchedule(protocol, corpus, phase);

async function phaseSpend(resultsRoot: string, selectedPhase = phase) {
  let costUsd = 0;
  let tokens = 0;
  const glob = new Bun.Glob("runs/*/observation.json");
  for await (const rel of glob.scan(resultsRoot)) {
    const observation = JSON.parse(
      await readFile(join(resultsRoot, rel), "utf8"),
    );
    if (observation.assignment?.phase !== selectedPhase) continue;
    if (typeof observation.costUsd === "number") costUsd += observation.costUsd;
    if (typeof observation.inputTokens === "number")
      tokens += observation.inputTokens;
    if (typeof observation.outputTokens === "number")
      tokens += observation.outputTokens;
  }
  return { costUsd, tokens };
}

function assertBudget(
  spend: { costUsd: number; tokens: number },
  selectedPhase = phase,
) {
  const { costUsd: costLimit, tokens: tokenLimit } =
    protocol.budgets[selectedPhase];
  if (spend.costUsd >= costLimit || spend.tokens >= tokenLimit)
    throw new Error(
      `${selectedPhase} operational budget reached: $${spend.costUsd.toFixed(2)}/${costLimit}, ${spend.tokens}/${tokenLimit} tokens`,
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

async function fileDigest(path: string): Promise<string> {
  return `sha256:${new Bun.CryptoHasher("sha256").update(await readFile(path)).digest("hex")}`;
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
    phase,
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
} else if (command === "schedule-operations") {
  console.log(
    stringifyYaml(
      buildOperationalDiagnosticSchedule(
        protocol,
        corpus,
        operationalDiagnostic,
      ),
    ),
  );
} else if (command === "diagnose-policy") {
  if (phase !== "smoke")
    throw new Error("diagnose-policy is restricted to the smoke phase");
  const sources = parseSourceArgs(values.source);
  await mkdir(values.results!, { recursive: true });
  const diagnostic = buildPolicyDiagnosticSchedule(protocol, corpus).filter(
    (assignment) =>
      (!values.treatment ||
        assignment.treatment === (values.treatment as Treatment)) &&
      (!values.harness || assignment.harness === (values.harness as Harness)),
  );
  if (!diagnostic.length) throw new Error("no policy diagnostic cells matched");
  for (const [index, assignment] of diagnostic.entries()) {
    assertBudget(await phaseSpend(values.results!));
    console.log(
      `[${index + 1}/${diagnostic.length}] ${assignment.taskId} ${assignment.harness}/${assignment.treatment} r${assignment.repeat}`,
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
} else if (command === "diagnose-operations") {
  if (
    values["operator-timed"] &&
    (!process.stdin.isTTY || !process.stdout.isTTY)
  )
    throw new Error("--operator-timed requires an interactive terminal");
  if (values["operator-timed"] && (!values.task || !values.harness))
    throw new Error("--operator-timed requires --task and --harness");
  if (values["operator-timed"] && values.treatment)
    throw new Error(
      "--operator-timed runs the matched treatment pair; omit --treatment",
    );
  const sources = parseSourceArgs(values.source);
  await mkdir(values.results!, { recursive: true });
  const diagnosticSchedule = buildOperationalDiagnosticSchedule(
    protocol,
    corpus,
    operationalDiagnostic,
  );
  const selected = diagnosticSchedule.filter(
    (assignment) =>
      (!values.task || assignment.taskId === values.task) &&
      (!values.harness || assignment.harness === (values.harness as Harness)) &&
      (!values.treatment ||
        assignment.treatment === (values.treatment as Treatment)),
  );
  if (!selected.length)
    throw new Error("no operational diagnostic cells matched");
  const terminal = values["operator-timed"]
    ? createInterface({ input: process.stdin, output: process.stdout })
    : null;
  try {
    for (const assignment of selected) {
      assertBudget(
        await phaseSpend(values.results!, operationalDiagnostic.phase),
        operationalDiagnostic.phase,
      );
      console.log(
        `[${assignment.ordinal}/${diagnosticSchedule.length}] ${assignment.taskId} ${assignment.harness}/${assignment.treatment} r${assignment.repeat}`,
      );
      const attention = terminal
        ? createOperatorAttentionSession(
            (prompt) => terminal.question(`${prompt}\n`),
            (value) => process.stdout.write(value),
          )
        : undefined;
      const observation = await runAssignment(
        protocol,
        corpus,
        assignment,
        sources,
        values.results!,
        attention,
      );
      console.log(`  ${observation.status} quality=${observation.quality}`);
    }
  } finally {
    terminal?.close();
  }
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
} else if (command === "reverify") {
  if (!values.reverification)
    throw new Error("reverify requires --reverification <path>");
  const sources = parseSourceArgs(values.source);
  const outputRoot = resolve(values.reverification);
  await mkdir(outputRoot, { recursive: true });
  const observationGlob = new Bun.Glob("runs/*/observation.json");
  const observationPaths: string[] = [];
  for await (const path of observationGlob.scan(values.results!))
    observationPaths.push(resolve(values.results!, path));
  observationPaths.sort();
  let selected = 0;
  for (const observationPath of observationPaths) {
    const observation = JSON.parse(
      await readFile(observationPath, "utf8"),
    ) as Observation;
    const assignment = observation.assignment;
    if (
      assignment.phase !== phase ||
      (values.task && assignment.taskId !== values.task) ||
      (values.harness && assignment.harness !== values.harness) ||
      (values.treatment && assignment.treatment !== values.treatment)
    )
      continue;
    selected += 1;
    const task = corpus.tasks.find((item) => item.id === assignment.taskId) as
      TaskDefinition | undefined;
    const repository = corpus.repositories.find(
      (item) => item.id === assignment.repository,
    ) as RepositoryDefinition | undefined;
    const source = repository ? sources.get(repository.id) : undefined;
    if (!task || !repository || !source)
      throw new Error(`cannot reverify ${observation.runId}: missing input`);
    if (
      !observation.patchPath ||
      !(await Bun.file(observation.patchPath).exists())
    )
      throw new Error(
        `cannot reverify ${observation.runId}: patch unavailable`,
      );
    const runRoot = join(outputRoot, observation.runId);
    const recordPath = join(runRoot, "reverification.json");
    const identity = {
      sourceObservationDigest: await fileDigest(observationPath),
      patchDigest: await fileDigest(observation.patchPath),
      sourceRevision: observation.sourceRevision,
      task: {
        id: task.id,
        oracleRevision: task.oracleRevision,
        oracleTestAdjustments: task.oracleTestAdjustments ?? [],
        verificationCommand: task.verificationCommand,
        verificationCwd: task.verificationCwd ?? ".",
      },
    };
    const identityDigest = `sha256:${new Bun.CryptoHasher("sha256")
      .update(JSON.stringify(identity))
      .digest("hex")}`;
    if (await Bun.file(recordPath).exists()) {
      const existing = JSON.parse(await readFile(recordPath, "utf8")) as {
        identityDigest?: string;
        quality?: number;
      };
      if (existing.identityDigest !== identityDigest)
        throw new Error(
          `stale reverification for ${observation.runId}; use a fresh --reverification root`,
        );
      console.log(
        `[${selected}] ${observation.runId} reused quality=${existing.quality}`,
      );
      continue;
    }
    await mkdir(runRoot, { recursive: true });
    const verification = await reverifyPatch(
      source,
      repository,
      task,
      observation.patchPath,
      join(runRoot, "verification.log"),
    );
    const quality = verification.passed ? 1 : 0;
    await writeFile(
      recordPath,
      JSON.stringify(
        {
          schemaVersion: "1.0.0",
          runId: observation.runId,
          assignment,
          reverifiedAt: new Date().toISOString(),
          identityDigest,
          identity,
          sourceStatus: observation.status,
          sourceOperationalFailure: observation.operationalFailure,
          verification,
          deterministicQuality: quality,
          quality,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`[${selected}] ${observation.runId} quality=${quality}`);
  }
  if (!selected) throw new Error("no observations matched for reverification");
} else if (command === "analyze") {
  const report = await analyze(protocol, corpus, values.results!);
  await mkdir(values.results!, { recursive: true });
  await writeFile(
    resolve(values.results!, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} else if (command === "analyze-operations") {
  const report = await analyzeOperationalDiagnostic(
    operationalDiagnostic,
    values.results!,
    values["operator-timed"],
    values.reverification ? resolve(values.reverification) : undefined,
  );
  await mkdir(values.results!, { recursive: true });
  await writeFile(
    resolve(values.results!, "operational-report.json"),
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
      await importBlindGrades(
        corpus,
        values.results!,
        resolve(values.grades),
        values.reverification ? resolve(values.reverification) : undefined,
      ),
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
    "Usage: bun evals/product-value/cli.ts install-toolchain|preflight|schedule|schedule-operations|diagnose-policy|diagnose-operations|run|reverify|blind|import-grades|import-annotations|analyze|analyze-operations [options]",
  );
  process.exit(1);
}
