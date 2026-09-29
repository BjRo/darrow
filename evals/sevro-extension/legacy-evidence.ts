export type ObjectValue = Record<string, unknown>;
type ExecutionMode = "executed" | "dry" | "unknown";

export function object(value: unknown, label: string): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as ObjectValue;
}

export function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.length) return value;
  throw new Error("Invalid legacy text field");
}

function boolean(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  throw new Error("Invalid legacy boolean field");
}

function mode(value: unknown): ExecutionMode | null {
  if (value === undefined || value === null) return null;
  if (value === "executed" || value === "dry" || value === "unknown")
    return value;
  throw new Error("Invalid legacy execution mode");
}

function plannedTrials(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
    return value;
  throw new Error("Invalid planned legacy trial count");
}

function list(value: unknown, label: string): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value as unknown[];
}

function execution(
  result: ObjectValue,
  manifest: ObjectValue,
  trials: ObjectValue[],
) {
  const declared = mode(result.executionMode);
  const dry = boolean(manifest.dry);
  const fallback = dry === null ? null : dry ? "dry" : "executed";
  const trialModes = trials.map(
    (trial) => mode(trial.executionMode) ?? declared ?? fallback ?? "unknown",
  );
  const modes = [
    ...trialModes,
    ...(declared ? [declared] : []),
    ...(fallback ? [fallback] : []),
  ];
  const concrete = new Set(modes.filter((value) => value !== "unknown"));
  if (concrete.size > 1)
    return {
      executionMode: "unknown",
      executionSource: "conflict",
      error: "Conflicting execution declarations",
    };
  if (!modes.length || modes.includes("unknown"))
    return { executionMode: "unknown", executionSource: null, error: null };
  return {
    executionMode: modes[0]!,
    executionSource: declared ? "case" : fallback ? "suite-manifest" : "trials",
    error: null,
  };
}

function evaluator(manifest: ObjectValue) {
  const runner = manifest.runner ? object(manifest.runner, "runner") : {};
  return {
    kind: "legacy-darrow",
    revision: text(runner.revision),
    dirty: boolean(runner.dirty),
    patchSha256: text(runner.patchSha256),
  };
}

function route(value: unknown) {
  if (value === undefined || value === null) return null;
  const record = object(value, "route");
  return {
    harness: text(record.harness),
    model: text(record.model),
    effort: text(record.effort),
  };
}

function recordedCount(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return value;
  throw new Error(`Invalid legacy ${label}`);
}

function recordedGoalRoute(value: unknown) {
  if (value === undefined || value === null) return null;
  const record = object(value, "recorded goal route");
  return {
    harness: text(record.harness),
    provider: text(record.provider),
    model: text(record.model),
    effort: text(record.effort),
  };
}

function recordedRouteApplication(value: unknown) {
  if (value === undefined || value === null) return null;
  const record = object(value, "recorded route application");
  return {
    profile: text(record.profile),
    workflow: text(record.workflow),
    risk: text(record.risk),
    workflowFile: text(record.workflowFile),
    workflowSha256: text(record.workflowSha256),
    dimensionStage: text(record.dimensionStage),
    verificationGate: text(record.verificationGate),
    selected: recordedGoalRoute(record.selected),
    effective: recordedGoalRoute(record.effective),
    appliedBy: text(record.appliedBy),
    launchBoundary: text(record.launchBoundary),
    childInvocationCount: recordedCount(
      record.childInvocationCount,
      "child invocation count",
    ),
    childInputTokens: recordedCount(
      record.childInputTokens,
      "child input tokens",
    ),
    childOutputTokens: recordedCount(
      record.childOutputTokens,
      "child output tokens",
    ),
  };
}

function recordedOrchestrationMetrics(value: unknown) {
  if (value === undefined || value === null) return null;
  const record = object(value, "recorded orchestration metrics");
  return {
    childInvocationCount: recordedCount(
      record.childInvocationCount,
      "child invocation count",
    ),
    humanInterruptions: recordedCount(
      record.humanInterruptions,
      "human interruption count",
    ),
    escapedDefects: recordedCount(
      record.escapedDefects,
      "escaped defect count",
    ),
    falsePositiveVerifierFindings: recordedCount(
      record.falsePositiveVerifierFindings,
      "false-positive verifier finding count",
    ),
  };
}

function grading(value: unknown) {
  if (value === undefined || value === null) return null;
  const record = object(value, "grader");
  return {
    ok: boolean(record.ok),
    route: route(record.route),
    assessment: record.assessment
      ? object(record.assessment, "advisory assessment")
      : null,
    assessments: list(record.assessments, "semantic assessments"),
    parseError: text(record.parseError),
  };
}

function checks(value: unknown) {
  const names = new Set<string>();
  return list(value, "checks").map((item) => {
    const check = object(item, "check");
    const name = text(check.name);
    if (!name) throw new Error("Legacy check name is required");
    if (names.has(name))
      throw new Error(`Duplicate legacy check name: ${name}`);
    names.add(name);
    return { name, passed: boolean(check.passed) };
  });
}

function activation(value: unknown) {
  if (value === undefined || value === null) return null;
  const record = object(value, "activation");
  return {
    passed: boolean(record.passed),
    class: text(record.class),
    targetSkill: text(record.targetSkill),
    source: text(record.source),
    primarySkill: text(record.primarySkill),
    observedSkills: list(record.observedSkills, "observed skills"),
    expectedSkills: list(record.expectedSkills, "expected skills"),
    requiredSkills: list(record.requiredSkills, "required skills"),
    excludedSkills: list(record.excludedSkills, "excluded skills"),
  };
}

function trialFacts(record: ObjectValue) {
  const harness = record.harness ? object(record.harness, "harness") : {};
  return {
    trial: plannedTrials(record.trial),
    recorded: {
      routeApplication: recordedRouteApplication(record.routeApplication),
      orchestrationMetrics: recordedOrchestrationMetrics(
        record.orchestrationMetrics,
      ),
    },
    executionMode: mode(record.executionMode),
    passed: boolean(record.passed),
    harnessOk: boolean(harness.ok),
    checks: record.checks == null ? null : checks(record.checks),
    activation: activation(record.activation),
    semantic: grading(record.semanticOutput),
    advisory: grading(record.judge),
    effectiveOwnerRoute: record.effectiveOwnerRoute
      ? object(record.effectiveOwnerRoute, "effective owner route")
      : null,
    policyAssistance: text(harness.evaluationEnforcement),
    tokenUsageComplete: boolean(harness.tokenUsageComplete),
  };
}

type Trial = ReturnType<typeof trialFacts>;

function semanticAssessments(trial: Trial) {
  const names = new Set<string>();
  return (trial.semantic?.assessments ?? []).map((value) => {
    const item = object(value, "semantic assessment");
    const name = text(item.name);
    if (
      !name ||
      (item.verdict !== "pass" && item.verdict !== "fail") ||
      typeof item.reason !== "string"
    )
      throw new Error("Invalid legacy semantic assessment");
    if (names.has(name))
      throw new Error(`Duplicate legacy semantic assessment: ${name}`);
    names.add(name);
    return { name, passed: item.verdict === "pass" };
  });
}

function semanticError(trial: Trial) {
  try {
    const assessments = semanticAssessments(trial);
    const mismatch = assessments.find((assessment) => {
      const check = trial.checks?.find(({ name }) => name === assessment.name);
      return check?.passed != null && check.passed !== assessment.passed;
    });
    if (mismatch)
      return `Semantic assessment contradicts recorded check: ${mismatch.name}`;
    if (trial.passed === true && assessments.some(({ passed }) => !passed))
      return "Recorded trial success contradicts failed semantic evidence";
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function verdictError(trials: Trial[]) {
  const contradictory = trials.some(
    (trial) =>
      trial.passed === true &&
      (trial.harnessOk === false ||
        trial.checks?.some(({ passed }) => passed === false)),
  );
  return contradictory
    ? "Recorded trial success contradicts failed evidence"
    : null;
}

function trialNumbers(trials: Trial[], expected: number | null) {
  const numbers = trials.map(({ trial }) => trial);
  const known = numbers.filter((number) => number !== null);
  if (new Set(known).size !== known.length)
    throw new Error("Duplicate legacy trial number");
  if (expected !== null && known.some((number) => number > expected))
    throw new Error("Legacy trial number exceeds planned count");
  return numbers;
}

export function legacyExitCode(value: unknown) {
  const exit = value;
  if (
    exit != null &&
    (typeof exit !== "number" || !Number.isSafeInteger(exit) || exit < 0)
  )
    throw new Error("Invalid legacy cell exit code");
  return exit ?? null;
}

function completeness(
  trials: Trial[],
  cell: ObjectValue,
  manifest: ObjectValue,
) {
  const expected = plannedTrials(manifest.trials ?? manifest.plannedTrials);
  const numbers = trialNumbers(trials, expected);
  const exit = legacyExitCode(cell.exitCode);
  if (manifest.format === "darrow-eval-trial-v1")
    return { completeness: "partial", expectedTrialCount: expected };
  if (expected === null || exit == null)
    return { completeness: "unknown", expectedTrialCount: expected };
  const complete =
    (exit === 0 || exit === 1) &&
    numbers.length === expected &&
    numbers.every((number) => number !== null);
  return {
    completeness: complete ? "complete" : "partial",
    expectedTrialCount: expected,
  };
}

const bookkeepingNames = [
  "reported child invocation count",
  "reported human intervention count",
];

function qualityPassed(trial: Trial) {
  if (
    trial.harnessOk === null ||
    trial.checks === null ||
    !semanticAvailable(trial)
  )
    return null;
  const outcomes = trial.checks.filter(
    ({ name }) => !bookkeepingNames.includes(name),
  );
  if (outcomes.some(({ passed }) => passed === null)) return null;
  return trial.harnessOk && outcomes.every(({ passed }) => passed);
}

function semanticAvailable(trial: Trial) {
  if (trial.semantic === null) return true;
  if (trial.semantic.ok !== true || trial.semantic.parseError !== null)
    return false;
  const assessments = semanticAssessments(trial);
  return (
    assessments.length > 0 &&
    assessments.every((assessment) =>
      trial.checks?.some(
        ({ name, passed }) => name === assessment.name && passed !== null,
      ),
    )
  );
}

function protocolPassed(trial: Trial) {
  if (
    trial.harnessOk === null ||
    trial.checks === null ||
    !semanticAvailable(trial)
  )
    return null;
  if (trial.checks.some(({ passed }) => passed === null)) return null;
  return trial.passed;
}

function bookkeepingPassed(trial: Trial) {
  const outcomes =
    trial.checks?.filter(({ name }) => bookkeepingNames.includes(name)) ?? [];
  if (
    outcomes.length !== bookkeepingNames.length ||
    bookkeepingNames.some(
      (name) => !outcomes.some((check) => check.name === name),
    )
  )
    return null;
  if (outcomes.some(({ passed }) => passed === null)) return null;
  return outcomes.every(({ passed }) => passed);
}

function passRate(outcomes: Array<boolean | null>) {
  if (!outcomes.length || outcomes.includes(null)) return null;
  return outcomes.filter((passed) => passed).length / outcomes.length;
}

function measured(
  trials: Trial[],
  observedExecution: string,
  completion: string,
) {
  const available =
    observedExecution === "executed" && completion === "complete";
  return {
    qualityPassRate: available ? passRate(trials.map(qualityPassed)) : null,
    protocolPassRate: available ? passRate(trials.map(protocolPassed)) : null,
    bookkeepingPassRate: available
      ? passRate(trials.map(bookkeepingPassed))
      : null,
  };
}

function usageComplete(trials: Trial[]) {
  if (!trials.length) return null;
  const values = trials.map(({ tokenUsageComplete }) => tokenUsageComplete);
  if (values.includes(false)) return false;
  return values.every((value) => value === true) ? true : null;
}

function policyAssistance(result: ObjectValue, trials: Trial[]) {
  const modes = [
    ...new Set(trials.map(({ policyAssistance }) => policyAssistance)),
  ];
  return {
    requested: text(result.ownerEvaluationMode),
    actual: modes.length === 1 ? modes[0] : null,
  };
}

const summaryFields = [
  "passRate",
  "passThreshold",
  "activationPassRate",
  "harnessVersion",
  "condition",
  "evaluationDigest",
  "skillDirectory",
  "mountPluginSkills",
  "meanDurationMs",
  "p95DurationMs",
  "meanTokens",
  "totalCostUsd",
  "humanReviewMinutes",
  "meanJudgeScore",
  "judgePassRate",
  "meanPreparationDurationMs",
  "meanClassifierDurationMs",
  "meanClassifierTokens",
  "meanClassifierModelCalls",
  "meanExecutionDurationMs",
  "meanExecutionTokens",
  "meanChildInvocationCount",
  "childInvocationCountSource",
  "totalHumanInterruptions",
  "escapedDefects",
  "falsePositiveVerifierFindings",
  "codexAgentConcurrencyLimit",
];

function recorded(result: ObjectValue) {
  return Object.fromEntries(
    summaryFields.map((name) => [name, result[name] ?? null]),
  );
}

/** Darrow-specific meaning of its archived case and trial records. */
export function legacyRow(
  value: unknown,
  cell: ObjectValue,
  manifest: ObjectValue,
) {
  const result = object(value, "case result");
  if (!text(result.caseId)) throw new Error("caseId is required");
  const sourceTrials = list(result.trials, "trials").map((trial) =>
    object(trial, "trial"),
  );
  const trials = sourceTrials.map(trialFacts);
  const observed = execution(result, manifest, sourceTrials);
  const completed = completeness(trials, cell, manifest);
  const error =
    observed.error ??
    verdictError(trials) ??
    trials.map(semanticError).find((value) => value !== null) ??
    null;
  return {
    caseId: result.caseId,
    harness: text(result.harness),
    mode: text(cell.mode),
    resultFile: String(cell.result),
    exitCode: cell.exitCode ?? null,
    ...observed,
    error,
    ...completed,
    observedTrialCount: trials.length,
    attemptId: text(manifest.attemptId),
    candidateRoute: {
      harness: text(result.harness),
      model: text(result.model),
      effort: text(result.effort),
    },
    evaluator: evaluator(manifest),
    recorded: recorded(result),
    trials,
    policyAssistance: policyAssistance(result, trials),
    tokenUsageComplete: usageComplete(trials),
    measured: measured(
      trials,
      error ? "unknown" : observed.executionMode,
      completed.completeness,
    ),
  };
}
