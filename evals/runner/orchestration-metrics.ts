import type { CheckResult, GoalRoute, GoalRouteApplication } from "./types";
import {
  parsePausedGoalReport,
  parseTerminalGoalReport,
  validGoalReportValues,
  type GoalReport,
} from "./goal-report";

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

/** Thread/turn identity every accepted host-API event carries. */
interface HostTurn {
  threadId: string;
  turnId: string;
}

interface HostRouteApplied extends HostTurn {
  selected: GoalRoute;
  effective: GoalRoute;
}

interface HostDimensions extends HostTurn {
  stage: "workflow" | "workflow-risk";
  workflow: string;
  risk: "routine" | "elevated" | "high";
}

interface HostWorkflowLoaded extends HostTurn {
  workflow: string;
  file: string;
  sha256: string;
}

interface NestedGoalApplication {
  selected: GoalRoute;
  effective: GoalRoute;
  inputTokens: number;
  outputTokens: number;
}

/** Workflow fields shared by internal v4 records and readable v1 reports. */
interface GoalPreflightV4 {
  workflow: string;
  risk: NonNullable<GoalRouteApplication["risk"]>;
  verificationGate: NonNullable<GoalRouteApplication["verificationGate"]>;
}

interface GoalPreflight {
  profile: string;
  selected: GoalRoute;
  effective: GoalRoute;
  appliedBy: GoalRouteApplication["appliedBy"];
  launchBoundary: GoalRouteApplication["launchBoundary"];
  declaredChildren: number;
  /** Present for workflow-bearing v4 records and readable v1 reports. */
  v4?: GoalPreflightV4;
}

/** Host route the current turn actually ran on. */
export interface HostRoute {
  harness: string;
  model: string;
  effort: string;
}

const RISK_LEVELS = ["routine", "elevated", "high"] as const;
const DIMENSION_STAGES = ["workflow", "workflow-risk"] as const;
const APPLIED_BY_VALUES = [
  "current-thread",
  "host-api",
  "native-subagent",
  "nested-session",
] as const;
const LAUNCH_BOUNDARY_VALUES = [
  "same_thread",
  "host_api",
  "native_subagent",
  "nested_session",
] as const;

const DECLARED_CHILDREN =
  /^(?:evaluation_child_invocations\t|evaluation_child_invocations: )([0-9]+)$/m;
const GOAL_PREFLIGHT_FORMAT = /^format\t(darrow-native-goal-preflight-v[24])$/m;
const GOAL_PREFLIGHT_V4 = /^format\tdarrow-native-goal-preflight-v4$/m;
const GOAL_PREFLIGHT_V2 = /^format\tdarrow-native-goal-preflight-v2$/m;
const GOAL_REPORT_V1 = /^format: darrow-native-goal-report-v1[ \t]*$/m;
const TICKET_PIPELINE_FORMAT = /^format\tdarrow-ticket-pipeline-result-v1$/m;
const GOAL_LOOP_RESULT = /^format\tdarrow-goal-loop-result-v1$/m;
const ROUTE_VERIFIED = /^(?:route_verified\ttrue|route_verified: true)[ \t]*$/m;
const LAUNCH_REQUIRED =
  /^(?:launch_boundary\tlaunch_required|launch_boundary: launch_required)[ \t]*$/m;
const CODEX_STREAM_EVENT = /^(thread|turn|item)\./;
const SHA256 = /^[a-f0-9]{64}$/;
const NATIVE_GOAL_OWNER_PROMPT = /^- phase: adaptive-goal-runner(?:\r?\n|$)/;

/** Markers a nested Codex session must print to claim it applied the route. */
const NESTED_APPLICATION_MARKERS = [
  /^format\tdarrow-native-goal-route-application-v1$/m,
  /^route_applied_by\tnested-session$/m,
  /^route_verified\ttrue$/m,
];

/** A `launch_required` stop must leave every route field unapplied. */
const UNAPPLIED_ROUTE_MARKERS = [
  /^(?:selected_route\tnone\tnone\tnone\tnone|harness: none)$/m,
  /^(?:effective_route\tnone\tnone\tnone\tnone|model: none > none)$/m,
  /^(?:route_applied_by\tnone|route_applied_by: none)$/m,
  /^(?:route_verified\tfalse|route_verified: false)$/m,
];
const ZERO_CHILDREN =
  /^(?:evaluation_child_invocations\t0|evaluation_child_invocations: 0)$/m;
const ONE_CHILD =
  /^(?:evaluation_child_invocations\t1|evaluation_child_invocations: 1)$/m;
const CODEX_AGENT_REF =
  /^(?:\/root(?:\/[a-z0-9_]+)+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** Boundary-specific expectations the controller record must satisfy.
 *  `sameTurn` is omitted where the boundary constrains neither answer. */
const GOAL_BOUNDARY_EXPECTATIONS: Partial<
  Record<
    GoalRouteApplication["launchBoundary"],
    {
      appliedBy: GoalRouteApplication["appliedBy"];
      children: number;
      sameTurn?: boolean;
    }
  >
> = {
  nested_session: { appliedBy: "nested-session", children: 1, sameTurn: false },
  same_thread: { appliedBy: "current-thread", children: 0, sameTurn: true },
  host_api: { appliedBy: "host-api", children: 0 },
  native_subagent: { appliedBy: "native-subagent", children: 1 },
};

const EXPECTED_PHASE_SKILLS: Record<string, string> = {
  refine: "refine-ticket",
  challenge: "challenge-ticket",
  implement: "implement-ticket",
  review: "review-ticket",
  rework: "rework-ticket",
  qa: "qa-ticket",
  codify: "codify-ticket",
};

function matchField(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1];
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function memberOf<T extends string>(
  values: readonly T[],
  value: unknown,
): T | undefined {
  return values.includes(value as T) ? (value as T) : undefined;
}

function allUnique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

/** Yield every JSON object line of a harness stream, skipping the non-JSON
 *  noise harnesses interleave with their JSONL events. */
function* jsonlEvents(raw: string): Generator<Record<string, unknown>> {
  for (const line of raw.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      // Ignore non-JSON harness noise.
      continue;
    }
    yield recordOf(event);
  }
}

/** Extract from a stream, accepting the result only when exactly one event
 *  matches — an ambiguous stream proves nothing about what was applied. */
function singleEventMatch<T>(
  raw: string,
  extract: (event: Record<string, unknown>) => T | undefined,
): T | undefined {
  const matches: T[] = [];
  for (const event of jsonlEvents(raw)) {
    const match = extract(event);
    if (match !== undefined) matches.push(match);
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function declaredChildCount(text: string): number {
  return Number(matchField(text, DECLARED_CHILDREN) ?? -1);
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

function parseGoalReportRoute(report: GoalReport): GoalRoute | undefined {
  const model = report.model.match(/^([^\n]+) > ([^\n]+)$/);
  return model
    ? {
        harness: report.harness,
        provider: model[1]!,
        model: model[2]!,
        effort: report.effort,
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

function goalRouteOf(value: unknown): GoalRoute | undefined {
  const route = recordOf(value);
  const { harness, provider, model, effort } = route;
  return typeof harness === "string" &&
    typeof provider === "string" &&
    typeof model === "string" &&
    typeof effort === "string"
    ? { harness, provider, model, effort }
    : undefined;
}

function sameHostTurn(left: HostTurn, right: HostTurn): boolean {
  return left.threadId === right.threadId && left.turnId === right.turnId;
}

/** Thread/turn identity of an accepted host-API event of the given type. */
function acceptedHostTurn(
  event: Record<string, unknown>,
  type: string,
): HostTurn | undefined {
  const { threadId, turnId } = event;
  return event.type === type &&
    event.accepted === true &&
    typeof threadId === "string" &&
    typeof turnId === "string"
    ? { threadId, turnId }
    : undefined;
}

/** Output of a completed nested Codex run that claims it applied the route. */
function nestedApplicationOutput(
  event: Record<string, unknown>,
): string | undefined {
  const item = recordOf(event.item);
  const output = item.aggregated_output;
  if (
    event.type !== "item.completed" ||
    item.type !== "command_execution" ||
    item.status !== "completed" ||
    item.exit_code !== 0 ||
    typeof output !== "string" ||
    !NESTED_APPLICATION_MARKERS.every((marker) => marker.test(output))
  )
    return undefined;
  return output;
}

/** Usage reported by the nested session's last completed turn, or undefined
 *  when the nested session never completed a turn. */
function nestedTurnUsage(
  output: string,
): { inputTokens: number; outputTokens: number } | undefined {
  let inputTokens = 0;
  let outputTokens = 0;
  let completed = false;
  for (const event of jsonlEvents(output)) {
    if (event.type !== "turn.completed") continue;
    completed = true;
    const usage = recordOf(event.usage);
    if (typeof usage.input_tokens === "number")
      inputTokens = usage.input_tokens;
    if (typeof usage.output_tokens === "number")
      outputTokens = usage.output_tokens;
  }
  return completed ? { inputTokens, outputTokens } : undefined;
}

function nestedGoalApplication(raw: string): NestedGoalApplication | undefined {
  return singleEventMatch(raw, (event) => {
    const output = nestedApplicationOutput(event);
    if (!output) return undefined;
    const selected = parseGoalRoute(output, "selected_route");
    const effective = parseGoalRoute(output, "effective_route");
    const usage = nestedTurnUsage(output);
    if (!selected || !effective || !usage) return undefined;
    return { selected, effective, ...usage };
  });
}

function hostGoalApplication(raw: string): HostRouteApplied | undefined {
  return singleEventMatch(raw, (event) => {
    const turn = acceptedHostTurn(event, "darrow.route_applied");
    const selected = goalRouteOf(event.selected);
    const effective = goalRouteOf(event.effective);
    if (!turn || event.appliedBy !== "host-api" || !selected || !effective)
      return undefined;
    return { selected, effective, ...turn };
  });
}

function hostGoalDimensions(raw: string): HostDimensions | undefined {
  return singleEventMatch(raw, (event) => {
    const turn = acceptedHostTurn(event, "darrow.dimensions_applied");
    const stage = memberOf(DIMENSION_STAGES, event.stage);
    const risk = memberOf(RISK_LEVELS, event.risk);
    const { workflow } = event;
    if (!turn || !stage || !risk || typeof workflow !== "string")
      return undefined;
    return { stage, workflow, risk, ...turn };
  });
}

function hostGoalWorkflow(raw: string): HostWorkflowLoaded | undefined {
  return singleEventMatch(raw, (event) => {
    const turn = acceptedHostTurn(event, "darrow.workflow_loaded");
    const { workflow, file, sha256 } = event;
    if (
      !turn ||
      typeof workflow !== "string" ||
      typeof file !== "string" ||
      !file.endsWith(`/references/workflows/${workflow}.md`) ||
      typeof sha256 !== "string" ||
      !SHA256.test(sha256)
    )
      return undefined;
    return { workflow, file, sha256, ...turn };
  });
}

function goalPreflightV4Fields(
  resultText: string,
): GoalPreflightV4 | undefined {
  const workflow = matchField(resultText, /^workflow\t([^\t\n]+)$/m);
  const risk = memberOf(
    RISK_LEVELS,
    matchField(resultText, /^risk\t(routine|elevated|high)$/m),
  );
  const verificationGate = memberOf(
    RISK_LEVELS,
    matchField(resultText, /^verification_gate\t(routine|elevated|high)$/m),
  );
  return workflow && risk && verificationGate
    ? { workflow, risk, verificationGate }
    : undefined;
}

function goalPreflightBase(resultText: string): GoalPreflight | undefined {
  const profile = matchField(resultText, /^profile\t([^\t\n]+)$/m);
  const selected = parseGoalRoute(resultText, "selected_route");
  const effective = parseGoalRoute(resultText, "effective_route");
  const appliedBy = memberOf(
    APPLIED_BY_VALUES,
    matchField(
      resultText,
      /^route_applied_by\t(current-thread|host-api|native-subagent|nested-session)$/m,
    ),
  );
  const launchBoundary = memberOf(
    LAUNCH_BOUNDARY_VALUES,
    matchField(
      resultText,
      /^launch_boundary\t(same_thread|host_api|native_subagent|nested_session)$/m,
    ),
  );
  if (!profile || !selected || !effective || !appliedBy || !launchBoundary)
    return undefined;
  return {
    profile,
    selected,
    effective,
    appliedBy,
    launchBoundary,
    declaredChildren: declaredChildCount(resultText),
  };
}

function goalReportV1Base(resultText: string): GoalPreflight | undefined {
  const report =
    parseTerminalGoalReport(resultText) ?? parsePausedGoalReport(resultText);
  if (!validGoalReportValues(report)) return undefined;
  const route = parseGoalReportRoute(report!);
  const appliedBy = memberOf(APPLIED_BY_VALUES, report!.route_applied_by);
  const launchBoundary = memberOf(
    LAUNCH_BOUNDARY_VALUES,
    report!.launch_boundary,
  );
  const risk = memberOf(RISK_LEVELS, report!.risk);
  const verificationGate = memberOf(RISK_LEVELS, report!.verification_gate);
  if (!route || !appliedBy || !launchBoundary || !risk || !verificationGate)
    return undefined;
  return {
    profile: report!.profile,
    selected: route,
    effective: route,
    appliedBy,
    launchBoundary,
    declaredChildren: Number(report!.evaluation_child_invocations),
    v4: { workflow: report!.workflow, risk, verificationGate },
  };
}

function parseGoalPreflight(resultText: string): GoalPreflight | undefined {
  if (GOAL_REPORT_V1.test(resultText)) return goalReportV1Base(resultText);
  const format = matchField(resultText, GOAL_PREFLIGHT_FORMAT);
  if (!format) return undefined;
  const base = goalPreflightBase(resultText);
  if (!base) return undefined;
  if (!format.endsWith("v4")) return base;
  const v4 = goalPreflightV4Fields(resultText);
  return v4 ? { ...base, v4 } : undefined;
}

function nestedGoalRouteApplication(
  preflight: GoalPreflight,
  raw: string,
): GoalRouteApplication | undefined {
  const nested = nestedGoalApplication(raw);
  if (!nested) return undefined;
  return {
    profile: preflight.profile,
    selected: preflight.selected,
    effective: preflight.effective,
    appliedBy: preflight.appliedBy,
    launchBoundary: preflight.launchBoundary,
    childInvocationCount: 1,
    childInputTokens: nested.inputTokens,
    childOutputTokens: nested.outputTokens,
  };
}

function hostDimensionsMatch(
  dimensions: HostDimensions,
  v4: GoalPreflightV4,
): boolean {
  return (
    dimensions.workflow === v4.workflow &&
    dimensions.risk === v4.risk &&
    (dimensions.stage !== "workflow" || v4.risk === "routine")
  );
}

type HostV4Evidence = Pick<
  GoalRouteApplication,
  | "workflow"
  | "risk"
  | "workflowFile"
  | "workflowSha256"
  | "dimensionStage"
  | "verificationGate"
>;

/** v4 host runs must also show the dimensions and workflow the preflight
 *  declared, applied on the very turn that applied the route. */
function hostV4Evidence(
  v4: GoalPreflightV4,
  host: HostTurn,
  raw: string,
): HostV4Evidence | undefined {
  const dimensions = hostGoalDimensions(raw);
  const loadedWorkflow = hostGoalWorkflow(raw);
  if (
    !dimensions ||
    !loadedWorkflow ||
    !hostDimensionsMatch(dimensions, v4) ||
    loadedWorkflow.workflow !== v4.workflow ||
    !sameHostTurn(dimensions, host) ||
    !sameHostTurn(loadedWorkflow, host)
  )
    return undefined;
  return {
    workflow: v4.workflow,
    risk: v4.risk,
    workflowFile: loadedWorkflow.file,
    workflowSha256: loadedWorkflow.sha256,
    dimensionStage: dimensions.stage,
    verificationGate: v4.verificationGate,
  };
}

function hostGoalRouteApplication(
  preflight: GoalPreflight,
  raw: string,
): GoalRouteApplication | undefined {
  const host = hostGoalApplication(raw);
  if (
    !host ||
    !sameGoalRoute(preflight.selected, host.selected) ||
    !sameGoalRoute(preflight.effective, host.effective)
  )
    return undefined;
  const application: GoalRouteApplication = {
    profile: preflight.profile,
    selected: host.selected,
    effective: host.effective,
    appliedBy: preflight.appliedBy,
    launchBoundary: preflight.launchBoundary,
    childInvocationCount: 0,
    childInputTokens: 0,
    childOutputTokens: 0,
  };
  if (!preflight.v4) return application;
  const evidence = hostV4Evidence(preflight.v4, host, raw);
  return evidence ? { ...application, ...evidence } : undefined;
}

function nonemptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() === value && value
    ? value
    : undefined;
}

interface AcceptedGoalOwnerFields {
  selected: GoalRoute;
  effective: GoalRoute;
  profile: string;
  workflow: string;
  risk: NonNullable<GoalRouteApplication["risk"]>;
}

function acceptedGoalOwnerFields(
  event: Record<string, unknown>,
): AcceptedGoalOwnerFields | undefined {
  const selected = goalRouteOf(event.selected);
  const effective = goalRouteOf(event.effective);
  const profile = nonemptyString(event.profile);
  const workflow = nonemptyString(event.workflow);
  const risk = memberOf(RISK_LEVELS, event.risk);
  return selected && effective && profile && workflow && risk
    ? { selected, effective, profile, workflow, risk }
    : undefined;
}

function validAcceptedGoalOwnerBoundary(
  event: Record<string, unknown>,
  fields: AcceptedGoalOwnerFields,
): boolean {
  return [
    sameGoalRoute(fields.selected, fields.effective),
    fields.selected.harness === "codex",
    fields.selected.provider === "openai",
    event.applied_by === "native-subagent",
    event.launch_boundary === "native_subagent",
    event.child_invocations === 1,
    typeof event.agent_ref === "string" &&
      CODEX_AGENT_REF.test(event.agent_ref),
  ].every(Boolean);
}

/** Route evidence emitted by the Codex adapter only after its launch guard has
 *  accepted and bound one concrete adaptive-goal owner. */
function acceptedGoalOwnerRouteApplication(
  raw: string,
): GoalRouteApplication | undefined {
  return singleEventMatch(raw, (event) => {
    if (event.type !== "darrow.goal_owner_accepted") return undefined;
    const fields = acceptedGoalOwnerFields(event);
    if (!fields || !validAcceptedGoalOwnerBoundary(event, fields))
      return undefined;
    return {
      profile: fields.profile,
      workflow: fields.workflow,
      risk: fields.risk,
      selected: fields.selected,
      effective: fields.effective,
      appliedBy: "native-subagent",
      launchBoundary: "native_subagent",
      childInvocationCount: 1,
      childInputTokens: 0,
      childOutputTokens: 0,
    };
  });
}

function observedGoalOwnerRecord(raw: string): boolean {
  return Array.from(jsonlEvents(raw)).some(
    (event) => event.type === "darrow.goal_owner_accepted",
  );
}

export function observeCodexGoalRouteApplication(
  resultText: string,
  raw: string,
): GoalRouteApplication | undefined {
  const acceptedOwner = acceptedGoalOwnerRouteApplication(raw);
  if (acceptedOwner) return acceptedOwner;
  const preflight = parseGoalPreflight(resultText);
  if (!preflight) return undefined;
  if (preflight.launchBoundary === "nested_session")
    return nestedGoalRouteApplication(preflight, raw);
  if (preflight.launchBoundary === "host_api")
    return hostGoalRouteApplication(preflight, raw);
  return {
    profile: preflight.profile,
    selected: preflight.selected,
    effective: preflight.effective,
    appliedBy: preflight.appliedBy,
    launchBoundary: preflight.launchBoundary,
    childInvocationCount: preflight.declaredChildren,
    childInputTokens: 0,
    childOutputTokens: 0,
  };
}

/** The check produced when the goal stopped before launching anything. */
function observedGoalSpawn(raw: string): boolean {
  return jsonlEvents(raw).some((event) => {
    const item = recordOf(event.item);
    return (
      (item.type === "collab_tool_call" ||
        item.type === "collabAgentToolCall") &&
      (item.tool === "spawn_agent" || item.tool === "spawnAgent")
    );
  });
}

function goalLaunchRequiredCheck(
  resultText: string,
  raw: string,
): CheckResult | undefined {
  if (!LAUNCH_REQUIRED.test(resultText)) return undefined;
  const kind = launchRequiredStopKind(resultText, raw);
  return {
    name: "goal stopped without claiming an unapplied route",
    passed: kind !== undefined,
    detail: launchRequiredStopDetail(kind),
  };
}

function launchRequiredStopKind(
  resultText: string,
  raw: string,
): "unlaunched" | "rejected-child" | "unpersisted-child" | undefined {
  if (
    unappliedRouteReport(resultText, ZERO_CHILDREN) &&
    !observedGoalSpawn(raw)
  )
    return "unlaunched";
  if (
    unappliedRouteReport(resultText, ONE_CHILD) &&
    acceptedCodexLaunchFailure(raw)
  )
    return "rejected-child";
  if (
    unappliedRouteReport(resultText, ONE_CHILD) &&
    /Native goal persistence: unavailable\./.test(resultText) &&
    acceptedCodexGoalPersistenceFailure(raw)
  )
    return "unpersisted-child";
  return undefined;
}

function unappliedRouteReport(resultText: string, childCount: RegExp): boolean {
  return (
    UNAPPLIED_ROUTE_MARKERS.every((marker) => marker.test(resultText)) &&
    childCount.test(resultText)
  );
}

function launchRequiredStopDetail(
  kind: ReturnType<typeof launchRequiredStopKind>,
): string {
  if (kind === "unlaunched") return "launch_required with no effective route";
  if (kind === "rejected-child")
    return "launch_required after one interrupted accepted Codex child";
  if (kind === "unpersisted-child")
    return "launch_required after unavailable child-thread goal persistence";
  return "launch_required must report an unapplied route and exact child lifecycle";
}

function acceptedCodexGoalPersistenceFailure(raw: string): boolean {
  const events = Array.from(jsonlEvents(raw));
  const spawnRefs = events
    .map(spawnedChildThreadId)
    .filter((value): value is string => value !== undefined);
  const agentRef = spawnRefs.length === 1 ? spawnRefs[0] : undefined;
  if (!agentRef || !CODEX_AGENT_REF.test(agentRef)) return false;
  const attestation = nativeGoalAgentAttestation(raw);
  const stages = goalPersistenceFailureStages(
    events,
    agentRef,
    attestation?.objectiveMode === "file-backed",
  );
  return [
    !!attestation,
    stages.every((stage) => stage >= 0),
    stages.every((stage, index) => index === 0 || stages[index - 1]! < stage),
  ].every(Boolean);
}

function goalPersistenceFailureStages(
  events: Record<string, unknown>[],
  agentRef: string,
  releaseRequired: boolean,
): number[] {
  const stages = [
    singleMatchingEvent(
      events,
      (event) => spawnedChildThreadId(event) === agentRef,
    ),
    singleMatchingEvent(events, (event) =>
      retainedEventMatches(event, "darrow.goal_activation", agentRef),
    ),
    singleMatchingEvent(events, (event) =>
      completedOwnerActivationSignal(event, agentRef),
    ),
    singleMatchingEvent(events, (event) =>
      retainedEventMatches(
        event,
        "darrow.goal_persistence",
        agentRef,
        "unavailable",
      ),
    ),
    singleMatchingEvent(
      events,
      (event) =>
        completedCollabThreadId(event, ["wait", "wait_agent"]) === agentRef,
    ),
  ];
  if (releaseRequired)
    stages.push(
      singleMatchingEvent(events, (event) =>
        retainedEventMatches(event, "darrow.objective_release"),
      ),
    );
  stages.push(
    singleMatchingEvent(events, (event) =>
      retainedEventMatches(
        event,
        "darrow.goal_report",
        undefined,
        "launch-required",
      ),
    ),
  );
  return stages;
}

function completedOwnerActivationSignal(
  event: Record<string, unknown>,
  agentRef: string,
): boolean {
  const item = recordOf(event.item);
  return (
    completedCollabThreadId(event, ["send_message"]) === agentRef &&
    item?.prompt === "- phase: goal-owner-activated"
  );
}

function acceptedCodexLaunchFailure(raw: string): boolean {
  const events = Array.from(jsonlEvents(raw));
  const spawnRefs = events
    .map(spawnedChildThreadId)
    .filter((value): value is string => value !== undefined);
  const agentRef = spawnRefs.length === 1 ? spawnRefs[0] : undefined;
  if (!agentRef || !CODEX_AGENT_REF.test(agentRef)) return false;
  const attestation = nativeGoalAgentAttestation(raw);
  const stages = acceptedLaunchFailureStages(
    events,
    agentRef,
    attestation?.objectiveMode === "file-backed",
  );
  return [
    !!attestation,
    !observedRunnerWait(events),
    stages.every((stage) => stage >= 0),
    stages.every((stage, index) => index === 0 || stages[index - 1]! < stage),
  ].every(Boolean);
}

function acceptedLaunchFailureStages(
  events: Record<string, unknown>[],
  agentRef: string,
  releaseRequired: boolean,
): number[] {
  const stages = [
    singleMatchingEvent(
      events,
      (event) => spawnedChildThreadId(event) === agentRef,
    ),
    singleMatchingEvent(events, (event) =>
      retainedEventMatches(event, "darrow.goal_activation_rejected", agentRef),
    ),
    singleMatchingEvent(
      events,
      (event) =>
        completedCollabThreadId(event, ["interrupt_agent"]) === agentRef,
    ),
    singleMatchingEvent(events, (event) => acceptedLaunchStop(event, agentRef)),
  ];
  if (releaseRequired)
    stages.push(
      singleMatchingEvent(events, (event) =>
        retainedEventMatches(event, "darrow.objective_release"),
      ),
    );
  stages.push(
    singleMatchingEvent(
      events,
      (event) => closedChildThreadId(event) === agentRef,
    ),
    singleMatchingEvent(events, (event) =>
      retainedEventMatches(
        event,
        "darrow.goal_report",
        undefined,
        "launch-required",
      ),
    ),
  );
  return stages;
}

function singleMatchingEvent(
  events: Record<string, unknown>[],
  matches: (event: Record<string, unknown>) => boolean,
): number {
  const indices = events.flatMap((event, index) =>
    matches(event) ? [index] : [],
  );
  return indices.length === 1 ? indices[0]! : -1;
}

function retainedEventMatches(
  event: Record<string, unknown>,
  type: string,
  agentRef?: string,
  status?: string,
): boolean {
  return [
    event.type === type,
    agentRef === undefined || event.agent_ref === agentRef,
    status === undefined || event.status === status,
  ].every(Boolean);
}

function acceptedLaunchStop(
  event: Record<string, unknown>,
  agentRef: string,
): boolean {
  return [
    retainedEventMatches(event, "darrow.goal_launch_stop", agentRef),
    event.child_invocations === 1,
  ].every(Boolean);
}

function observedRunnerWait(events: Record<string, unknown>[]): boolean {
  return events.some((event) =>
    Boolean(
      completedCollabThreadId(event, ["wait", "wait_agent", "send_message"]),
    ),
  );
}

function hostWorkflowVerified(
  isV4: boolean,
  observed: GoalRouteApplication | undefined,
): boolean {
  if (!isV4 || observed?.launchBoundary !== "host_api") return true;
  return (
    observed.workflow !== undefined &&
    observed.risk !== undefined &&
    observed.workflowFile !== undefined &&
    observed.workflowSha256 !== undefined &&
    observed.dimensionStage !== undefined &&
    observed.verificationGate === observed.risk
  );
}

function effectiveRouteMatchesHost(
  observed: GoalRouteApplication | undefined,
  host: HostRoute,
): boolean {
  return (
    observed?.effective.harness === host.harness &&
    observed?.effective.model === host.model &&
    observed?.effective.effort === host.effort
  );
}

function goalBoundaryMatches(
  observed: GoalRouteApplication,
  declaredChildren: number,
  effectiveMatchesCurrentTurn: boolean,
  raw: string,
): boolean {
  const expected = GOAL_BOUNDARY_EXPECTATIONS[observed.launchBoundary];
  return (
    expected !== undefined &&
    observed.appliedBy === expected.appliedBy &&
    declaredChildren === expected.children &&
    (expected.children !== 0 || !observedGoalSpawn(raw)) &&
    (expected.sameTurn === undefined ||
      expected.sameTurn === effectiveMatchesCurrentTurn)
  );
}

function goalRouteApplicationVerified(
  resultText: string,
  raw: string,
  observed: GoalRouteApplication | undefined,
  hostRoute: HostRoute,
): boolean {
  if (!observed) return false;
  const acceptedOwner = acceptedGoalOwnerRouteApplication(raw);
  const acceptedOwnerMatches =
    acceptedOwner !== undefined &&
    sameGoalRoute(acceptedOwner.selected, observed.selected) &&
    sameGoalRoute(acceptedOwner.effective, observed.effective);
  const checks = [
    acceptedOwnerMatches || ROUTE_VERIFIED.test(resultText),
    hostWorkflowVerified(
      GOAL_PREFLIGHT_V4.test(resultText) || GOAL_REPORT_V1.test(resultText),
      observed,
    ),
    observed.launchBoundary !== "native_subagent" ||
      nativeGoalRouteMatches(raw, observed.effective),
    sameGoalRoute(observed.selected, observed.effective),
    goalBoundaryMatches(
      observed,
      observed.childInvocationCount,
      effectiveRouteMatchesHost(observed, hostRoute),
      raw,
    ),
  ];
  return checks.every(Boolean);
}

export function reconcileObservedGoalRouteApplication(
  resultText: string,
  raw: string,
  hostRoute: HostRoute,
): CheckResult | undefined {
  const hasWorkflowReport =
    GOAL_PREFLIGHT_V4.test(resultText) || GOAL_REPORT_V1.test(resultText);
  if (
    !hasWorkflowReport &&
    !GOAL_PREFLIGHT_V2.test(resultText) &&
    !observedGoalOwnerRecord(raw)
  )
    return undefined;
  const launchRequired = goalLaunchRequiredCheck(resultText, raw);
  if (launchRequired) return launchRequired;
  const observed = observeCodexGoalRouteApplication(resultText, raw);
  const passed = goalRouteApplicationVerified(
    resultText,
    raw,
    observed,
    hostRoute,
  );
  return {
    name: "goal route report matches the observable application boundary",
    passed,
    detail: passed
      ? `${observed!.effective.model}/${observed!.effective.effort} via ${observed!.appliedBy}${
          observed!.launchBoundary === "native_subagent"
            ? `; route-telemetry=boundary-only; cleanup=${nativeGoalAgentsClosed(raw) ? "closed" : "not-closed"}`
            : ""
        }`
      : "selected/effective route or application boundary was not observed",
  };
}

/** Thread id of a completed collaboration call targeting exactly one child. */
function completedCollabThreadId(
  event: Record<string, unknown>,
  tools: readonly string[],
): string | undefined {
  const item = completedCollaborationItem(event, tools);
  if (!item) return undefined;
  if (item.agent_ref !== undefined)
    return typeof item.agent_ref === "string" &&
      CODEX_AGENT_REF.test(item.agent_ref)
      ? item.agent_ref
      : undefined;
  const threadIds = item.receiver_thread_ids ?? item.receiverThreadIds;
  if (!Array.isArray(threadIds) || threadIds.length !== 1) return undefined;
  return String(threadIds[0]);
}

function completedCollaborationItem(
  event: Record<string, unknown>,
  tools: readonly string[],
): Record<string, unknown> | undefined {
  const item = recordOf(event.item);
  const completed = [
    event.type === "item.completed",
    item.type === "collab_tool_call" || item.type === "collabAgentToolCall",
    typeof item.tool === "string" && tools.includes(item.tool),
    item.status === "completed",
  ].every(Boolean);
  return completed ? item : undefined;
}

/** Thread id of a completed `spawn_agent` call that spawned exactly one child. */
function spawnedChildThreadId(
  event: Record<string, unknown>,
): string | undefined {
  return completedCollabThreadId(event, ["spawn_agent", "spawnAgent"]);
}

/** Thread id of a completed Codex close call targeting exactly one child. */
function closedChildThreadId(
  event: Record<string, unknown>,
): string | undefined {
  return completedCollabThreadId(event, ["close_agent", "closeAgent"]);
}

/** One ownership-marked accepted start/completion pair is the application
 * evidence Codex CLI exposes. Its stream currently redacts model, effort, and
 * fork arguments. */
function nativeGoalSpawnStarted(
  event: Record<string, unknown>,
  item: Record<string, unknown>,
): boolean {
  return (
    event.type === "item.started" &&
    (item.type === "collab_tool_call" || item.type === "collabAgentToolCall") &&
    (item.tool === "spawn_agent" || item.tool === "spawnAgent") &&
    item.status === "in_progress"
  );
}

function collaborationSenderThreadId(
  item: Record<string, unknown>,
): string | undefined {
  const sender = item.sender_thread_id ?? item.senderThreadId;
  return typeof sender === "string" && sender ? sender : undefined;
}

function nativeGoalSpawnKind(
  prompt: unknown,
  ownerStarted: boolean,
): "owner" | "descendant" | undefined {
  if (typeof prompt !== "string") return undefined;
  if (NATIVE_GOAL_OWNER_PROMPT.test(prompt)) return "owner";
  return ownerStarted ? "descendant" : undefined;
}

interface NativeGoalSpawnState {
  ownerStarted: boolean;
  ownerCompleted: boolean;
  goalThreads: Set<string>;
  ownerAttestation?: NativeGoalSpawnAttestation;
  objectiveReleased: boolean;
  pending?: {
    kind: "owner" | "descendant";
    sender: string;
    attestation?: NativeGoalSpawnAttestation;
  };
}

interface NativeGoalSpawnAttestation {
  model: string;
  effort: string;
  forkTurns: "none";
  requestSha256: string;
  objectiveSha256: string;
  contractSha256: string;
  baselineSha256: string;
  fixtureStateSha256: string;
  objectiveMode: "inline" | "file-backed";
}

function nativeGoalSpawnAttestation(
  item: Record<string, unknown>,
): NativeGoalSpawnAttestation | undefined {
  const proof = recordOf(item.goal_spawn_attestation);
  const valid = [
    typeof proof.model === "string",
    typeof proof.effort === "string",
    proof.forkTurns === "none",
    SHA256.test(stringOr(proof.requestSha256, "")),
    SHA256.test(stringOr(proof.objectiveSha256, "")),
    SHA256.test(stringOr(proof.contractSha256, "")),
    SHA256.test(stringOr(proof.baselineSha256, "")),
    SHA256.test(stringOr(proof.fixtureStateSha256, "")),
    proof.objectiveMode === "inline" || proof.objectiveMode === "file-backed",
  ].every(Boolean);
  return valid ? (proof as unknown as NativeGoalSpawnAttestation) : undefined;
}

function sameNativeGoalSpawnAttestation(
  left: NativeGoalSpawnAttestation | undefined,
  right: NativeGoalSpawnAttestation | undefined,
): boolean {
  return !!left && !!right && JSON.stringify(left) === JSON.stringify(right);
}

function permittedNativeGoalSpawnStart(
  state: NativeGoalSpawnState,
  kind: "owner" | "descendant" | undefined,
  sender: string | undefined,
  attestation: NativeGoalSpawnAttestation | undefined,
): boolean {
  return [
    !state.pending,
    !!kind,
    !!sender,
    kind !== "owner" || (!state.ownerStarted && !!attestation),
    kind !== "descendant" ||
      (state.ownerCompleted && !!sender && state.goalThreads.has(sender)),
  ].every(Boolean);
}

function startNativeGoalSpawn(
  state: NativeGoalSpawnState,
  item: Record<string, unknown>,
): boolean {
  const kind = nativeGoalSpawnKind(item.prompt, state.ownerStarted);
  const sender = collaborationSenderThreadId(item);
  const attestation = nativeGoalSpawnAttestation(item);
  if (!permittedNativeGoalSpawnStart(state, kind, sender, attestation))
    return false;
  if (kind === "owner") state.ownerStarted = true;
  state.pending = { kind: kind!, sender: sender!, attestation };
  return true;
}

function completeNativeGoalSpawn(
  state: NativeGoalSpawnState,
  event: Record<string, unknown>,
): boolean {
  const child = spawnedChildThreadId(event);
  const item = recordOf(event.item);
  const sender = collaborationSenderThreadId(item);
  const attestation = nativeGoalSpawnAttestation(item);
  if (!state.pending || !child || sender !== state.pending.sender) return false;
  if (
    state.pending.kind === "owner" &&
    !sameNativeGoalSpawnAttestation(state.pending.attestation, attestation)
  )
    return false;
  if (state.pending.kind === "owner") {
    state.ownerCompleted = true;
    state.ownerAttestation = attestation;
  }
  state.goalThreads.add(child);
  state.pending = undefined;
  return true;
}

function nativeGoalAgentAttestation(
  raw: string,
): NativeGoalSpawnAttestation | undefined {
  const state: NativeGoalSpawnState = {
    ownerStarted: false,
    ownerCompleted: false,
    objectiveReleased: false,
    goalThreads: new Set<string>(),
  };
  for (const event of jsonlEvents(raw)) {
    if (!acceptNativeGoalEvent(state, event)) return undefined;
  }
  return completedNativeGoalAttestation(state);
}

function acceptNativeGoalEvent(
  state: NativeGoalSpawnState,
  event: Record<string, unknown>,
): boolean {
  if (
    event.type === "darrow.parent_tool_before_goal" ||
    event.type === "darrow.parent_tool_after_goal"
  )
    return false;
  if (event.type === "darrow.objective_release") {
    state.objectiveReleased =
      event.status === "completed" &&
      event.contract_sha256 === state.ownerAttestation?.contractSha256;
    return state.objectiveReleased;
  }
  const item = recordOf(event.item);
  if (nativeGoalSpawnStarted(event, item))
    return startNativeGoalSpawn(state, item);
  return !spawnedChildThreadId(event) || completeNativeGoalSpawn(state, event);
}

function completedNativeGoalAttestation(
  state: NativeGoalSpawnState,
): NativeGoalSpawnAttestation | undefined {
  const proof = state.ownerAttestation;
  const completed =
    state.ownerStarted && state.ownerCompleted && !state.pending;
  const cleaned =
    proof?.objectiveMode !== "file-backed" || state.objectiveReleased;
  return completed && cleaned ? proof : undefined;
}

function nativeGoalRouteMatches(raw: string, route: GoalRoute): boolean {
  const acceptedOwner = acceptedGoalOwnerRouteApplication(raw);
  if (acceptedOwner) return sameGoalRoute(acceptedOwner.effective, route);
  const proof = nativeGoalAgentAttestation(raw);
  return (
    route.harness === "codex" &&
    route.provider === "openai" &&
    proof?.model === route.model &&
    proof.effort === route.effort
  );
}

/** Every observed native child must be closed once, after its matching spawn. */
function nativeGoalAgentsClosed(raw: string): boolean {
  const spawned = new Set<string>();
  const open = new Set<string>();
  for (const event of jsonlEvents(raw)) {
    const spawnedId = spawnedChildThreadId(event);
    if (spawnedId) {
      if (spawned.has(spawnedId)) return false;
      spawned.add(spawnedId);
      open.add(spawnedId);
    }
    const closedId = closedChildThreadId(event);
    if (closedId && !open.delete(closedId)) return false;
  }
  return spawned.size > 0 && open.size === 0;
}

function ticketPipelineRoute(
  event: Record<string, unknown>,
): ObservedTicketPipelineRoute | undefined {
  const threadId = spawnedChildThreadId(event);
  const prompt = stringOr(recordOf(event.item).prompt, "");
  const phase = matchField(prompt, /^- phase: ([a-z]+)$/m);
  const iteration = matchField(prompt, /^- iteration: ([0-9]+)$/m);
  const childId = matchField(prompt, /^- stable_child_id: (.+)$/m);
  const skill = matchField(
    prompt,
    /^- (?:required skill|phase_skill): \$(?:darrow-ticket-pipeline:)?([a-z0-9-]+)$/m,
  );
  if (!threadId || !phase || !iteration || !childId || !skill) return undefined;
  return { phase, iteration: Number(iteration), childId, skill, threadId };
}

export function observeCodexTicketPipelineRoutes(
  raw: string,
): ObservedTicketPipelineRoute[] | undefined {
  const routes: ObservedTicketPipelineRoute[] = [];
  let sawCodexEvent = false;
  for (const event of jsonlEvents(raw)) {
    if (typeof event.type === "string" && CODEX_STREAM_EVENT.test(event.type))
      sawCodexEvent = true;
    const route = ticketPipelineRoute(event);
    if (route) routes.push(route);
  }
  return sawCodexEvent ? routes : undefined;
}

/** Observed children and declared routes must be the same set of unique
 *  phase attempts, each running the skill its phase requires. */
function ticketPipelineIdentitiesMatch(
  observed: ObservedTicketPipelineRoute[],
  observedRoutes: string[],
  declaredRoutes: string[],
): boolean {
  const observedAttempts = observed.map(
    (route) => `${route.phase}:${route.iteration}`,
  );
  const declaredAttempts = declaredRoutes.map((route) =>
    route.split(":").slice(0, 2).join(":"),
  );
  return (
    allUnique(observedRoutes) &&
    allUnique(declaredRoutes) &&
    allUnique(observedAttempts) &&
    allUnique(declaredAttempts) &&
    allUnique(observed.map((route) => route.threadId)) &&
    observed.every(
      (route) => EXPECTED_PHASE_SKILLS[route.phase] === route.skill,
    ) &&
    declaredRoutes.length === observedRoutes.length &&
    declaredRoutes.every((route) => observedRoutes.includes(route)) &&
    observedRoutes.every((route) => declaredRoutes.includes(route))
  );
}

export function reconcileObservedTicketPipelineRoutes(
  resultText: string,
  raw: string,
): CheckResult | undefined {
  if (!TICKET_PIPELINE_FORMAT.test(resultText)) return undefined;
  const observed = observeCodexTicketPipelineRoutes(raw);
  if (!observed) return undefined;
  const declaredRoutes = [
    ...resultText.matchAll(
      /^route\t([a-z]+)\t([0-9]+)\t[^\t\n]+\t[^\t\n]+\t[^\t\n]+\t([^\t\n]+)$/gm,
    ),
  ].map((match) => `${match[1]}:${match[2]}:${match[3]}`);
  const observedRoutes = observed.map(
    (route) => `${route.phase}:${route.iteration}:${route.childId}`,
  );
  const declaredCount = declaredChildCount(resultText);
  const passed =
    ticketPipelineIdentitiesMatch(observed, observedRoutes, declaredRoutes) &&
    declaredCount === observed.length;
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
  if (
    /^(?:launch_boundary\tnested_session|launch_boundary: nested_session)$/m.test(
      resultText,
    )
  )
    return true;
  for (const match of resultText.matchAll(
    /^route\t(?:(?:planner|executor|verifier|repair)\t([^\t\n]+)|(?:refine|challenge|implement|review|rework|qa|codify)\t[0-9]+\t([^\t\n]+))\t/gm,
  )) {
    if ((match[1] ?? match[2]) !== hostHarness) return true;
  }
  return false;
}

function humanInterruptionCount(
  resultText: string,
  declaredInterruptions: string | undefined,
): number {
  if (declaredInterruptions) return Number(declaredInterruptions);
  return /^status\tneeds_human$/m.test(resultText) ? 1 : 0;
}

function failedMetricCount(
  checks: CheckResult[],
  metric: CheckResult["metric"],
): number {
  return checks.filter((check) => check.metric === metric && !check.passed)
    .length;
}

export function extractOrchestrationMetrics(
  resultText: string,
  checks: CheckResult[],
  observedChildInvocationCount?: number,
): OrchestrationMetrics | undefined {
  const routeRecords = resultText.match(
    /^route\t(?:planner|executor|verifier|repair)\t/gm,
  );
  const hasGoalLoopResult = GOAL_LOOP_RESULT.test(resultText);
  const declaredChildren = matchField(resultText, DECLARED_CHILDREN);
  const declaredInterruptions = matchField(
    resultText,
    /^(?:evaluation_human_interruptions\t|evaluation_human_interruptions: )([0-9]+)$/m,
  );
  if (!hasGoalLoopResult && !routeRecords && !declaredChildren)
    return undefined;
  return {
    childInvocationCount:
      observedChildInvocationCount ??
      routeRecords?.length ??
      Number(declaredChildren ?? 0),
    humanInterruptions: humanInterruptionCount(
      resultText,
      declaredInterruptions,
    ),
    escapedDefects: failedMetricCount(checks, "escaped_defect"),
    falsePositiveVerifierFindings: failedMetricCount(checks, "false_positive"),
  };
}
