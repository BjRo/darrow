import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Observation,
  OperationalDiagnostic,
  OperationalDiagnosticTreatment,
} from "./types";

function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function numeric(values: Array<number | null>): number[] {
  return values.filter((value): value is number => value !== null);
}

async function observations(resultsRoot: string): Promise<Observation[]> {
  const values: Observation[] = [];
  const glob = new Bun.Glob("runs/*/observation.json");
  for await (const relativePath of glob.scan(resultsRoot))
    values.push(
      JSON.parse(
        await readFile(join(resultsRoot, relativePath), "utf8"),
      ) as Observation,
    );
  return values;
}

function treatmentSummary(
  values: Observation[],
  treatment: OperationalDiagnosticTreatment,
) {
  const selected = values.filter(
    (observation) => observation.assignment.treatment === treatment,
  );
  const metrics = selected.flatMap((observation) =>
    observation.operationalMetrics ? [observation.operationalMetrics] : [],
  );
  const attention = numeric(
    selected.map((observation) => observation.humanAttentionMinutes),
  );
  const costs = numeric(selected.map((observation) => observation.costUsd));
  const tokens = selected.flatMap((observation) =>
    observation.inputTokens === null && observation.outputTokens === null
      ? []
      : [(observation.inputTokens ?? 0) + (observation.outputTokens ?? 0)],
  );
  return {
    observations: selected.length,
    completed: selected.filter(
      (observation) => observation.status === "completed",
    ).length,
    meanQuality: mean(selected.map((observation) => observation.quality)),
    meanWallTimeMs: mean(selected.map((observation) => observation.wallTimeMs)),
    costObservations: costs.length,
    meanCostUsd: mean(costs),
    tokenObservations: tokens.length,
    meanTokens: mean(tokens),
    attentionObservations: attention.length,
    meanHumanAttentionMinutes:
      attention.length === selected.length ? mean(attention) : null,
    meanOperatorLaunchesRequired: mean(
      metrics.map((metric) => metric.operatorLaunchesRequired),
    ),
    meanOperatorHandoffsRequired: mean(
      metrics.map((metric) => metric.operatorHandoffsRequired),
    ),
    playbookStageCompletionRate:
      metrics.length &&
      metrics.reduce((sum, metric) => sum + metric.expectedStages, 0) > 0
        ? metrics.reduce((sum, metric) => sum + metric.finishedStages, 0) /
          metrics.reduce((sum, metric) => sum + metric.expectedStages, 0)
        : null,
    unattendedCompletionRate: metrics.length
      ? metrics.filter((metric) => metric.unattendedCompletion).length /
        metrics.length
      : null,
  };
}

function pairedRatio(
  values: Observation[],
  select: (observation: Observation) => number | null,
): number | null {
  const cells = new Map<
    string,
    Partial<Record<OperationalDiagnosticTreatment, number>>
  >();
  for (const observation of values) {
    const treatment = observation.assignment.treatment;
    if (treatment !== "manual-playbook" && treatment !== "cli-playbook")
      continue;
    const value = select(observation);
    if (value === null) continue;
    const key = `${observation.assignment.taskId}:${observation.assignment.harness}`;
    const cell = cells.get(key) ?? {};
    cell[treatment] = value;
    cells.set(key, cell);
  }
  const pairs = [...cells.values()].filter(
    (cell) =>
      cell["manual-playbook"] !== undefined &&
      cell["cli-playbook"] !== undefined,
  );
  const manual = pairs.reduce((sum, cell) => sum + cell["manual-playbook"]!, 0);
  const cli = pairs.reduce((sum, cell) => sum + cell["cli-playbook"]!, 0);
  return pairs.length && manual !== 0 ? cli / manual : null;
}

function pairedDifference(
  values: Observation[],
  select: (observation: Observation) => number | null,
): number | null {
  const cells = new Map<
    string,
    Partial<Record<OperationalDiagnosticTreatment, number>>
  >();
  for (const observation of values) {
    const treatment = observation.assignment.treatment;
    if (treatment !== "manual-playbook" && treatment !== "cli-playbook")
      continue;
    const value = select(observation);
    if (value === null) continue;
    const key = `${observation.assignment.taskId}:${observation.assignment.harness}`;
    const cell = cells.get(key) ?? {};
    cell[treatment] = value;
    cells.set(key, cell);
  }
  const differences = [...cells.values()].flatMap((cell) =>
    cell["manual-playbook"] === undefined || cell["cli-playbook"] === undefined
      ? []
      : [cell["cli-playbook"] - cell["manual-playbook"]],
  );
  return mean(differences);
}

export async function analyzeOperationalDiagnostic(
  diagnostic: OperationalDiagnostic,
  resultsRoot: string,
  observedSubset = false,
) {
  const values = (await observations(resultsRoot)).filter((observation) =>
    diagnostic.treatments.includes(
      observation.assignment.treatment as OperationalDiagnosticTreatment,
    ),
  );
  const observedBlocks = new Map<string, Set<string>>();
  for (const observation of values) {
    const key = `${observation.assignment.taskId}:${observation.assignment.harness}:${observation.assignment.repeat}`;
    const treatments = observedBlocks.get(key) ?? new Set<string>();
    treatments.add(observation.assignment.treatment);
    observedBlocks.set(key, treatments);
  }
  const expectedObservations = observedSubset
    ? observedBlocks.size * diagnostic.treatments.length
    : diagnostic.taskIds.length * 2 * diagnostic.treatments.length;
  const attentionComplete =
    values.length > 0 &&
    values.length === expectedObservations &&
    [...observedBlocks.values()].every(
      (treatments) =>
        treatments.size === diagnostic.treatments.length &&
        diagnostic.treatments.every((treatment) => treatments.has(treatment)),
    ) &&
    values.every((observation) => observation.humanAttentionMinutes !== null);
  return {
    schemaVersion: "1.0.0",
    diagnosticId: diagnostic.id,
    scope: observedSubset ? "observed-subset" : "full-diagnostic",
    observations: values.length,
    expectedObservations,
    attentionComplete,
    treatments: Object.fromEntries(
      diagnostic.treatments.map((treatment) => [
        treatment,
        treatmentSummary(values, treatment),
      ]),
    ),
    cliMinusManual: {
      quality: pairedDifference(values, (observation) => observation.quality),
      wallTimeMs: pairedDifference(
        values,
        (observation) => observation.wallTimeMs,
      ),
      tokens: pairedDifference(values, (observation) =>
        observation.inputTokens === null && observation.outputTokens === null
          ? null
          : (observation.inputTokens ?? 0) + (observation.outputTokens ?? 0),
      ),
      costUsd: pairedDifference(values, (observation) => observation.costUsd),
      humanAttentionMinutes: attentionComplete
        ? pairedDifference(
            values,
            (observation) => observation.humanAttentionMinutes,
          )
        : null,
    },
    cliToManual: {
      wallTime: pairedRatio(values, (observation) => observation.wallTimeMs),
      tokens: pairedRatio(values, (observation) =>
        observation.inputTokens === null && observation.outputTokens === null
          ? null
          : (observation.inputTokens ?? 0) + (observation.outputTokens ?? 0),
      ),
      cost: pairedRatio(values, (observation) => observation.costUsd),
      humanAttention: attentionComplete
        ? pairedRatio(
            values,
            (observation) => observation.humanAttentionMinutes,
          )
        : null,
    },
  };
}
