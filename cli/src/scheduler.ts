export type StepExecutionState =
  | "pending"
  | "running"
  | "waiting_for_input"
  | "succeeded"
  | "failed"
  | "blocked";

export interface StepExecutionStatus {
  stepId: string;
  state: StepExecutionState;
  attempt: number;
}

export interface ScheduledStep {
  id: string;
  dependsOn: string[];
}

export interface StepOutcome<T> {
  state: "succeeded" | "failed";
  value?: T;
  stop?: boolean;
}

export interface GraphExecution<T> {
  steps: StepExecutionStatus[];
  results: T[];
}

export function initialStepStatuses(
  steps: ScheduledStep[],
): StepExecutionStatus[] {
  return steps.map((step) => ({
    stepId: step.id,
    state: "pending",
    attempt: 0,
  }));
}

export async function executeStaticGraph<T>(
  steps: ScheduledStep[],
  runStep: (
    step: ScheduledStep,
    status: StepExecutionStatus,
  ) => Promise<StepOutcome<T>>,
  statuses = initialStepStatuses(steps),
): Promise<GraphExecution<T>> {
  const byId = new Map(statuses.map((status) => [status.stepId, status]));
  const results = new Map<string, T>();

  while (statuses.some((status) => status.state === "pending")) {
    for (const step of steps) {
      const status = byId.get(step.id)!;
      if (status.state !== "pending") continue;
      if (
        step.dependsOn.some((dependency) => {
          const dependencyState = byId.get(dependency)!.state;
          return dependencyState === "failed" || dependencyState === "blocked";
        })
      )
        status.state = "blocked";
    }

    const ready = steps.filter((step) => {
      const status = byId.get(step.id)!;
      return (
        status.state === "pending" &&
        step.dependsOn.every(
          (dependency) => byId.get(dependency)!.state === "succeeded",
        )
      );
    });
    if (ready.length === 0) {
      if (statuses.some((status) => status.state === "pending"))
        throw new Error("validated workflow graph has no schedulable step");
      break;
    }

    for (const step of ready) {
      const status = byId.get(step.id)!;
      status.state = "running";
      status.attempt = 1;
    }
    const completed = await Promise.all(
      ready.map(async (step) => ({
        step,
        outcome: await runStep(step, byId.get(step.id)!),
      })),
    );
    let stop = false;
    for (const { step, outcome } of completed) {
      const status = byId.get(step.id)!;
      status.state = outcome.state;
      if (outcome.value !== undefined) results.set(step.id, outcome.value);
      stop ||= outcome.stop === true;
    }
    if (stop) {
      for (const status of statuses)
        if (status.state === "pending") status.state = "blocked";
      break;
    }
  }

  return {
    steps: statuses,
    results: steps.flatMap((step) => {
      const result = results.get(step.id);
      return result === undefined ? [] : [result];
    }),
  };
}
