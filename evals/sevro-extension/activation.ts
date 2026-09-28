export type ActivationExpectation = {
  class: "positive" | "negative" | "competition";
  targetSkill: string;
};

export type ActivationGate =
  | { status: "not_requested" }
  | (ActivationExpectation & {
      status: "not_run" | "passed" | "failed" | "unavailable";
      trials: number;
      measured: number;
      passed: number;
      failed: number;
      unavailable: number;
      passRate: number | null;
      threshold: number;
      trueSelections: number | null;
      falseSelections: number | null;
    });

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function completedTrial(value: unknown, ordinal: number) {
  const trial = record(value);
  if (
    trial?.trial !== ordinal ||
    record(trial.execution)?.status !== "completed" ||
    record(trial.grading)?.status !== "completed"
  )
    return null;
  return trial;
}

function measuredSelection(
  data: RecordValue | null,
  expected: ActivationExpectation,
) {
  if (
    data?.class !== expected.class ||
    data?.targetSkill !== expected.targetSkill
  )
    return null;
  const primary = data.primarySkill;
  if (primary !== null && (typeof primary !== "string" || !primary))
    return null;
  return { primary };
}

function trialMeasurement(
  value: unknown,
  expected: ActivationExpectation,
  ordinal: number,
) {
  const trial = completedTrial(value, ordinal);
  const outcomes = trial?.domainOutcomes;
  if (!Array.isArray(outcomes)) return null;
  const matches = outcomes.filter(
    (outcome) => record(outcome)?.id === "darrow.evals.activation",
  );
  if (matches.length !== 1) return null;
  const outcome = record(matches[0])!;
  const selection = measuredSelection(record(outcome.data), expected);
  if (
    !selection ||
    (outcome.status !== "passed" && outcome.status !== "failed")
  )
    return null;
  return { status: outcome.status, ...selection };
}

function selectionCounts(
  measurements: Array<ReturnType<typeof trialMeasurement>>,
  expected: ActivationExpectation,
  complete: boolean,
) {
  if (!complete) return { trueSelections: null, falseSelections: null };
  let trueSelections = 0;
  let falseSelections = 0;
  for (const measurement of measurements) {
    if (!measurement) continue;
    const owning = measurement.primary === expected.targetSkill;
    if (expected.class === "negative") {
      if (owning) falseSelections++;
    } else if (owning) trueSelections++;
    else if (measurement.primary !== null) falseSelections++;
  }
  return { trueSelections, falseSelections };
}

function gateStatus(
  selected: RecordValue | null,
  passRate: number | null,
  threshold: number,
) {
  if (record(selected?.execution)?.status === "not_run") return "not_run";
  if (passRate === null) return "unavailable";
  return passRate >= threshold ? "passed" : "failed";
}

export function activationGate(
  expected: ActivationExpectation | null,
  configuration: { trials: number; threshold: number },
  selectedCase: unknown,
): ActivationGate {
  if (!expected) return { status: "not_requested" as const };
  const selected = record(selectedCase);
  const trials = Array.isArray(selected?.trials) ? selected.trials : [];
  const measurements =
    trials.length === configuration.trials
      ? trials.map((trial, index) =>
          trialMeasurement(trial, expected, index + 1),
        )
      : Array.from({ length: configuration.trials }, () => null);
  const passed = measurements.filter(
    (measurement) => measurement?.status === "passed",
  ).length;
  const failed = measurements.filter(
    (measurement) => measurement?.status === "failed",
  ).length;
  const measured = passed + failed;
  const unavailable = configuration.trials - measured;
  const passRate = unavailable === 0 ? passed / configuration.trials : null;
  return {
    status: gateStatus(selected, passRate, configuration.threshold),
    ...expected,
    trials: configuration.trials,
    measured,
    passed,
    failed,
    unavailable,
    passRate,
    threshold: configuration.threshold,
    ...selectionCounts(measurements, expected, unavailable === 0),
  };
}
