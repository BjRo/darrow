import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Assignment,
  Corpus,
  Observation,
  PairEstimate,
  Protocol,
  Treatment,
} from "./types";
import { mean, pairedEstimate } from "./stats";

interface Cell {
  taskId: string;
  stratum: Assignment["stratum"];
  treatment: Treatment;
  quality: number;
  attention: number;
  cost: number | null;
  tokens: number | null;
  wall: number;
  operationalFailure: number;
}

async function observations(resultsRoot: string): Promise<Observation[]> {
  const values: Observation[] = [];
  const glob = new Bun.Glob("runs/*/observation.json");
  for await (const rel of glob.scan(resultsRoot))
    values.push(JSON.parse(await readFile(join(resultsRoot, rel), "utf8")));
  let overlayText: string;
  try {
    overlayText = await readFile(
      join(resultsRoot, "blind", "graded-observations.jsonl"),
      "utf8",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return values;
    throw error;
  }
  const overlays = overlayText
    .split("\n")
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as {
          schemaVersion: string;
          runId: string;
          deterministicQuality: number;
          blindedQuality: number;
          quality: number;
        },
    );
  if (
    overlays.some(
      (value) =>
        value.schemaVersion !== "1.0.0" ||
        !value.runId ||
        [value.deterministicQuality, value.blindedQuality, value.quality].some(
          (score) => !Number.isFinite(score) || score < 0 || score > 1,
        ),
    )
  )
    throw new Error("graded observation overlay is invalid");
  if (new Set(overlays.map((value) => value.runId)).size !== overlays.length)
    throw new Error("graded observation overlay contains duplicate run IDs");
  const byRun = new Map(overlays.map((value) => [value.runId, value]));
  for (const runId of byRun.keys())
    if (!values.some((value) => value.runId === runId))
      throw new Error(`graded observation overlay names unknown run: ${runId}`);
  return values.map((value) => {
    const overlay = byRun.get(value.runId);
    return overlay
      ? {
          ...value,
          deterministicQuality: overlay.deterministicQuality,
          blindedQuality: overlay.blindedQuality,
          quality: overlay.quality,
        }
      : value;
  });
}

function cells(values: Observation[]): Cell[] {
  const groups = new Map<string, Observation[]>();
  for (const value of values) {
    const key = `${value.assignment.taskId}:${value.assignment.harness}:${value.assignment.treatment}`;
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  const harnessCells = [...groups.values()].map((runs) => ({
    taskId: runs[0]!.assignment.taskId,
    stratum: runs[0]!.assignment.stratum,
    treatment: runs[0]!.assignment.treatment,
    quality: mean(runs.map((run) => run.quality)),
    attention: mean(runs.map((run) => run.humanAttentionMinutes!)),
    cost: runs.every((run) => run.costUsd !== null)
      ? mean(runs.map((run) => run.costUsd!))
      : null,
    tokens: runs.every(
      (run) => run.inputTokens !== null && run.outputTokens !== null,
    )
      ? mean(runs.map((run) => run.inputTokens! + run.outputTokens!))
      : null,
    wall: mean(runs.map((run) => run.wallTimeMs)),
    operationalFailure: mean(
      runs.map((run) => (run.operationalFailure === null ? 0 : 1)),
    ),
  }));
  const taskGroups = new Map<string, typeof harnessCells>();
  for (const cell of harnessCells) {
    const key = `${cell.taskId}:${cell.treatment}`;
    taskGroups.set(key, [...(taskGroups.get(key) ?? []), cell]);
  }
  return [...taskGroups.values()].map((items) => ({
    taskId: items[0]!.taskId,
    stratum: items[0]!.stratum,
    treatment: items[0]!.treatment,
    quality: mean(items.map((item) => item.quality)),
    attention: mean(items.map((item) => item.attention)),
    cost: items.every((item) => item.cost !== null)
      ? mean(items.map((item) => item.cost!))
      : null,
    tokens: items.every((item) => item.tokens !== null)
      ? mean(items.map((item) => item.tokens!))
      : null,
    wall: mean(items.map((item) => item.wall)),
    operationalFailure: mean(items.map((item) => item.operationalFailure)),
  }));
}

function differences(
  values: Cell[],
  candidate: Treatment,
  baseline: Treatment,
  metric: keyof Pick<
    Cell,
    "quality" | "attention" | "wall" | "operationalFailure"
  >,
  stratum?: Assignment["stratum"],
): number[] {
  const tasks = [...new Set(values.map((value) => value.taskId))];
  return tasks.flatMap((taskId) => {
    const candidateCell = values.find(
      (value) => value.taskId === taskId && value.treatment === candidate,
    );
    const baselineCell = values.find(
      (value) => value.taskId === taskId && value.treatment === baseline,
    );
    if (
      !candidateCell ||
      !baselineCell ||
      (stratum && candidateCell.stratum !== stratum)
    )
      return [];
    return [candidateCell[metric] - baselineCell[metric]];
  });
}

function estimate(
  comparison: string,
  differences: number[],
  protocol: Protocol,
): PairEstimate {
  return {
    comparison,
    tasks: differences.length,
    ...pairedEstimate(
      differences,
      protocol.design.bootstrapSamples,
      protocol.design.randomizationSamples,
    ),
  };
}

function ratio(
  values: Cell[],
  metric: "cost" | "tokens" | "wall" | "attention",
): number | null {
  const cli = values.filter((value) => value.treatment === "cli");
  const plugins = values.filter((value) => value.treatment === "plugins");
  if (
    !cli.length ||
    !plugins.length ||
    cli.some((value) => value[metric] === null) ||
    plugins.some((value) => value[metric] === null)
  )
    return null;
  const baseline = mean(plugins.map((value) => value[metric]!));
  return baseline === 0
    ? null
    : mean(cli.map((value) => value[metric]!)) / baseline;
}

function observationRatio(
  values: Observation[],
  metric: "cost" | "tokens",
): number | null {
  const measure = (value: Observation): number | null => {
    if (metric === "cost") return value.costUsd;
    return value.inputTokens === null || value.outputTokens === null
      ? null
      : value.inputTokens + value.outputTokens;
  };
  const eligibleHarnesses = [
    ...new Set(values.map((value) => value.assignment.harness)),
  ].filter(
    (harness) =>
      values.some(
        (value) =>
          value.assignment.harness === harness &&
          value.assignment.treatment === "cli" &&
          measure(value) !== null,
      ) &&
      values.some(
        (value) =>
          value.assignment.harness === harness &&
          value.assignment.treatment === "plugins" &&
          measure(value) !== null,
      ),
  );
  const keys = [
    ...new Set(
      values
        .filter((value) => eligibleHarnesses.includes(value.assignment.harness))
        .map(
          (value) =>
            `${value.assignment.taskId}:${value.assignment.harness}:${value.assignment.repeat}`,
        ),
    ),
  ];
  const cli: number[] = [];
  const plugins: number[] = [];
  for (const key of keys) {
    const selected = (treatment: Treatment) =>
      values.find(
        (value) =>
          `${value.assignment.taskId}:${value.assignment.harness}:${value.assignment.repeat}` ===
            key && value.assignment.treatment === treatment,
      );
    const cliValue = selected("cli");
    const pluginValue = selected("plugins");
    if (!cliValue || !pluginValue) return null;
    const cliMeasure = measure(cliValue);
    const pluginMeasure = measure(pluginValue);
    if (cliMeasure === null || pluginMeasure === null) return null;
    cli.push(cliMeasure);
    plugins.push(pluginMeasure);
  }
  if (!cli.length) return null;
  const baseline = mean(plugins);
  return baseline === 0 ? null : mean(cli) / baseline;
}

function treatmentSummary(values: Observation[], treatment: Treatment) {
  const runs = values.filter(
    (value) => value.assignment.treatment === treatment,
  );
  const numeric = (values: Array<number | null>) =>
    values.filter((value): value is number => value !== null);
  const tokens = numeric(
    runs.map((run) =>
      run.inputTokens === null || run.outputTokens === null
        ? null
        : run.inputTokens + run.outputTokens,
    ),
  );
  const costs = numeric(runs.map((run) => run.costUsd));
  const repeatGroups = new Map<string, number[]>();
  for (const run of runs) {
    const key = `${run.assignment.taskId}:${run.assignment.harness}`;
    repeatGroups.set(key, [...(repeatGroups.get(key) ?? []), run.quality]);
  }
  const repeatVariances = [...repeatGroups.values()].map((quality) => {
    const center = mean(quality);
    return mean(quality.map((value) => (value - center) ** 2));
  });
  return {
    observations: runs.length,
    meanQuality: mean(runs.map((run) => run.quality)),
    meanTokens: tokens.length ? mean(tokens) : null,
    totalProviderCostUsd: costs.length
      ? costs.reduce((sum, value) => sum + value, 0)
      : null,
    meanWallTimeMs: mean(runs.map((run) => run.wallTimeMs)),
    meanHumanAttentionMinutes: (() => {
      const attention = numeric(runs.map((run) => run.humanAttentionMinutes));
      return attention.length ? mean(attention) : null;
    })(),
    interventions: runs.reduce((sum, run) => sum + run.interventions, 0),
    failures: runs.reduce((sum, run) => sum + run.failures, 0),
    retries: runs.reduce((sum, run) => sum + run.retries, 0),
    recoveries: runs.filter((run) => run.recovered).length,
    rework: runs.reduce((sum, run) => sum + run.reworkCount, 0),
    setupFailures: runs.filter((run) => run.setupFailure !== null).length,
    operationalFailures: runs.filter((run) => run.operationalFailure !== null)
      .length,
    meanWithinCellQualityVariance: repeatVariances.length
      ? mean(repeatVariances)
      : null,
  };
}

function subgroupEffects(values: Observation[], protocol: Protocol) {
  const scopedCells = cells(values);
  return {
    tasks: new Set(values.map((value) => value.assignment.taskId)).size,
    cliVsPluginsQuality: estimate(
      "cli - plugins quality",
      differences(scopedCells, "cli", "plugins", "quality"),
      protocol,
    ),
    pluginsVsNativeQuality: estimate(
      "plugins - native quality",
      differences(scopedCells, "plugins", "native", "quality"),
      protocol,
    ),
  };
}

export async function analyze(
  protocol: Protocol,
  corpus: Corpus,
  resultsRoot: string,
): Promise<Record<string, unknown>> {
  const raw = (await observations(resultsRoot)).filter(
    (value) => value.assignment.phase === "confirmatory",
  );
  const expectedTasks = corpus.tasks.filter(
    (task) => task.phase === "confirmatory",
  );
  const repeats = protocol.phases.confirmatory.repeats;
  const expectedObservations = expectedTasks.length * 2 * 3 * repeats;
  if (raw.length !== expectedObservations)
    throw new Error(
      `confirmatory analysis requires ${expectedObservations} observations; found ${raw.length}`,
    );
  for (const task of expectedTasks) {
    const taskRuns = raw.filter((run) => run.assignment.taskId === task.id);
    if (taskRuns.length !== 2 * 3 * repeats)
      throw new Error(`confirmatory block is incomplete: ${task.id}`);
    if (
      task.grading === "mixed" &&
      taskRuns.some((run) => run.blindedQuality === null)
    )
      throw new Error(`confirmatory blinded grading is incomplete: ${task.id}`);
    if (taskRuns.some((run) => run.humanAttentionMinutes === null))
      throw new Error(
        `confirmatory human-attention annotation is incomplete: ${task.id}`,
      );
  }
  const values = cells(raw);
  const quality = estimate(
    "cli - plugins quality",
    differences(values, "cli", "plugins", "quality"),
    protocol,
  );
  const pluginQuality = estimate(
    "plugins - native quality",
    differences(values, "plugins", "native", "quality"),
    protocol,
  );
  const orchestratedQuality = estimate(
    "cli - plugins quality (orchestrated)",
    differences(values, "cli", "plugins", "quality", "orchestrated"),
    protocol,
  );
  const attention = estimate(
    "cli - plugins attention minutes",
    differences(values, "cli", "plugins", "attention"),
    protocol,
  );
  const costRatio = observationRatio(raw, "cost");
  const tokenRatio = observationRatio(raw, "tokens");
  const resourceRatios = [costRatio, tokenRatio].filter(
    (value): value is number => value !== null,
  );
  const modelResourceRatio = resourceRatios.length
    ? Math.max(...resourceRatios)
    : null;
  const wallRatio = ratio(values, "wall");
  const attentionRatio = ratio(values, "attention");
  const failureRate = mean(
    values
      .filter((value) => value.treatment === "cli")
      .map((value) => value.operationalFailure),
  );
  const nonInferior =
    quality.ciLow > -protocol.design.qualityNonInferiorityMargin;
  const practicallyUseful =
    quality.estimate >= protocol.design.usefulQualityGain ||
    (attentionRatio !== null &&
      attentionRatio <= 1 - protocol.design.usefulAttentionReduction);
  const overheadAcceptable =
    modelResourceRatio !== null &&
    modelResourceRatio <= protocol.design.maxCostRatio &&
    (wallRatio === null || wallRatio <= protocol.design.maxWallTimeRatio) &&
    failureRate <= protocol.design.maxOperationalFailureRate;
  const orchestratedUseful = (() => {
    const orchestratedValues = values.filter(
      (value) => value.stratum === "orchestrated",
    );
    const orchestratedRaw = raw.filter(
      (value) => value.assignment.stratum === "orchestrated",
    );
    const attention = ratio(orchestratedValues, "attention");
    const cost = observationRatio(orchestratedRaw, "cost");
    const tokens = observationRatio(orchestratedRaw, "tokens");
    const resources = [cost, tokens].filter(
      (value): value is number => value !== null,
    );
    const wall = ratio(orchestratedValues, "wall");
    const failures = mean(
      orchestratedValues
        .filter((value) => value.treatment === "cli")
        .map((value) => value.operationalFailure),
    );
    return (
      orchestratedQuality.ciLow >
        -protocol.design.qualityNonInferiorityMargin &&
      (orchestratedQuality.estimate >= protocol.design.usefulQualityGain ||
        (attention !== null &&
          attention <= 1 - protocol.design.usefulAttentionReduction)) &&
      resources.length > 0 &&
      Math.max(...resources) <= protocol.design.maxCostRatio &&
      (wall === null || wall <= protocol.design.maxWallTimeRatio) &&
      failures <= protocol.design.maxOperationalFailureRate
    );
  })();
  const decision =
    nonInferior && practicallyUseful && overheadAcceptable
      ? "continue"
      : orchestratedUseful && overheadAcceptable
        ? "narrow"
        : quality.ciHigh < -protocol.design.qualityNonInferiorityMargin ||
            (quality.ciHigh < protocol.design.usefulQualityGain &&
              (attentionRatio === null ||
                attentionRatio > 1 - protocol.design.usefulAttentionReduction))
          ? "stop"
          : "redesign";
  return {
    schemaVersion: "1.0.0",
    decision,
    distinctTasks: new Set(values.map((value) => value.taskId)).size,
    observations: raw.length,
    effects: { quality, pluginQuality, orchestratedQuality, attention },
    treatments: Object.fromEntries(
      (["native", "plugins", "cli"] as Treatment[]).map((treatment) => [
        treatment,
        treatmentSummary(raw, treatment),
      ]),
    ),
    subgroups: {
      harness: Object.fromEntries(
        (["codex", "claude"] as const).map((harness) => [
          harness,
          subgroupEffects(
            raw.filter((run) => run.assignment.harness === harness),
            protocol,
          ),
        ]),
      ),
      repository: Object.fromEntries(
        ["mynab", "credfolio2"].map((repository) => [
          repository,
          subgroupEffects(
            raw.filter((run) => run.assignment.repository === repository),
            protocol,
          ),
        ]),
      ),
      stratum: Object.fromEntries(
        (["simple", "orchestrated"] as const).map((stratum) => [
          stratum,
          subgroupEffects(
            raw.filter((run) => run.assignment.stratum === stratum),
            protocol,
          ),
        ]),
      ),
    },
    economics: {
      providerCostRatio: costRatio,
      tokenRatio,
      modelResourceRatio,
      wallRatio,
      attentionRatio,
      operationalFailureRate: failureRate,
    },
    thresholds: protocol.design,
    caveats: [
      costRatio === null
        ? "Provider cost ratio unavailable; token ratio is the preregistered fallback."
        : null,
    ].filter(Boolean),
  };
}
