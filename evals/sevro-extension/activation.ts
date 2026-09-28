export type ActivationExpectation = {
  class: "positive" | "negative" | "competition";
  targetSkill: string;
};

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

function trialStatus(
  value: unknown,
  expected: ActivationExpectation,
  ordinal: number,
) {
  const trial = completedTrial(value, ordinal);
  const outcomes = trial?.domainOutcomes;
  if (!Array.isArray(outcomes)) return "unavailable";
  const matches = outcomes.filter(
    (outcome) => record(outcome)?.id === "darrow.evals.activation",
  );
  if (matches.length !== 1) return "unavailable";
  const outcome = record(matches[0])!;
  const data = record(outcome.data);
  if (
    data?.class !== expected.class ||
    data?.targetSkill !== expected.targetSkill
  )
    return "unavailable";
  return outcome.status === "passed" || outcome.status === "failed"
    ? outcome.status
    : "unavailable";
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
) {
  if (!expected) return { status: "not_requested" as const };
  const selected = record(selectedCase);
  const trials = Array.isArray(selected?.trials) ? selected.trials : [];
  const statuses =
    trials.length === configuration.trials
      ? trials.map((trial, index) => trialStatus(trial, expected, index + 1))
      : Array.from({ length: configuration.trials }, () => "unavailable");
  const passed = statuses.filter((status) => status === "passed").length;
  const failed = statuses.filter((status) => status === "failed").length;
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
  };
}
