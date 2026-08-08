import type { CheckResult, GoalRoute, GoalRouteApplication } from "./types";

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

function parseGoalRoute(text: string, field: string): GoalRoute | undefined {
  const match = text.match(
    new RegExp(
      `^${field}\\t([^\\t\\n]+)\\t([^\\t\\n]+)\\t([^\\t\\n]+)\\t([^\\t\\n]+)$`,
      "m",
    ),
  );
  return match
    ? {
        harness: match[1]!,
        provider: match[2]!,
        model: match[3]!,
        effort: match[4]!,
      }
    : undefined;
}

function sameGoalRoute(left: GoalRoute, right: GoalRoute): boolean {
  return (
    left.harness === right.harness &&
    left.provider === right.provider &&
    left.model === right.model &&
    left.effort === right.effort
  );
}

function nestedGoalApplication(raw: string):
  | {
      selected: GoalRoute;
      effective: GoalRoute;
      inputTokens: number;
      outputTokens: number;
    }
  | undefined {
  const applications = [];
  for (const line of raw.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      const item = event.item;
      if (
        event.type !== "item.completed" ||
        item?.type !== "command_execution" ||
        item?.status !== "completed" ||
        item?.exit_code !== 0 ||
        typeof item?.aggregated_output !== "string" ||
        !/^format\tdarrow-native-goal-route-application-v1$/m.test(
          item.aggregated_output,
        ) ||
        !/^route_applied_by\tnested-session$/m.test(item.aggregated_output) ||
        !/^route_verified\ttrue$/m.test(item.aggregated_output)
      )
        continue;
      const selected = parseGoalRoute(item.aggregated_output, "selected_route");
      const effective = parseGoalRoute(
        item.aggregated_output,
        "effective_route",
      );
      if (!selected || !effective) continue;
      let inputTokens = 0;
      let outputTokens = 0;
      let completed = false;
      for (const nestedLine of item.aggregated_output.split("\n")) {
        if (!nestedLine.trim().startsWith("{")) continue;
        try {
          const nestedEvent = JSON.parse(nestedLine);
          if (nestedEvent.type !== "turn.completed") continue;
          completed = true;
          inputTokens = nestedEvent.usage?.input_tokens ?? inputTokens;
          outputTokens = nestedEvent.usage?.output_tokens ?? outputTokens;
        } catch {
          // Non-JSON nested output is permitted around the Codex JSONL stream.
        }
      }
      if (completed)
        applications.push({ selected, effective, inputTokens, outputTokens });
    } catch {
      // Ignore non-JSON harness noise.
    }
  }
  return applications.length === 1 ? applications[0] : undefined;
}

function hostGoalApplication(raw: string):
  | {
      selected: GoalRoute;
      effective: GoalRoute;
      threadId: string;
      turnId: string;
    }
  | undefined {
  const applications: Array<{
    selected: GoalRoute;
    effective: GoalRoute;
    threadId: string;
    turnId: string;
  }> = [];
  for (const line of raw.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (
        event.type !== "darrow.route_applied" ||
        event.accepted !== true ||
        event.appliedBy !== "host-api" ||
        typeof event.threadId !== "string" ||
        typeof event.turnId !== "string"
      )
        continue;
      const selected = event.selected as GoalRoute | undefined;
      const effective = event.effective as GoalRoute | undefined;
      if (
        !selected ||
        !effective ||
        ![selected, effective].every(
          (route) =>
            typeof route.harness === "string" &&
            typeof route.provider === "string" &&
            typeof route.model === "string" &&
            typeof route.effort === "string",
        )
      )
        continue;
      applications.push({
        selected,
        effective,
        threadId: event.threadId,
        turnId: event.turnId,
      });
    } catch {
      // Ignore non-JSON harness noise.
    }
  }
  return applications.length === 1 ? applications[0] : undefined;
}

function hostGoalDimensions(raw: string):
  | {
      stage: "workflow" | "workflow-risk";
      workflow: string;
      risk: "routine" | "elevated" | "high";
      threadId: string;
      turnId: string;
    }
  | undefined {
  const dimensions: Array<{
    stage: "workflow" | "workflow-risk";
    workflow: string;
    risk: "routine" | "elevated" | "high";
    threadId: string;
    turnId: string;
  }> = [];
  for (const line of raw.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (
        event.type !== "darrow.dimensions_applied" ||
        event.accepted !== true ||
        typeof event.threadId !== "string" ||
        typeof event.turnId !== "string" ||
        !["workflow", "workflow-risk"].includes(event.stage) ||
        typeof event.workflow !== "string" ||
        !["routine", "elevated", "high"].includes(event.risk)
      )
        continue;
      dimensions.push({
        stage: event.stage,
        workflow: event.workflow,
        risk: event.risk,
        threadId: event.threadId,
        turnId: event.turnId,
      });
    } catch {
      // Ignore non-JSON harness noise.
    }
  }
  return dimensions.length === 1 ? dimensions[0] : undefined;
}

function hostGoalWorkflow(raw: string):
  | {
      workflow: string;
      file: string;
      sha256: string;
      threadId: string;
      turnId: string;
    }
  | undefined {
  const workflows: Array<{
    workflow: string;
    file: string;
    sha256: string;
    threadId: string;
    turnId: string;
  }> = [];
  for (const line of raw.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (
        event.type !== "darrow.workflow_loaded" ||
        event.accepted !== true ||
        typeof event.threadId !== "string" ||
        typeof event.turnId !== "string" ||
        typeof event.workflow !== "string" ||
        typeof event.file !== "string" ||
        !event.file.endsWith(`/references/workflows/${event.workflow}.md`) ||
        !/^[a-f0-9]{64}$/.test(event.sha256 ?? "")
      )
        continue;
      workflows.push({
        workflow: event.workflow,
        file: event.file,
        sha256: event.sha256,
        threadId: event.threadId,
        turnId: event.turnId,
      });
    } catch {
      // Ignore non-JSON harness noise.
    }
  }
  return workflows.length === 1 ? workflows[0] : undefined;
}

export function observeCodexGoalRouteApplication(
  resultText: string,
  raw: string,
): GoalRouteApplication | undefined {
  const format = resultText.match(
    /^format\t(darrow-native-goal-preflight-v[24])$/m,
  )?.[1];
  if (!format) return undefined;
  const isV4 = format.endsWith("v4");
  const profile = resultText.match(/^profile\t([^\t\n]+)$/m)?.[1];
  const workflow = resultText.match(/^workflow\t([^\t\n]+)$/m)?.[1];
  const risk = resultText.match(/^risk\t(routine|elevated|high)$/m)?.[1] as
    GoalRouteApplication["risk"] | undefined;
  const verificationGate = resultText.match(
    /^verification_gate\t(routine|elevated|high)$/m,
  )?.[1] as GoalRouteApplication["verificationGate"] | undefined;
  const selected = parseGoalRoute(resultText, "selected_route");
  const effective = parseGoalRoute(resultText, "effective_route");
  const appliedBy = resultText.match(
    /^route_applied_by\t(current-thread|host-api|native-subagent|nested-session)$/m,
  )?.[1] as GoalRouteApplication["appliedBy"] | undefined;
  const launchBoundary = resultText.match(
    /^launch_boundary\t(same_thread|host_api|native_subagent|nested_session)$/m,
  )?.[1] as GoalRouteApplication["launchBoundary"] | undefined;
  const declaredChildren = Number(
    resultText.match(/^evaluation_child_invocations\t([0-9]+)$/m)?.[1] ?? -1,
  );
  if (
    !profile ||
    !selected ||
    !effective ||
    !appliedBy ||
    !launchBoundary ||
    (isV4 && (!workflow || !risk || !verificationGate))
  )
    return undefined;

  if (launchBoundary === "nested_session") {
    const nested = nestedGoalApplication(raw);
    if (!nested) return undefined;
    return {
      profile,
      selected,
      effective,
      appliedBy,
      launchBoundary,
      childInvocationCount: 1,
      childInputTokens: nested.inputTokens,
      childOutputTokens: nested.outputTokens,
    };
  }

  if (launchBoundary === "host_api") {
    const host = hostGoalApplication(raw);
    const dimensions = isV4 ? hostGoalDimensions(raw) : undefined;
    const loadedWorkflow = isV4 ? hostGoalWorkflow(raw) : undefined;
    if (
      !host ||
      !sameGoalRoute(selected, host.selected) ||
      !sameGoalRoute(effective, host.effective) ||
      (isV4 &&
        (!dimensions ||
          !loadedWorkflow ||
          dimensions.workflow !== workflow ||
          dimensions.risk !== risk ||
          (dimensions.stage === "workflow" && risk !== "routine") ||
          loadedWorkflow.workflow !== workflow ||
          dimensions.threadId !== host.threadId ||
          dimensions.turnId !== host.turnId ||
          loadedWorkflow.threadId !== host.threadId ||
          loadedWorkflow.turnId !== host.turnId))
    )
      return undefined;
    return {
      profile,
      ...(isV4
        ? {
            workflow,
            risk,
            workflowFile: loadedWorkflow!.file,
            workflowSha256: loadedWorkflow!.sha256,
            dimensionStage: dimensions!.stage,
            verificationGate,
          }
        : {}),
      selected: host.selected,
      effective: host.effective,
      appliedBy,
      launchBoundary,
      childInvocationCount: 0,
      childInputTokens: 0,
      childOutputTokens: 0,
    };
  }

  return {
    profile,
    selected,
    effective,
    appliedBy,
    launchBoundary,
    childInvocationCount: declaredChildren,
    childInputTokens: 0,
    childOutputTokens: 0,
  };
}

export function reconcileObservedGoalRouteApplication(
  resultText: string,
  raw: string,
  hostHarness: string,
  hostModel: string,
  hostEffort: string,
): CheckResult | undefined {
  const isV4 = /^format\tdarrow-native-goal-preflight-v4$/m.test(resultText);
  if (!isV4 && !/^format\tdarrow-native-goal-preflight-v2$/m.test(resultText))
    return undefined;
  if (/^launch_boundary\tlaunch_required$/m.test(resultText)) {
    const stoppedWithoutRoute =
      /^selected_route\tnone\tnone\tnone\tnone$/m.test(resultText) &&
      /^effective_route\tnone\tnone\tnone\tnone$/m.test(resultText) &&
      /^route_applied_by\tnone$/m.test(resultText) &&
      /^route_verified\tfalse$/m.test(resultText) &&
      /^evaluation_child_invocations\t0$/m.test(resultText);
    return {
      name: "goal stopped without claiming an unapplied route",
      passed: stoppedWithoutRoute,
      detail: stoppedWithoutRoute
        ? "launch_required with no effective route"
        : "launch_required must report an unapplied, unverified route",
    };
  }
  const observed = observeCodexGoalRouteApplication(resultText, raw);
  const declaredChildren = Number(
    resultText.match(/^evaluation_child_invocations\t([0-9]+)$/m)?.[1] ?? -1,
  );
  const verified = /^route_verified\ttrue$/m.test(resultText);
  const workflowVerified =
    !isV4 ||
    observed?.launchBoundary !== "host_api" ||
    (observed.workflow !== undefined &&
      observed.risk !== undefined &&
      observed.workflowFile !== undefined &&
      observed.workflowSha256 !== undefined &&
      observed.dimensionStage !== undefined &&
      observed.verificationGate === observed.risk);
  const routesMatch =
    observed !== undefined &&
    sameGoalRoute(observed.selected, observed.effective);
  const effectiveMatchesCurrentTurn =
    observed?.effective.harness === hostHarness &&
    observed?.effective.model === hostModel &&
    observed?.effective.effort === hostEffort;
  const boundaryMatches =
    observed?.launchBoundary === "nested_session"
      ? observed.appliedBy === "nested-session" &&
        declaredChildren === 1 &&
        !effectiveMatchesCurrentTurn
      : observed?.launchBoundary === "same_thread"
        ? observed.appliedBy === "current-thread" &&
          declaredChildren === 0 &&
          effectiveMatchesCurrentTurn
        : observed?.launchBoundary === "host_api"
          ? observed.appliedBy === "host-api" && declaredChildren === 0
          : observed?.launchBoundary === "native_subagent"
            ? observed.appliedBy === "native-subagent" && declaredChildren === 1
            : false;
  const passed = verified && workflowVerified && routesMatch && boundaryMatches;
  return {
    name: "harness-observed goal route matches selected model and effort",
    passed,
    detail: passed
      ? `${observed!.effective.model}/${observed!.effective.effort} via ${observed!.appliedBy}`
      : "selected/effective route or application boundary was not observed",
  };
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

export function hasUnreconciledOrchestrationUsage(
  resultText: string,
  hostHarness: string,
): boolean {
  if (/^launch_boundary\tnested_session$/m.test(resultText)) return true;
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
