import type {
  CommandResult,
  LoopRegion,
  OutcomeValue,
  ResolvedPlan,
} from "./types";

export interface ExecutionNode {
  id: string;
  dependsOn: string[];
  stepIds: string[];
  loop: LoopRegion | null;
}

export function executionNodes(plan: ResolvedPlan): ExecutionNode[] {
  const loopsByStep = new Map<string, LoopRegion>();
  for (const loop of plan.loops)
    for (const stepId of loop.steps) loopsByStep.set(stepId, loop);
  const emitted = new Set<string>();
  const nodes: ExecutionNode[] = [];
  for (const step of plan.steps) {
    const loop = loopsByStep.get(step.id);
    if (!loop) {
      nodes.push({
        id: step.id,
        dependsOn: step.dependsOn,
        stepIds: [step.id],
        loop: null,
      });
      continue;
    }
    if (emitted.has(loop.id)) continue;
    emitted.add(loop.id);
    const first = plan.steps.find((item) => item.id === loop.steps[0])!;
    nodes.push({
      id: loop.steps.at(-1)!,
      dependsOn: first.dependsOn,
      stepIds: loop.steps,
      loop,
    });
  }
  return nodes;
}

export function loopOutcome(
  loop: LoopRegion,
  result: CommandResult,
): OutcomeValue {
  const value = result.payload?.[loop.until.output];
  if (
    value !== null &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  )
    throw new Error(
      `loop ${loop.id} received invalid scalar output ${loop.until.output}`,
    );
  return value;
}

export function loopSatisfied(
  loop: LoopRegion,
  result: CommandResult,
): boolean {
  return Object.is(loopOutcome(loop, result), loop.until.equals);
}
