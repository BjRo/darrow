import type { CheckResult } from "./types";

export interface OrchestrationMetrics {
  childInvocationCount: number;
  humanInterruptions: number;
  escapedDefects: number;
  falsePositiveVerifierFindings: number;
}

interface ObservedTicketPipelineRoute {
  phase: string;
  iteration: number;
  childId: string;
  skill: string;
  threadId: string;
}

export function observeCodexTicketPipelineRoutes(
  raw: string,
): ObservedTicketPipelineRoute[] | undefined {
  const routes: ObservedTicketPipelineRoute[] = [];
  let sawCodexEvent = false;
  for (const line of raw.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (/^(thread|turn|item)\./.test(event.type ?? "")) sawCodexEvent = true;
      const item = event.item;
      if (
        event.type !== "item.completed" ||
        item?.type !== "collab_tool_call" ||
        item?.tool !== "spawn_agent" ||
        item?.status !== "completed" ||
        !Array.isArray(item.receiver_thread_ids) ||
        item.receiver_thread_ids.length !== 1
      )
        continue;
      const prompt = typeof item.prompt === "string" ? item.prompt : "";
      const phase = prompt.match(/^- phase: ([a-z]+)$/m)?.[1];
      const iteration = prompt.match(/^- iteration: ([0-9]+)$/m)?.[1];
      const childId = prompt.match(/^- stable_child_id: (.+)$/m)?.[1];
      const skill = prompt.match(
        /^- (?:required skill|phase_skill): \$([a-z-]+)$/m,
      )?.[1];
      if (phase && iteration && childId && skill) {
        routes.push({
          phase,
          iteration: Number(iteration),
          childId,
          skill,
          threadId: item.receiver_thread_ids[0],
        });
      }
    } catch {
      // Ignore non-JSON harness noise.
    }
  }
  return sawCodexEvent ? routes : undefined;
}

export function reconcileObservedTicketPipelineRoutes(
  resultText: string,
  raw: string,
): CheckResult | undefined {
  if (!/^format\tdarrow-ticket-pipeline-result-v1$/m.test(resultText))
    return undefined;
  const observed = observeCodexTicketPipelineRoutes(raw);
  if (!observed) return undefined;
  const declaredRoutes = [
    ...resultText.matchAll(
      /^route\t([a-z]+)\t([0-9]+)\t[^\t\n]+\t[^\t\n]+\t[^\t\n]+\t([^\t\n]+)$/gm,
    ),
  ].map((match) => `${match[1]}:${match[2]}:${match[3]}`);
  const declaredCount = Number(
    resultText.match(/^evaluation_child_invocations\t([0-9]+)$/m)?.[1] ?? -1,
  );
  const expectedSkills: Record<string, string> = {
    refine: "refine-ticket",
    challenge: "challenge-ticket",
    implement: "implement-ticket",
    review: "review-ticket",
    rework: "rework-ticket",
    qa: "qa-ticket",
    codify: "codify-ticket",
  };
  const observedRoutes = observed.map(
    (route) => `${route.phase}:${route.iteration}:${route.childId}`,
  );
  const observedAttempts = observed.map(
    (route) => `${route.phase}:${route.iteration}`,
  );
  const declaredAttempts = declaredRoutes.map((route) =>
    route.split(":").slice(0, 2).join(":"),
  );
  const identitiesMatch =
    new Set(observedRoutes).size === observedRoutes.length &&
    new Set(declaredRoutes).size === declaredRoutes.length &&
    new Set(observedAttempts).size === observedAttempts.length &&
    new Set(declaredAttempts).size === declaredAttempts.length &&
    new Set(observed.map((route) => route.threadId)).size === observed.length &&
    observed.every((route) => expectedSkills[route.phase] === route.skill) &&
    declaredRoutes.length === observedRoutes.length &&
    declaredRoutes.every((route) => observedRoutes.includes(route)) &&
    observedRoutes.every((route) => declaredRoutes.includes(route));
  const passed = identitiesMatch && declaredCount === observed.length;
  return {
    name: "harness-observed ticket-pipeline children match controller routes",
    passed,
    detail: passed
      ? `${observed.length} unique phase children observed`
      : `observed=${observedRoutes.join(",") || "none"}; declared=${declaredRoutes.join(",") || "none"}; declared_count=${declaredCount}`,
  };
}

export function hasForeignOrchestrationRoute(
  resultText: string,
  hostHarness: string,
): boolean {
  for (const match of resultText.matchAll(
    /^route\t(?:(?:planner|executor|verifier|repair)\t([^\t\n]+)|(?:refine|challenge|implement|review|rework|qa|codify)\t[0-9]+\t([^\t\n]+))\t/gm,
  )) {
    if ((match[1] ?? match[2]) !== hostHarness) return true;
  }
  return false;
}

export function extractOrchestrationMetrics(
  resultText: string,
  checks: CheckResult[],
  observedChildInvocationCount?: number,
): OrchestrationMetrics | undefined {
  const routeRecords = resultText.match(
    /^route\t(?:planner|executor|verifier|repair)\t/gm,
  );
  const hasGoalLoopResult = /^format\tdarrow-goal-loop-result-v1$/m.test(
    resultText,
  );
  const declaredChildren = resultText.match(
    /^evaluation_child_invocations\t([0-9]+)$/m,
  );
  const declaredInterruptions = resultText.match(
    /^evaluation_human_interruptions\t([0-9]+)$/m,
  );
  if (!hasGoalLoopResult && !routeRecords && !declaredChildren)
    return undefined;
  return {
    childInvocationCount:
      observedChildInvocationCount ??
      routeRecords?.length ??
      Number(declaredChildren?.[1] ?? 0),
    humanInterruptions: declaredInterruptions
      ? Number(declaredInterruptions[1])
      : /^status\tneeds_human$/m.test(resultText)
        ? 1
        : 0,
    escapedDefects: checks.filter(
      (check) => check.metric === "escaped_defect" && !check.passed,
    ).length,
    falsePositiveVerifierFindings: checks.filter(
      (check) => check.metric === "false_positive" && !check.passed,
    ).length,
  };
}
