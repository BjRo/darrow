import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import type { GoalRoute, HarnessAdapter, HarnessResult } from "../types";
import { isolatedHarnessEnvironment } from "../environment";
import { sandboxedAgentCommand } from "../sandbox";
import { goalContractRecordIssues } from "../codex-spawn-guard";
import {
  GOAL_REPORT_KEYS,
  parseImplementationReadinessResult,
} from "../goal-report";

interface CatalogRoute {
  model: string;
  efforts: string[];
}

const INLINE_GOAL_OBJECTIVE_BYTES = 4000;

type GoalWorkflow =
  | "fix-bug"
  | "implement-feature"
  | "change-feature"
  | "refactor"
  | "migration"
  | "mechanical"
  | "decision-gated";
type GoalRisk = "routine" | "elevated" | "high";
export type GoalDimensionStage = "workflow" | "workflow-risk";

interface GoalHandoff {
  format: "darrow-native-goal-handoff-v4";
  workflow: GoalWorkflow;
  risk: GoalRisk;
  profile: string;
  routeSource: "policy" | "user" | "none";
  readinessGate: {
    selection: "selected" | "omitted";
    reason: string;
  };
  independentReview: {
    selection: "selected" | "omitted";
    reason: string;
    roundLimit?: number;
  };
  selectedRoute: GoalRoute;
  goalContract: string;
}

interface ExplicitGoalControls {
  route?: GoalRoute;
  reviewRoundLimit?: number;
  ledger?: string;
  goalLoop?: string;
}

interface WorkflowEntry {
  file: string;
}
export interface PreparedGoalDimensions {
  routes: Map<string, GoalRoute>;
  policySources: Map<string, "bundled" | "repository">;
  workflows: Map<string, WorkflowEntry>;
}

function parseRouteRow(fields: string[], rawLine: string): GoalRoute {
  if (
    fields.length !== 6 ||
    !fields[2] ||
    !fields[3] ||
    !fields[4] ||
    !fields[5]
  )
    throw new Error(`invalid route row: ${rawLine}`);
  return {
    harness: fields[2],
    provider: fields[3],
    model: fields[4],
    effort: fields[5],
  };
}

function parseRoutePolicySourceRow(
  fields: string[],
  rawLine: string,
): "bundled" | "repository" {
  const source = fields[2];
  if (fields.length !== 3 || !["bundled", "repository"].includes(source ?? ""))
    throw new Error(`invalid route policy source: ${rawLine}`);
  return source as "bundled" | "repository";
}

function parseWorkflowRow(
  fields: string[],
  id: string,
  rawLine: string,
): WorkflowEntry {
  const file = fields[2];
  if (
    fields.length !== 3 ||
    !file ||
    !isAbsolute(file) ||
    !file.endsWith(`/references/workflows/${id}.md`)
  )
    throw new Error(`invalid workflow row: ${rawLine}`);
  return { file };
}

function setUniqueDimension<T>(
  entries: Map<string, T>,
  id: string,
  value: T,
  label: string,
): void {
  if (entries.has(id)) throw new Error(`duplicate ${label}: ${id}`);
  entries.set(id, value);
}

function assertCompleteGoalDimensions(
  dimensions: PreparedGoalDimensions,
): void {
  if (!dimensions.routes.size || !dimensions.workflows.size)
    throw new Error("prepared goal dimensions are incomplete");
  for (const profile of dimensions.routes.keys())
    if (!dimensions.policySources.has(profile))
      throw new Error(`missing route policy source: ${profile}`);
}

export function parsePreparedGoalDimensions(
  text: string,
): PreparedGoalDimensions {
  const dimensions: PreparedGoalDimensions = {
    routes: new Map(),
    policySources: new Map(),
    workflows: new Map(),
  };
  for (const rawLine of text.split("\n")) {
    const fields = rawLine.split("\t");
    const [kind, id] = fields;
    if (!id || !/^[a-z0-9-]+$/.test(id)) continue;
    if (kind === "route")
      setUniqueDimension(
        dimensions.routes,
        id,
        parseRouteRow(fields, rawLine),
        "route",
      );
    else if (kind === "route_policy_source")
      setUniqueDimension(
        dimensions.policySources,
        id,
        parseRoutePolicySourceRow(fields, rawLine),
        "route policy source",
      );
    else if (kind === "workflow")
      setUniqueDimension(
        dimensions.workflows,
        id,
        parseWorkflowRow(fields, id, rawLine),
        "workflow",
      );
  }
  assertCompleteGoalDimensions(dimensions);
  return dimensions;
}

export function parseExplicitUserRoute(text: string): GoalRoute | undefined {
  const records = text.match(/^user_route\t[^\n]*$/gm) ?? [];
  if (!records.length) return undefined;
  if (records.length !== 1) throw new Error("multiple explicit user routes");
  const fields = records[0].split("\t");
  if (
    fields.length !== 5 ||
    !fields
      .slice(1)
      .every((field) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(field))
  )
    throw new Error("invalid explicit user route");
  return {
    harness: fields[1]!,
    provider: fields[2]!,
    model: fields[3]!,
    effort: fields[4]!,
  };
}

const reviewLimitWords = new Map<string, number>([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);

function parseReviewLimitValue(value: string): number {
  const limit = /^\d+$/.test(value)
    ? Number(value)
    : reviewLimitWords.get(value.toLowerCase());
  if (!Number.isSafeInteger(limit) || limit! < 1)
    throw new Error("explicit review-round limit must be at least one");
  return limit!;
}

export function parseExplicitReviewRoundLimit(
  text: string,
): number | undefined {
  const token = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)";
  const affirmativeBoundary = "(?:^|[.!?;\\n]\\s*|,\\s*(?:but|and)\\s+)";
  const action =
    "(?:(?:i|we)\\s+)?(?:explicitly\\s+)?(?:set|choose|authorize|request)";
  const limitName =
    "(?:independent[- ]review|review(?:[- ]round)?)\\s+(?:budget|limit)";
  const patterns = [
    new RegExp(
      `${affirmativeBoundary}${action}\\s+(?:(?:the|an?)\\s+)?${limitName}\\s*(?:(?:to|of|=|:)\\s*)?${token}(?:\\s+review\\s+rounds?)?\\b`,
      "gi",
    ),
    new RegExp(
      `${affirmativeBoundary}${action}\\s+(?:at\\s+most\\s+|up\\s+to\\s+|exactly\\s+)?${token}\\s+(?:independent[- ]review|review)\\s+rounds?\\b`,
      "gi",
    ),
    new RegExp(`^review_round_(?:budget|limit)\\t${token}$`, "gim"),
  ];
  const limits = new Set<number>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (isQuotedOrDisavowedBudgetMention(text, match.index, match[0].length))
        continue;
      limits.add(parseReviewLimitValue(match[1]!));
    }
  }
  if (!limits.size) return undefined;
  if (limits.size !== 1)
    throw new Error("conflicting explicit review-round limits");
  return [...limits][0];
}

function isQuotedOrDisavowedBudgetMention(
  text: string,
  index: number,
  length: number,
): boolean {
  const clauseStart = Math.max(
    text.lastIndexOf(".", index - 1),
    text.lastIndexOf("!", index - 1),
    text.lastIndexOf("?", index - 1),
    text.lastIndexOf("\n", index - 1),
  );
  if (isInsideBudgetQuote(text, index, clauseStart)) return true;
  const suffix = text.slice(index + length, index + length + 100);
  return /^\s*(?:is|are|was|were)\s+(?:not\s+(?:authorized|allowed|approved|requested|intended)|only\s+(?:an?\s+)?(?:example|quotation|quote|mention))\b/i.test(
    suffix,
  );
}

function isInsideBudgetQuote(
  text: string,
  index: number,
  clauseStart: number,
): boolean {
  const precedingText = text.slice(0, index);
  const straightQuotes = (precedingText.match(/"/g) ?? []).length;
  const openSmartQuotes = (precedingText.match(/“/g) ?? []).length;
  const closeSmartQuotes = (precedingText.match(/”/g) ?? []).length;
  return (
    straightQuotes % 2 === 1 ||
    openSmartQuotes > closeSmartQuotes ||
    isInsideApostropheQuote({
      text,
      index,
      clauseStart,
      open: "'",
      close: "'",
    }) ||
    isInsideApostropheQuote({ text, index, clauseStart, open: "‘", close: "’" })
  );
}

function isInsideApostropheQuote(options: {
  text: string;
  index: number;
  clauseStart: number;
  open: string;
  close: string;
}): boolean {
  const { text, index, clauseStart, open, close } = options;
  const quote = text.lastIndexOf(open, index - 1);
  return (
    quote > clauseStart &&
    !text.slice(quote + 1, index).trim() &&
    text.indexOf(close, index) >= index
  );
}

export function extractIntentRoutingGuidance(skill: string): string {
  const startMarker = "<!-- intent-routing-begin -->";
  const endMarker = "<!-- intent-routing-end -->";
  const start = skill.indexOf(startMarker);
  const end = skill.indexOf(endMarker);
  if (
    start < 0 ||
    end < 0 ||
    end <= start ||
    skill.indexOf(startMarker, start + startMarker.length) >= 0 ||
    skill.indexOf(endMarker, end + endMarker.length) >= 0
  )
    throw new Error("parent skill has invalid intent-routing guidance markers");
  const guidance = skill.slice(start + startMarker.length, end).trim();
  if (!guidance)
    throw new Error("parent skill has empty intent-routing guidance");
  return guidance;
}

export function buildPreparedGoalPrompt(
  engineeringRequest: string,
  preparedEvidence: string,
  intentRoutingGuidance: string,
  stage: GoalDimensionStage = "workflow-risk",
): string {
  const stageInstruction =
    stage === "workflow"
      ? "Select the workflow. For this workflow-only ablation, set risk to routine."
      : "Select the workflow and proportional risk.";
  return [
    "Compile the engineering request below into one native-goal handoff.",
    "The enclosing host already assembled authoritative repository state, instruction routes, policy routes, workflow playbooks, and risk gates.",
    "Do not call repository or shell tools. Return one structured response only; the host owns workflow loading and native-goal activation.",
    "",
    stageInstruction,
    "Workflow controls execution sequence. Risk controls proportional verification.",
    "Use this canonical parent-skill guidance for workflow and risk selection:",
    intentRoutingGuidance,
    "A `user_route` record in the engineering request is an explicit user pin in harness/provider/model/effort order; when present, select it with routeSource user. No other request text is evaluator control metadata.",
    "Select risk and profile independently: risk reflects the cost of an incorrect result, while routing reflects the kind and scale of reasoning required. Risk alone and a workflow label alone do not determine profile.",
    "Map ordinary-localized to routine, scaled-coding to scaled, repo-wide-coding to repo-wide, and judgment to judgment. Use routine-plus only when the request specifically makes its additional quality worthwhile. Resolve the concrete model and effort from the prepared route rows.",
    "Compile feedback checks and final-tree checks from the canonical guidance and prepared repository evidence. Preserve their commands and ordering in the goal contract.",
    "Return independentReview.roundLimit as the exact positive integer only when the engineering request explicitly supplies a review-round limit. Return null for progress-bounded review without a user limit and whenever review is omitted. Never infer a numeric limit on the user's behalf.",
    "Select readinessGate before implementation. Select it for an authoritative ticket, specification, plan, or accepted conversational plan whose exact current scope has not already completed an implementation-readiness assessment, and whenever the user, repository, or delegating orchestration explicitly requires readiness. A completed same-scope semantic discussion that resolved the findings counts as already assessed even without a separately rendered gate result. Re-select after a material scope, acceptance, or constraint change only when reassessment adds actual value. Omit it for a bounded request fully stated in the preserved conversation, for an already-assessed unchanged scope, and when the user explicitly skips the default gate. A user skip does not override a repository or delegating-orchestration requirement. Mere capability installation never selects the gate. Return a concise reason for either selection.",
    "When the engineering request names an authoritative artifact that this one-response classifier has not opened, do not treat the artifact contents being absent from prepared evidence as a known missing decision or authority. Select the task-level workflow from the stated implementation intent and let a selected implementation-readiness capability assess that artifact's completeness before mutation. Use decision-gated only for a missing choice or authority actually established by the preserved request or prepared evidence.",
    "When workflow is decision-gated, return the fixed terminal tuple: risk high, profile none, routeSource none, readinessGate omitted, independentReview omitted with roundLimit null, and selectedRoute {harness: none, provider: none, model: none, effort: none}. Put the missing decision or authority in goalContract. This terminal handoff is reported without native-goal activation.",
    "",
    "Keep goalContract concise and target 4,000 bytes, but preserve the outcome, acceptance criteria, scope, repository instructions, local work, publication boundary, selected workflow, risk gate, profile, route, feedback checks, and final-tree checks completely. Include the exact prepared ledger once as `Protocol ledger: <absolute-ledger>`. The enclosing host will materialize a file-backed native objective if the complete contract exceeds the inline limit; do not truncate or omit requirements to fit it.",
    "Return readinessGate and independentReview as parallel structured decisions with selection selected or omitted and a concise non-empty reason. Return only the optional independentReview.roundLimit described above. High risk must select independent review except for the fixed decision-gated terminal tuple. Do not write Readiness gate or Independent review lines in goalContract; the host compiles both canonical portable clauses from these structured decisions.",
    "Do not copy a tab-separated launch record into goalContract; the prepared ledger owns route, launch, digest, review, and reporting evidence.",
    "",
    "Return only a darrow-native-goal-handoff-v4 object with workflow, risk, profile, routeSource, readinessGate, independentReview, selectedRoute, and goalContract.",
    "",
    "Prepared evidence:",
    preparedEvidence,
    "",
    "Engineering request:",
    engineeringRequest,
  ].join("\n");
}

export function buildGoalExecutionPrompt(
  handoff: GoalHandoff,
  workflowContent: string,
  intentRoutingGuidance: string,
): string {
  const selected = handoff.selectedRoute;
  return [
    "The enclosing app-server launcher set the compiled contract as this thread's active native goal.",
    "Do not call create_goal; this same thread already has the active goal.",
    `It is applying the selected route ${selected.harness}|${selected.provider}|${selected.model}|${selected.effort} to this turn.`,
    `Follow the selected ${handoff.workflow} workflow playbook:`,
    workflowContent.trim(),
    "Use this canonical workflow, risk, and verification guidance:",
    intentRoutingGuidance,
    `Apply the selected ${handoff.risk} verification gate defined in the canonical guidance above.`,
    handoff.readinessGate.selection === "selected"
      ? "Before repository or external mutation, invoke the environment capability matching implementation-readiness assessment of the authoritative request. Preserve its complete human-readable result. Record its semantic verdict with the exact `goal-loop step readiness --ledger <Protocol ledger> --verdict <ready|needs-discovery|needs-decision|blocked>` transition. Continue implementation only on `ready`. For any other verdict, perform no mutation, settle the native goal as blocked, and return the complete readiness result followed by its smallest useful next action; the enclosing launcher appends the outer adaptive-goal report after it. A non-ready readiness verdict is already a terminal gate result: it takes precedence over the generic human-feedback rule, so do not convert `needs-discovery`, `needs-decision`, or `blocked` into a feedback question or resumable pause."
      : "Implementation readiness is omitted for this goal; do not invoke or record a readiness assessment.",
    "Pursue the active goal through implementation using focused feedback checks. When the tree appears complete, run the final-tree commands once. Do not rerun a passing broad gate unless an intervening edit invalidated it. After all required final-tree and selected review gates pass, complete the native goal and return.",
    "When the contract's human-feedback rule requires a material decision after activation, pause mutation, ask only its smallest concrete question, begin the final response with `- phase: human-feedback-request`, and leave the native goal active for a later resumed turn. The marker and complete question are sufficient; the terminal human-readable report is optional on this nonterminal pause and, if included, must preserve its truthful current values.",
    "When independent review is selected, record each returned semantic result against its exact target fingerprint with `goal-loop step review --ledger <Protocol ledger>`. The helper rejects omitted, duplicate, out-of-order, and repeated-target evidence.",
    "Do not hand-author a darrow-native-goal-report-v1 block. Return terminal engineering evidence; the enclosing launcher renders the canonical report from the ledger after route and objective cleanup are known.",
    "Before returning a terminal result, settle the native goal: mark it complete only when all required gates pass, or blocked when a terminal gate remains unsatisfied. A human-feedback pause is nonterminal and must not settle the goal.",
    "After a terminal block, any host-required automatic continuation is status settlement only and must not resume repository work, verification, review, or publication.",
  ].join("\n");
}

export function readinessStatusSettlementPrompt(verdict: string): string {
  if (!isNonReadyReadinessVerdict(verdict))
    throw new Error(`cannot settle ready readiness verdict: ${verdict}`);
  return [
    "- phase: readiness-status-settlement",
    `The implementation-readiness capability already returned and the protocol ledger recorded the terminal \`${verdict}\` verdict.`,
    "This is not a request for human feedback and must not become a resumable pause.",
    "Perform only native-goal status settlement: use the native goal control to mark this existing goal blocked.",
    "Do not inspect or mutate the repository, invoke another capability, run verification, ask a question, or resume implementation.",
    "Return only a short status confirmation after the goal is blocked. The enclosing launcher preserves the earlier complete readiness result and appends its canonical report.",
  ].join("\n");
}

export function goalDimensionStage(
  engineeringRequest: string,
): GoalDimensionStage {
  return (
    (engineeringRequest.match(
      /^evaluation_dimension_stage\t(workflow|workflow-risk)$/m,
    )?.[1] as GoalDimensionStage | undefined) ?? "workflow-risk"
  );
}

function parseHandoffObject(text: string): Partial<GoalHandoff> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("preflight did not return one JSON handoff");
  }
  if (value === null || typeof value !== "object")
    throw new Error("preflight handoff is not an object");
  const handoff = value as Partial<GoalHandoff>;
  const rawReview = (
    handoff as Partial<GoalHandoff> & {
      independentReview?: { roundLimit?: unknown };
    }
  ).independentReview;
  if (rawReview?.roundLimit === null) delete rawReview.roundLimit;
  return handoff;
}

function isValidGoalRoute(route: GoalRoute | undefined): route is GoalRoute {
  return (
    !!route &&
    route.harness === "codex" &&
    route.provider === "openai" &&
    typeof route.model === "string" &&
    typeof route.effort === "string"
  );
}

function isValidGoalContract(contract: unknown): contract is string {
  return typeof contract === "string" && contract.length > 0;
}

function hasExactKeys(value: unknown, keys: string[]): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isValidIndependentReview(
  review: GoalHandoff["independentReview"] | undefined,
): boolean {
  if (!review) return false;
  if (
    !hasExactKeys(
      review,
      review.roundLimit === undefined
        ? ["selection", "reason"]
        : ["selection", "reason", "roundLimit"],
    )
  )
    return false;
  if (!["selected", "omitted"].includes(review.selection)) return false;
  if (typeof review.reason !== "string") return false;
  return (
    review.roundLimit === undefined ||
    (Number.isSafeInteger(review.roundLimit) && review.roundLimit > 0)
  );
}

function isValidReadinessGate(
  readiness: GoalHandoff["readinessGate"] | undefined,
): boolean {
  return (
    !!readiness &&
    hasExactKeys(readiness, ["selection", "reason"]) &&
    ["selected", "omitted"].includes(readiness.selection) &&
    typeof readiness.reason === "string"
  );
}

function hasSelectableDimensions(handoff: Partial<GoalHandoff>): boolean {
  return (
    typeof handoff.workflow === "string" &&
    ["routine", "elevated", "high"].includes(handoff.risk ?? "") &&
    ["policy", "user", "none"].includes(handoff.routeSource ?? "") &&
    isValidReadinessGate(handoff.readinessGate) &&
    isValidIndependentReview(handoff.independentReview)
  );
}

function isDecisionGatedHandoff(handoff: Partial<GoalHandoff>): boolean {
  const route = handoff.selectedRoute;
  return [
    hasExactKeys(route, ["harness", "provider", "model", "effort"]),
    handoff.workflow === "decision-gated" && handoff.risk === "high",
    handoff.profile === "none",
    handoff.routeSource === "none",
    handoff.readinessGate?.selection === "omitted",
    handoff.independentReview?.selection === "omitted",
    handoff.independentReview?.roundLimit === undefined,
    route?.harness === "none",
    route?.provider === "none",
    route?.model === "none",
    route?.effort === "none",
  ].every(Boolean);
}

function highRiskRequiresReview(handoff: GoalHandoff): boolean {
  return handoff.risk === "high" && handoff.workflow !== "decision-gated";
}

function hasPreparedProfile(
  handoff: Partial<GoalHandoff>,
  dimensions: PreparedGoalDimensions,
): boolean {
  return (
    typeof handoff.profile === "string" &&
    dimensions.routes.has(handoff.profile)
  );
}

function assertHandoffShape(
  handoff: Partial<GoalHandoff>,
  dimensions: PreparedGoalDimensions,
): asserts handoff is GoalHandoff {
  const valid =
    hasExactKeys(handoff, [
      "format",
      "workflow",
      "risk",
      "profile",
      "routeSource",
      "readinessGate",
      "independentReview",
      "selectedRoute",
      "goalContract",
    ]) &&
    handoff.format === "darrow-native-goal-handoff-v4" &&
    hasSelectableDimensions(handoff) &&
    (isDecisionGatedHandoff(handoff) ||
      (hasPreparedProfile(handoff, dimensions) &&
        isValidGoalRoute(handoff.selectedRoute) &&
        hasExactKeys(handoff.selectedRoute, [
          "harness",
          "provider",
          "model",
          "effort",
        ]))) &&
    isValidGoalContract(handoff.goalContract);
  if (!valid) throw new Error("preflight handoff has an invalid shape");
}

function sameGoalRoute(left: GoalRoute, right: GoalRoute): boolean {
  return (
    left.harness === right.harness &&
    left.provider === right.provider &&
    left.model === right.model &&
    left.effort === right.effort
  );
}

function assertCatalogRoute(catalog: CatalogRoute[], route: GoalRoute): void {
  const model = catalog.find((entry) => entry.model === route.model);
  if (!model) throw new Error(`unavailable selected model: ${route.model}`);
  if (!model.efforts.includes(route.effort))
    throw new Error(
      `unsupported selected effort for ${route.model}: ${route.effort}`,
    );
}

function assertRouteProvenance(
  handoff: GoalHandoff,
  dimensions: PreparedGoalDimensions,
  explicitUserRoute?: GoalRoute,
): void {
  const route = handoff.selectedRoute;
  if (handoff.routeSource === "policy") {
    const expected = dimensions.routes.get(handoff.profile)!;
    if (!sameGoalRoute(route, expected))
      throw new Error(
        `selected route does not match ${handoff.profile} policy: expected ${expected.model}/${expected.effort}`,
      );
  }
  if (
    handoff.routeSource === "user" &&
    (!explicitUserRoute || !sameGoalRoute(route, explicitUserRoute))
  )
    throw new Error("user-sourced handoff has no matching explicit user route");
}

function assertIndependentReviewReason(reviewReason: string): void {
  if (!reviewReason.trim())
    throw new Error("independent-review clause must include a reason");
  if (Buffer.byteLength(reviewReason) > 240 || hasTextControl(reviewReason))
    throw new Error("independent-review reason must be one bounded text line");
}

function assertReadinessGateReason(reason: string): void {
  if (
    !reason.trim() ||
    Buffer.byteLength(reason) > 240 ||
    hasTextControl(reason)
  )
    throw new Error("readiness-gate reason must be one bounded text line");
}

function assertIndependentReviewPolicy(
  handoff: GoalHandoff,
  explicitReviewRoundLimit?: number,
): void {
  const review = handoff.independentReview;
  assertIndependentReviewReason(review.reason);
  if (highRiskRequiresReview(handoff) && review.selection !== "selected")
    throw new Error("high-risk goal contract must select independent review");
  if (review.selection === "omitted") {
    if (review.roundLimit !== undefined)
      throw new Error("omitted independent review must omit roundLimit");
    if (explicitReviewRoundLimit !== undefined)
      throw new Error(
        "explicit review-round limit requires independent review",
      );
    return;
  }
  if (explicitReviewRoundLimit === undefined && review.roundLimit !== undefined)
    throw new Error(
      "independent-review roundLimit must be omitted without an explicit user limit",
    );
  if (
    explicitReviewRoundLimit !== undefined &&
    review.roundLimit !== explicitReviewRoundLimit
  )
    throw new Error(
      `independent-review roundLimit must be ${explicitReviewRoundLimit}`,
    );
}

function assertGoalContractProtocol(
  handoff: GoalHandoff,
  explicitReviewRoundLimit?: number,
  ledger?: string,
): void {
  assertReadinessGateReason(handoff.readinessGate.reason);
  assertIndependentReviewPolicy(handoff, explicitReviewRoundLimit);
  if (/format\tdarrow-native-goal-preflight-v\d+/.test(handoff.goalContract))
    throw new Error("goal contract duplicates internal launch state");
  if (
    ledger &&
    !handoff.goalContract.split("\n").includes(`Protocol ledger: ${ledger}`)
  )
    throw new Error("goal contract does not preserve the prepared ledger");
}

function assertNoDuplicateCompiledLabels(contract: string): void {
  for (const label of [
    "Readiness gate",
    "Independent review",
    "Protocol ledger",
  ]) {
    const count = contract
      .split(/\r?\n/)
      .filter((line) => line.startsWith(`${label}:`)).length;
    if (count > 1) throw new Error(`goal contract duplicates ${label}`);
  }
}

function hasTextControl(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)!;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    );
  });
}

function canonicalIndependentReviewClause(
  handoff: GoalHandoff,
  explicitReviewRoundLimit?: number,
): string {
  const reason = handoff.independentReview.reason.trim();
  if (handoff.independentReview.selection === "omitted")
    return `Independent review: omitted — ${reason}.`;
  const limitClause =
    explicitReviewRoundLimit === undefined
      ? "use progress-bounded convergence with no implicit numeric review limit"
      : `use the originating explicit hard cap of at most ${explicitReviewRoundLimit} independent-review capability invocations, including the initial comprehensive review`;
  return `Independent review: selected — ${reason}; after implementation and applicable final-tree checks invoke the environment capability matching independent review of the exact current code change; target preparation starts the review boundary, so finish only that capability invocation and await its ordinary response before any other repository investigation, command, edit, check, or publication; interpret the response semantically without requiring an output format; the first invocation is one comprehensive review of the exact current content and establishes a closed finding set; no blocking findings satisfy the gate for that content, while blocking findings block completion and publication; first rework attempts together every eligible blocker and advisory already authorized, clearly in scope, low risk, and neither expanding requested behavior nor materially expanding verification; after rework rerun invalidated checks and request exact-target fix verification limited to the original findings, a mechanically pinned prior-to-current repair delta whose manifests share the same effective base, and direct repair-caused regressions, supplying the original and prior targets, canonical finding order, target history, attempted set, prior scope manifest, any immediately prior verification artifact with its checksum and carried regressions, and current check evidence; caller prose does not establish repair causality; targeted verification must exclude unrelated observations and advisories never keep the gate open; later rework addresses unresolved blockers and repair-caused regressions only; continue only while verification reports material progress, treating a newly detected direct regression as progressing for one repair attempt and unchanged evidence after that attempt as no progress; when continue names an authorized unresolved blocker or direct regression, perform that later rework, rerun invalidated checks, and request fix verification again rather than treating the first regression or an earlier repair round as terminal; clear satisfies the exact-content gate, while repetition, oscillation, unchanged failure evidence, no_progress, blocked, unavailable or inconclusive evidence, exhausted authority, or a reached explicit limit stops with no further repair or publication; ${limitClause}; any later content change invalidates the verification chain; a terminal unsatisfied review stop settles the persisted native goal as blocked before the goal owner returns; any host-required automatic continuation is status settlement only and must not resume repository work, verification, review, or publication.`;
}

function canonicalReadinessGateClause(
  handoff: GoalHandoff,
  goalLoop?: string,
): string {
  const reason = handoff.readinessGate.reason.trim();
  if (handoff.readinessGate.selection === "omitted")
    return `Readiness gate: omitted — ${reason}.`;
  const transition = goalLoop
    ? `/bin/bash '${goalLoop.replaceAll("'", `'"'"'`)}' step readiness --ledger <Protocol ledger> --verdict <ready|needs-discovery|needs-decision|blocked>`
    : "goal-loop step readiness --ledger <Protocol ledger> --verdict <ready|needs-discovery|needs-decision|blocked>";
  return `Readiness gate: selected — ${reason}; before repository or external mutation invoke the available environment capability matching implementation-readiness assessment of the authoritative request; request and preserve its complete human-readable result without requiring JSON; interpret the semantic verdict as ready, needs-discovery, needs-decision, or blocked and record only that verdict in the protocol ledger with \`${transition}\`; Continue only on \`ready\`; for every other verdict stop without mutation, preserve the complete readiness result and its smallest useful next action, settle the native goal as blocked, and place the outer adaptive-goal report after that result.`;
}

function compileReadinessGateClause(
  handoff: GoalHandoff,
  goalLoop?: string,
): void {
  const lines = handoff.goalContract
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("Readiness gate:"));
  const finalTreeIndex = lines.findIndex((line) =>
    line.startsWith("Final-tree checks:"),
  );
  const insertAt = finalTreeIndex >= 0 ? finalTreeIndex + 1 : lines.length;
  lines.splice(insertAt, 0, canonicalReadinessGateClause(handoff, goalLoop));
  handoff.goalContract = lines.join("\n");
}

function compileIndependentReviewClause(
  handoff: GoalHandoff,
  explicitReviewRoundLimit?: number,
): void {
  const lines = handoff.goalContract
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("Independent review:"));
  const finalTreeIndex = lines.findIndex((line) =>
    line.startsWith("Final-tree checks:"),
  );
  const readinessIndex = lines.findIndex((line) =>
    line.startsWith("Readiness gate:"),
  );
  const insertAt =
    readinessIndex >= 0
      ? readinessIndex + 1
      : finalTreeIndex >= 0
        ? finalTreeIndex + 1
        : lines.length;
  lines.splice(
    insertAt,
    0,
    canonicalIndependentReviewClause(handoff, explicitReviewRoundLimit),
  );
  handoff.goalContract = lines.join("\n");
}

function compileProtocolLedgerClause(
  handoff: GoalHandoff,
  ledger: string | undefined,
): void {
  if (!ledger) return;
  const lines = handoff.goalContract
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("Protocol ledger:"));
  lines.push(`Protocol ledger: ${ledger}`);
  handoff.goalContract = lines.join("\n");
}

export function parseCodexGoalHandoff(
  text: string,
  catalog: CatalogRoute[],
  dimensions: PreparedGoalDimensions,
  explicitControls: ExplicitGoalControls = {},
): GoalHandoff {
  const handoff = parseHandoffObject(text);
  assertHandoffShape(handoff, dimensions);
  if (!dimensions.workflows.has(handoff.workflow))
    throw new Error(`unknown workflow: ${handoff.workflow}`);
  if (isDecisionGatedHandoff(handoff)) {
    assertReadinessGateReason(handoff.readinessGate.reason);
    assertIndependentReviewPolicy(handoff, explicitControls.reviewRoundLimit);
    return handoff;
  }
  assertCatalogRoute(catalog, handoff.selectedRoute);
  assertRouteProvenance(handoff, dimensions, explicitControls.route);
  assertNoDuplicateCompiledLabels(handoff.goalContract);
  compileProtocolLedgerClause(handoff, explicitControls.ledger);
  assertGoalContractProtocol(
    handoff,
    explicitControls.reviewRoundLimit,
    explicitControls.ledger,
  );
  compileReadinessGateClause(handoff, explicitControls.goalLoop);
  compileIndependentReviewClause(handoff, explicitControls.reviewRoundLimit);
  const contractIssues = goalContractRecordIssues(handoff.goalContract);
  if (contractIssues.length)
    throw new Error(
      `goal contract is incomplete: ${contractIssues.join(", ")}`,
    );
  return handoff;
}

function independentReviewSchema() {
  return {
    type: "object",
    properties: {
      selection: { type: "string", enum: ["selected", "omitted"] },
      reason: { type: "string", minLength: 1, maxLength: 240 },
      roundLimit: { type: ["integer", "null"], minimum: 1 },
    },
    required: ["selection", "reason", "roundLimit"],
    additionalProperties: false,
  };
}

function readinessGateSchema() {
  return {
    type: "object",
    properties: {
      selection: { type: "string", enum: ["selected", "omitted"] },
      reason: { type: "string", minLength: 1, maxLength: 240 },
    },
    required: ["selection", "reason"],
    additionalProperties: false,
  };
}

function selectedRouteSchema() {
  return {
    type: "object",
    properties: {
      harness: { type: "string", enum: ["codex", "none"] },
      provider: { type: "string", enum: ["openai", "none"] },
      model: { type: "string", minLength: 1 },
      effort: { type: "string", minLength: 1 },
    },
    required: ["harness", "provider", "model", "effort"],
    additionalProperties: false,
  };
}

function handoffSchema(profiles: string[]) {
  return {
    type: "object",
    properties: {
      format: { type: "string", const: "darrow-native-goal-handoff-v4" },
      workflow: {
        type: "string",
        enum: [
          "fix-bug",
          "implement-feature",
          "change-feature",
          "refactor",
          "migration",
          "mechanical",
          "decision-gated",
        ],
      },
      risk: { type: "string", enum: ["routine", "elevated", "high"] },
      profile: { type: "string", enum: [...profiles, "none"] },
      routeSource: { type: "string", enum: ["policy", "user", "none"] },
      readinessGate: readinessGateSchema(),
      independentReview: independentReviewSchema(),
      selectedRoute: selectedRouteSchema(),
      goalContract: { type: "string", minLength: 1 },
    },
    required: [
      "format",
      "workflow",
      "risk",
      "profile",
      "routeSource",
      "readinessGate",
      "independentReview",
      "selectedRoute",
      "goalContract",
    ],
    additionalProperties: false,
  };
}

interface TokenUsageTotals {
  inputTokens: number;
  outputTokens: number;
}

interface AppServerItem {
  type?: string;
  phase?: string;
  text?: string;
  aggregatedOutput?: string;
  exitCode?: number;
}

interface AppServerTurn {
  id?: string;
  status?: string;
  durationMs?: number;
  error?: unknown;
}

interface AppServerParams {
  threadId?: string;
  turnId?: string;
  item?: AppServerItem;
  turn?: AppServerTurn;
  goal?: { status?: string };
  tokenUsage?: { total: TokenUsageTotals };
}

/** One decoded JSON-RPC line from the Codex app-server stdio stream. */
interface AppServerMessage {
  id?: number;
  method?: string;
  error?: unknown;
  result?: unknown;
  params?: AppServerParams;
}

type AppServerPredicate = (message: AppServerMessage) => boolean;

function messageFeedbackRequestId(
  message: AppServerMessage,
  threadId: string,
): string | undefined {
  const item = message.params?.item;
  if (
    ![
      message.method === "item/completed",
      message.params?.threadId === threadId,
      item?.type === "commandExecution",
    ].every(Boolean)
  )
    return undefined;
  const output = item?.aggregatedOutput ?? "";
  if (!/(?:^|\n)feedback_required(?:\n|$)/.test(output)) return undefined;
  return output.match(/(?:^|\n)id:\s*([A-Za-z0-9._-]+)(?:\n|$)/)?.[1];
}

interface ModelListResult {
  data: Array<{
    model: string;
    supportedReasoningEfforts: Array<{ reasoningEffort: string }>;
  }>;
}

interface ThreadStartResult {
  thread: { id: string };
}

interface TurnStartResult {
  turn: { id: string };
}

interface GoalGetResult {
  goal?: { objective?: string; status?: string };
}

function implementationReadinessResult(
  message: AppServerMessage,
  threadId: string,
): string | undefined {
  if (message.method !== "item/completed") return undefined;
  const params = message.params;
  if (!params || params.threadId !== threadId) return undefined;
  const item = params.item;
  if (!item || !["agentMessage", "commandExecution"].includes(item.type ?? ""))
    return undefined;
  const result = item.text ?? item.aggregatedOutput;
  return result && parseImplementationReadinessResult(result)
    ? result
    : undefined;
}

class AppServerClient {
  private nextId = 1;
  private messages: AppServerMessage[] = [];
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();
  private waiters: Array<{
    predicate: AppServerPredicate;
    resolve: (message: AppServerMessage) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private rawLines: string[] = [];
  private stderr = "";

  constructor(
    private proc: {
      stdin: {
        write(value: string): number | Promise<number>;
        flush(): number | Promise<number>;
        end(): number | Promise<number>;
      };
      stdout: ReadableStream<Uint8Array>;
      stderr: ReadableStream<Uint8Array>;
      exited: Promise<number>;
      kill(): void;
    },
  ) {
    void this.readStdout();
    void this.readStderr();
  }

  private async readStdout(): Promise<void> {
    const reader = this.proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) this.receive(line);
    }
    if (buffer.trim()) this.receive(buffer);
    const error = new Error(
      `Codex app-server exited before completing a request: ${this.stderr.trim()}`,
    );
    for (const pending of this.pending.values()) pending.reject(error);
    for (const waiter of this.waiters) waiter.reject(error);
  }

  private async readStderr(): Promise<void> {
    this.stderr = await new Response(this.proc.stderr).text();
  }

  private settle(message: AppServerMessage): void {
    if (typeof message.id !== "number" || !this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id)!;
    this.pending.delete(message.id);
    if (message.error)
      pending.reject(
        new Error(
          `app-server request failed: ${JSON.stringify(message.error)}`,
        ),
      );
    else pending.resolve(message.result);
  }

  private receive(line: string): void {
    if (!line.trim()) return;
    this.rawLines.push(line);
    let message: AppServerMessage;
    try {
      message = JSON.parse(line) as AppServerMessage;
    } catch {
      return;
    }
    this.messages.push(message);
    this.settle(message);
    for (const waiter of [...this.waiters]) {
      if (!waiter.predicate(message)) continue;
      clearTimeout(waiter.timer);
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  }

  notify(method: string, params: unknown): void {
    this.proc.stdin.write(`${JSON.stringify({ method, params })}\n`);
    this.proc.stdin.flush();
  }

  request<T = unknown>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    this.proc.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    this.proc.stdin.flush();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
  }

  waitFor(
    predicate: AppServerPredicate,
    timeoutMs = 30 * 60 * 1000,
  ): Promise<AppServerMessage> {
    const existing = this.messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters.splice(this.waiters.indexOf(waiter), 1);
          reject(new Error("timed out waiting for Codex app-server event"));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  cursor(): number {
    return this.messages.length;
  }

  waitForAfter(
    cursor: number,
    predicate: AppServerPredicate,
    timeoutMs = 30 * 60 * 1000,
  ): Promise<AppServerMessage> {
    const existing = this.messages.slice(cursor).find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters.splice(this.waiters.indexOf(waiter), 1);
          reject(new Error("timed out waiting for Codex app-server event"));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  latest(predicate: AppServerPredicate): AppServerMessage | undefined {
    return this.messages.findLast(predicate);
  }

  matching(predicate: AppServerPredicate): AppServerMessage[] {
    return this.messages.filter(predicate);
  }

  record(message: unknown): void {
    this.rawLines.push(JSON.stringify(message));
  }

  latestFeedbackRequestId(threadId: string): string | undefined {
    return this.messages
      .toReversed()
      .map((message) => messageFeedbackRequestId(message, threadId))
      .find((id) => id !== undefined);
  }

  latestImplementationReadinessResult(threadId: string): string | undefined {
    return this.messages
      .toReversed()
      .map((message) => implementationReadinessResult(message, threadId))
      .find((result) => result !== undefined);
  }

  raw(): string {
    return this.rawLines.join("\n") + (this.stderr ? `\n${this.stderr}` : "");
  }

  async close(): Promise<void> {
    this.proc.stdin.end();
    this.proc.kill();
    await this.proc.exited;
  }
}

export function isFinalAgentMessage(
  message: AppServerMessage,
  turnId: string,
): boolean {
  return (
    message.method === "item/completed" &&
    message.params?.turnId === turnId &&
    message.params?.item?.type === "agentMessage" &&
    message.params?.item?.phase === "final_answer"
  );
}

function isTokenUsageUpdate(
  message: AppServerMessage,
  turnId: string,
): boolean {
  return (
    message.method === "thread/tokenUsage/updated" &&
    message.params?.turnId === turnId
  );
}

/** Turn evidence: the final answer, its cumulative usage event, and duration. */
interface TurnOutcome {
  text: string;
  usage: AppServerMessage;
  durationMs: number;
}

function turnTokenTotals(outcome: TurnOutcome): TokenUsageTotals {
  return outcome.usage.params!.tokenUsage!.total;
}

async function completedTurn(
  client: AppServerClient,
  turnId: string,
): Promise<AppServerMessage> {
  const message = await client.waitFor(
    (candidate) =>
      candidate.method === "turn/completed" &&
      candidate.params?.turn?.id === turnId,
  );
  if (message.params!.turn!.status !== "completed")
    throw new Error(`Codex turn ended as ${message.params!.turn!.status}`);
  return message;
}

async function runTurn(
  client: AppServerClient,
  turnId: string,
): Promise<TurnOutcome> {
  const completed = await completedTurn(client, turnId);
  const final = client.latest((message) =>
    isFinalAgentMessage(message, turnId),
  );
  if (!final)
    throw new Error(`Codex turn ${turnId} reported no final agent message`);
  const usage = client.latest((message) => isTokenUsageUpdate(message, turnId));
  if (!usage) throw new Error(`Codex turn ${turnId} reported no token usage`);
  return {
    text: final.params!.item!.text as string,
    usage,
    durationMs: completed.params!.turn!.durationMs ?? 0,
  };
}

function isSettledGoalUpdate(
  message: AppServerMessage,
  threadId: string,
): boolean {
  return (
    message.method === "thread/goal/updated" &&
    message.params?.threadId === threadId &&
    isGoalTerminalStatus(message.params?.goal?.status)
  );
}

function isFailedGoalTurn(
  message: AppServerMessage,
  threadId: string,
): boolean {
  return (
    message.method === "turn/completed" &&
    message.params?.threadId === threadId &&
    message.params?.turn?.status === "failed"
  );
}

export function isRecordedReadinessStep(
  message: AppServerMessage,
  threadId: string,
): boolean {
  const item = message.params?.item;
  const output = item?.aggregatedOutput ?? "";
  return [
    message.method === "item/completed",
    message.params?.threadId === threadId,
    item?.type === "commandExecution",
    item?.exitCode === 0,
    /(?:^|\n)step\treadiness(?:\n|$)/.test(output),
    /(?:^|\n)status\trecorded(?:\n|$)/.test(output),
  ].every(Boolean);
}

export function isHumanFeedbackPauseText(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const marker = text.match(/^- phase: human-feedback-request\r?\n/);
  if (!marker) return false;
  return text.slice(marker[0].length).trim().length > 0;
}

export function isHumanFeedbackPauseForTurn(
  message: AppServerMessage,
  threadId: string,
  turnId: string,
): boolean {
  return (
    isHumanFeedbackPauseForThread(message, threadId) &&
    message.params?.turnId === turnId
  );
}

function isHumanFeedbackPauseForThread(
  message: AppServerMessage,
  threadId: string,
): boolean {
  return (
    message.method === "item/completed" &&
    message.params?.threadId === threadId &&
    message.params?.item?.type === "agentMessage" &&
    message.params.item.phase === "final_answer" &&
    isHumanFeedbackPauseText(message.params.item.text)
  );
}

/** Complete and blocked are both observable native-goal outcomes. The eval's
 * repository and output checks decide whether either is correct for the case. */
export function isReportableGoalStatus(
  status: string | undefined,
): status is "complete" | "blocked" {
  return isGoalTerminalStatus(status);
}

export function isGoalTerminalStatus(
  status: string | undefined,
): status is "complete" | "blocked" {
  return status === "complete" || status === "blocked";
}

export function isResumableGoalStatus(
  status: string | undefined,
): status is "active" | "paused" {
  return status === "active" || status === "paused";
}

async function collectHumanFeedbackPause(
  client: AppServerClient,
  threadId: string,
  message: AppServerMessage,
  confirmTerminal: () => void,
): Promise<TurnOutcome> {
  const turnId = message.params?.turnId;
  if (typeof turnId !== "string")
    throw new Error("native goal feedback pause did not name its turn");
  const result = await runTurn(client, turnId);
  const goal = await client.request<GoalGetResult>("thread/goal/get", {
    threadId,
  });
  if (isReportableGoalStatus(goal.goal?.status)) {
    confirmTerminal();
    return result;
  }
  if (!isResumableGoalStatus(goal.goal?.status))
    throw new Error(
      `native goal feedback pause ended as ${goal.goal?.status ?? "missing"}`,
    );
  return result;
}

interface NativeGoalRunContext {
  threadId: string;
  turnId: string;
  eventCursor: number;
  readinessLedger?: string;
}

async function runNativeGoal(
  client: AppServerClient,
  context: NativeGoalRunContext,
  confirmTerminal: () => void,
): Promise<TurnOutcome> {
  const { threadId, turnId } = context;
  let cursor = context.eventCursor;
  let pendingReadinessLedger = context.readinessLedger;
  let terminal: AppServerMessage;
  while (true) {
    terminal = await client.waitForAfter(
      cursor,
      (message) =>
        isSettledGoalUpdate(message, threadId) ||
        isFailedGoalTurn(message, threadId) ||
        isHumanFeedbackPauseForThread(message, threadId) ||
        (!!pendingReadinessLedger &&
          isRecordedReadinessStep(message, threadId)),
    );
    if (!isRecordedReadinessStep(terminal, threadId)) break;
    const settlementCursor = client.cursor();
    await settleRecordedReadiness(client, threadId, pendingReadinessLedger!);
    pendingReadinessLedger = undefined;
    cursor = settlementCursor;
  }
  if (isFailedGoalTurn(terminal, threadId))
    throw new Error(
      `Codex goal turn failed: ${JSON.stringify(terminal.params!.turn!.error)}`,
    );
  if (isHumanFeedbackPauseForThread(terminal, threadId))
    return collectHumanFeedbackPause(
      client,
      threadId,
      terminal,
      confirmTerminal,
    );
  if (!isReportableGoalStatus(terminal.params!.goal!.status))
    throw new Error(`native goal ended as ${terminal.params!.goal!.status}`);
  confirmTerminal();
  const terminalTurnId = terminal.params!.turnId ?? turnId;
  return runTurn(client, terminalTurnId);
}

interface CapturedProcess {
  stdout: string;
  stderr: string;
  code: number;
}

async function captureProcess(
  argv: string[],
  cwd: string,
): Promise<CapturedProcess> {
  const proc = Bun.spawn(argv, { cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

export interface MaterializedGoalObjective {
  objective: string;
  mode: GoalObjectiveMode;
  attachment?: GoalAttachmentRelease;
  cleanup(): Promise<void>;
}

export interface GoalAttachmentRelease {
  attachmentDir: string;
  contractSha256: string;
}

type GoalObjectiveMode = "inline" | "file-backed";

function parseObjectiveRecords(stdout: string): Map<string, string> {
  const marker = "format\tdarrow-native-goal-objective-v1";
  const markerIndex = stdout.indexOf(marker);
  if (markerIndex < 0)
    throw new Error("goal objective output omitted its canonical record");
  stdout = stdout.slice(markerIndex);
  const records = new Map<string, string>();
  for (const line of stdout.trimEnd().split("\n")) {
    const fields = line.split("\t");
    if (fields.length !== 2 || !fields[0] || !fields[1])
      throw new Error(`invalid goal objective record: ${line}`);
    if (records.has(fields[0]))
      throw new Error(`duplicate goal objective record: ${fields[0]}`);
    records.set(fields[0], fields[1]);
  }
  return records;
}

function requiredObjectiveRecord(
  records: Map<string, string>,
  key: string,
): string {
  const value = records.get(key);
  if (!value) throw new Error(`missing goal objective record: ${key}`);
  return value;
}

function isPathWithin(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return (
    path.length > 0 &&
    path !== ".." &&
    !path.startsWith("../") &&
    !path.startsWith("..\\") &&
    !isAbsolute(path)
  );
}

async function validateGoalAttachment(
  records: Map<string, string>,
  objectiveFile: string,
  goalContract: string,
): Promise<string> {
  const emittedAttachment = requiredObjectiveRecord(records, "attachment_dir");
  const [temporaryRoot, attachmentDir, contractFile, resolvedObjective] =
    await Promise.all([
      realpath(tmpdir()),
      realpath(emittedAttachment),
      realpath(requiredObjectiveRecord(records, "contract_file")),
      realpath(objectiveFile),
    ]);
  if (
    !isPathWithin(temporaryRoot, attachmentDir) ||
    !basename(attachmentDir).startsWith("darrow-goal-contract.")
  )
    throw new Error("goal attachment directory is outside the temporary root");
  if (
    dirname(contractFile) !== attachmentDir ||
    dirname(resolvedObjective) !== attachmentDir
  )
    throw new Error("goal attachment files escaped their private directory");
  const attachedContract = await readFile(contractFile);
  if (!attachedContract.equals(Buffer.from(goalContract, "utf8")))
    throw new Error("file-backed goal contract changed after materialization");
  return attachmentDir;
}

function goalObjectiveMode(records: Map<string, string>): GoalObjectiveMode {
  if (
    requiredObjectiveRecord(records, "format") !==
    "darrow-native-goal-objective-v1"
  )
    throw new Error(
      "goal objective materialization returned an unknown format",
    );
  const mode = requiredObjectiveRecord(records, "mode");
  if (mode !== "inline" && mode !== "file-backed")
    throw new Error(`unknown goal objective mode: ${mode}`);
  return mode;
}

function assertContractByteCount(
  records: Map<string, string>,
  goalContract: string,
): void {
  if (
    Number(requiredObjectiveRecord(records, "contract_bytes")) !==
    Buffer.byteLength(goalContract)
  )
    throw new Error("materialized goal contract byte count changed");
  const expectedDigest = goalContractSha256(goalContract);
  if (requiredObjectiveRecord(records, "contract_sha256") !== expectedDigest)
    throw new Error("materialized goal contract digest changed");
}

function assertInlineObjectiveRecords(
  records: Map<string, string>,
  objectiveFile: string,
): void {
  if (
    requiredObjectiveRecord(records, "attachment_dir") !== "none" ||
    requiredObjectiveRecord(records, "contract_file") !== objectiveFile
  )
    throw new Error("inline goal objective returned attachment state");
}

function assertObjectiveByteCount(
  records: Map<string, string>,
  objective: string,
): void {
  const objectiveBytes = Number(
    requiredObjectiveRecord(records, "objective_bytes"),
  );
  if (
    objectiveBytes !== Buffer.byteLength(objective) ||
    objectiveBytes <= 0 ||
    objectiveBytes > INLINE_GOAL_OBJECTIVE_BYTES
  )
    throw new Error("materialized native objective has an invalid byte count");
}

async function readGoalObjective(
  records: Map<string, string>,
  goalContract: string,
  stagedInlineObjective?: string,
): Promise<
  Omit<MaterializedGoalObjective, "cleanup"> & { attachmentDir?: string }
> {
  const mode = goalObjectiveMode(records);
  assertContractByteCount(records, goalContract);
  const objectiveFile = requiredObjectiveRecord(records, "objective_file");
  if (!isAbsolute(objectiveFile))
    throw new Error("goal objective materialization returned a relative path");
  const attachmentDir =
    mode === "file-backed"
      ? await validateGoalAttachment(records, objectiveFile, goalContract)
      : undefined;
  if (mode === "inline") assertInlineObjectiveRecords(records, objectiveFile);
  const objective =
    mode === "inline" && stagedInlineObjective !== undefined
      ? stagedInlineObjective
      : await readFile(objectiveFile, "utf8");
  assertObjectiveByteCount(records, objective);
  if (mode === "inline" && objective !== goalContract)
    throw new Error("inline native objective changed the goal contract");
  return { objective, mode, attachmentDir };
}

interface ObjectiveMaterializerContext {
  repoDir: string;
  helper: string;
  stagingFile: string;
  ledger?: string;
}

async function stageLedgerObjective(
  context: ObjectiveMaterializerContext,
): Promise<string | undefined> {
  if (!context.ledger) return undefined;
  const staged = await captureProcess(
    [
      "bash",
      context.helper,
      "step",
      "stage",
      "--ledger",
      context.ledger,
      "--goal-file",
      context.stagingFile,
    ],
    context.repoDir,
  );
  if (staged.code !== 0)
    throw new Error(`goal objective staging failed: ${staged.stderr.trim()}`);
  return requiredStepRecord(staged.stdout, "contract_sha256");
}

function materializerArgv(
  context: ObjectiveMaterializerContext,
  expectedDigest: string | undefined,
): string[] {
  return context.ledger
    ? [
        "bash",
        context.helper,
        "step",
        "materialize",
        "--ledger",
        context.ledger,
        "--goal-file",
        context.stagingFile,
        "--expected-sha256",
        expectedDigest!,
      ]
    : [
        "bash",
        context.helper,
        "materialize-objective",
        "--repo",
        context.repoDir,
        "--goal-file",
        context.stagingFile,
      ];
}

async function releaseLedgerStaging(
  context: ObjectiveMaterializerContext,
  expectedDigest: string,
  records: Map<string, string>,
): Promise<void> {
  const released = await captureProcess(
    [
      "bash",
      context.helper,
      "step",
      "release-staging",
      "--ledger",
      context.ledger!,
      "--goal-file",
      context.stagingFile,
      "--expected-sha256",
      expectedDigest,
    ],
    context.repoDir,
  );
  if (released.code === 0) return;
  const releaseError = `goal staging release failed: ${released.stderr.trim()}`;
  const attachmentDir = records.get("attachment_dir");
  try {
    if (attachmentDir && attachmentDir !== "none")
      await releaseGoalAttachment(
        context.repoDir,
        attachmentDir,
        expectedDigest,
        context.ledger,
      );
  } catch (cleanupError) {
    throw new Error(`${releaseError}; ${errorText(cleanupError)}`, {
      cause: cleanupError,
    });
  }
  throw new Error(releaseError);
}

async function runObjectiveMaterializer(
  repoDir: string,
  stagingFile: string,
  goalContract: string,
  ledger?: string,
): Promise<{
  records: Map<string, string>;
  stagedInlineObjective?: string;
}> {
  const context = {
    repoDir,
    stagingFile,
    ledger,
    helper: join(repoDir, ".agents", "bin", "goal-loop"),
  };
  const expectedDigest = await stageLedgerObjective(context);
  const materialized = await captureProcess(
    materializerArgv(context, expectedDigest),
    repoDir,
  );
  if (materialized.code !== 0)
    throw new Error(
      `goal objective materialization failed: ${materialized.stderr.trim()}`,
    );
  const records = parseObjectiveRecords(materialized.stdout);
  let stagedInlineObjective: string | undefined;
  if (ledger && goalObjectiveMode(records) === "inline") {
    assertContractByteCount(records, goalContract);
    const objectiveFile = requiredObjectiveRecord(records, "objective_file");
    if (!isAbsolute(objectiveFile))
      throw new Error(
        "goal objective materialization returned a relative path",
      );
    assertInlineObjectiveRecords(records, objectiveFile);
    stagedInlineObjective = await readFile(objectiveFile, "utf8");
  }
  if (ledger) await releaseLedgerStaging(context, expectedDigest!, records);
  return { records, stagedInlineObjective };
}

async function releaseGoalAttachment(
  repoDir: string,
  attachmentDir: string,
  expectedDigest: string,
  ledger?: string,
): Promise<void> {
  const helper = join(repoDir, ".agents", "bin", "goal-loop");
  const argv = ledger
    ? [
        "bash",
        helper,
        "step",
        "release-objective",
        "--ledger",
        ledger,
        "--attachment-dir",
        attachmentDir,
        "--expected-sha256",
        expectedDigest,
      ]
    : [
        "bash",
        helper,
        "release-objective",
        "--attachment-dir",
        attachmentDir,
        "--expected-sha256",
        expectedDigest,
      ];
  const { stderr, code } = await captureProcess(argv, repoDir);
  if (code !== 0)
    throw new Error(`goal attachment release failed: ${stderr.trim()}`);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function goalContractSha256(goalContract: string): string {
  return new Bun.CryptoHasher("sha256").update(goalContract).digest("hex");
}

type PrivateGoalStagingWriter = (
  stagingFile: string,
  goalContract: string,
) => Promise<void>;

async function writePrivateGoalStaging(
  stagingFile: string,
  goalContract: string,
): Promise<void> {
  await writeFile(stagingFile, goalContract, { encoding: "utf8", mode: 0o600 });
}

export async function withPrivateGoalStaging<T>(
  goalContract: string,
  consume: (stagingFile: string) => Promise<T>,
  writeStaging: PrivateGoalStagingWriter = writePrivateGoalStaging,
): Promise<T> {
  const stagingDir = await mkdtemp(join(tmpdir(), "darrow-goal-staging."));
  try {
    await chmod(stagingDir, 0o700);
    const stagingFile = join(stagingDir, "goal-contract.md");
    await writeStaging(stagingFile, goalContract);
    return await consume(stagingFile);
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
}

interface GoalAttachmentCleanupContext {
  repoDir: string;
  attachmentDir: string;
  expectedDigest: string;
  ledger?: string;
}

function materializedGoalLifecycle(
  materialized: Omit<MaterializedGoalObjective, "cleanup"> & {
    attachmentDir?: string;
  },
  cleanupContext: GoalAttachmentCleanupContext | undefined,
): MaterializedGoalObjective {
  let released = false;
  return {
    objective: materialized.objective,
    mode: materialized.mode,
    attachment: cleanupContext
      ? {
          attachmentDir: cleanupContext.attachmentDir,
          contractSha256: cleanupContext.expectedDigest,
        }
      : undefined,
    async cleanup() {
      if (!cleanupContext || released) return;
      await releaseGoalAttachment(
        cleanupContext.repoDir,
        cleanupContext.attachmentDir,
        cleanupContext.expectedDigest,
        cleanupContext.ledger,
      );
      released = true;
    },
  };
}

async function cleanupGoalAttachmentAfterFailure(
  context: GoalAttachmentCleanupContext,
  error: unknown,
): Promise<never> {
  try {
    await releaseGoalAttachment(
      context.repoDir,
      context.attachmentDir,
      context.expectedDigest,
      context.ledger,
    );
  } catch (cleanupError) {
    throw new Error(`${errorText(error)}; ${errorText(cleanupError)}`, {
      cause: cleanupError,
    });
  }
  throw error;
}

function goalAttachmentCleanupContext(
  repoDir: string,
  expectedDigest: string,
  ledger: string | undefined,
  attachmentDir: string | undefined,
): GoalAttachmentCleanupContext | undefined {
  if (!attachmentDir || attachmentDir === "none") return undefined;
  return { repoDir, attachmentDir, expectedDigest, ledger };
}

interface GoalObjectiveConsumption {
  repoDir: string;
  stagingFile: string;
  goalContract: string;
  expectedDigest: string;
  ledger?: string;
}

async function consumeGoalObjective(options: GoalObjectiveConsumption) {
  const { repoDir, stagingFile, goalContract, expectedDigest, ledger } =
    options;
  const { records, stagedInlineObjective } = await runObjectiveMaterializer(
    repoDir,
    stagingFile,
    goalContract,
    ledger,
  );
  let cleanupContext = goalAttachmentCleanupContext(
    repoDir,
    expectedDigest,
    ledger,
    records.get("attachment_dir"),
  );
  const materialized = await readGoalObjective(
    records,
    goalContract,
    stagedInlineObjective,
  );
  cleanupContext =
    goalAttachmentCleanupContext(
      repoDir,
      expectedDigest,
      ledger,
      materialized.attachmentDir,
    ) ?? cleanupContext;
  return { materialized, cleanupContext };
}

async function materializeGoalObjective(
  repoDir: string,
  goalContract: string,
  ledger?: string,
  ledgerStagingDir?: string,
): Promise<MaterializedGoalObjective> {
  const expectedDigest = goalContractSha256(goalContract);
  let cleanupContext: GoalAttachmentCleanupContext | undefined;
  try {
    const consume = async (stagingFile: string) => {
      const consumed = await consumeGoalObjective({
        repoDir,
        stagingFile,
        goalContract,
        expectedDigest,
        ledger,
      });
      cleanupContext = consumed.cleanupContext;
      return materializedGoalLifecycle(consumed.materialized, cleanupContext);
    };
    if (!ledgerStagingDir)
      return await withPrivateGoalStaging(goalContract, consume);
    const stagingFile = join(ledgerStagingDir, "goal-contract.md");
    await writePrivateGoalStaging(stagingFile, goalContract);
    try {
      return await consume(stagingFile);
    } catch (error) {
      await rm(ledgerStagingDir, { recursive: true, force: true });
      throw error;
    }
  } catch (error) {
    if (cleanupContext)
      return cleanupGoalAttachmentAfterFailure(cleanupContext, error);
    throw error;
  }
}

interface NativeGoalSetter {
  request<T = unknown>(method: string, params: unknown): Promise<T>;
}

interface MaterializedGoalActivation {
  repoDir: string;
  threadId: string;
  goalContract: string;
  ledger?: string;
  stagingDir?: string;
}

export async function activateMaterializedGoal(
  client: NativeGoalSetter,
  activation: MaterializedGoalActivation,
): Promise<MaterializedGoalObjective> {
  const materialized = await materializeGoalObjective(
    activation.repoDir,
    activation.goalContract,
    activation.ledger,
    activation.stagingDir,
  );
  try {
    await client.request("thread/goal/set", {
      threadId: activation.threadId,
      objective: materialized.objective,
      status: "active",
    });
    return materialized;
  } catch (error) {
    await materialized.cleanup();
    throw error;
  }
}

function requiredStepRecord(stdout: string, key: string): string {
  const values = stdout
    .trimEnd()
    .split("\n")
    .flatMap((line) => {
      const fields = line.split("\t");
      return fields.length === 2 && fields[0] === key ? [fields[1]!] : [];
    });
  if (values.length !== 1 || !values[0])
    throw new Error(`goal step returned missing or duplicate ${key}`);
  return values[0];
}

async function ledgerReadinessVerdict(ledger: string): Promise<string> {
  const state = await readFile(join(ledger, "state"), "utf8");
  const values = state.split(/\r?\n/).flatMap((line) => {
    const fields = line.split("\t");
    return fields.length === 2 && fields[0] === "readiness_verdict"
      ? [fields[1]!]
      : [];
  });
  if (values.length !== 1 || !values[0])
    throw new Error("goal ledger has missing or duplicate readiness verdict");
  return values[0];
}

function isNonReadyReadinessVerdict(verdict: string): boolean {
  return ["needs-discovery", "needs-decision", "blocked"].includes(verdict);
}

async function settleRecordedReadiness(
  client: AppServerClient,
  threadId: string,
  ledger: string,
): Promise<void> {
  const verdict = await ledgerReadinessVerdict(ledger);
  if (!isNonReadyReadinessVerdict(verdict)) return;
  const current = await client.request<GoalGetResult>("thread/goal/get", {
    threadId,
  });
  const goal = current.goal;
  if (!goal)
    throw new Error("cannot settle non-ready native goal from missing");
  if (goal.status === "complete")
    throw new Error(
      "non-ready readiness verdict settled the native goal complete",
    );
  if (goal.status === "blocked") return;
  if (!isResumableGoalStatus(goal.status))
    throw new Error(
      `cannot settle non-ready native goal from ${goal.status ?? "missing"}`,
    );
  if (typeof goal.objective !== "string")
    throw new Error(
      "cannot settle non-ready native goal without its objective",
    );
  await client.request("thread/goal/set", {
    threadId,
    objective: goal.objective,
    status: "blocked",
  });
  client.record({
    type: "darrow.readiness_status_settlement",
    verdict,
    thread_id: threadId,
    applied_by: "host-api",
  });
}

interface GoalPreparation {
  evidence: string;
  ledger: string;
  stagingDir: string;
}

async function runGoalPreparation(repoDir: string): Promise<GoalPreparation> {
  const helper = join(repoDir, ".agents", "bin", "goal-loop");
  const start = await captureProcess(
    ["bash", helper, "step", "start", "--repo", repoDir, "--host", "codex"],
    repoDir,
  );
  if (start.code !== 0)
    throw new Error(`goal ledger start failed: ${start.stderr.trim()}`);
  const ledger = requiredStepRecord(start.stdout, "ledger");
  const stagingDir = requiredStepRecord(start.stdout, "staging_dir");
  const prepared = await captureProcess(
    ["bash", helper, "step", "prepare", "--ledger", ledger],
    repoDir,
  );
  if (prepared.code !== 0)
    throw new Error(
      `goal preflight preparation failed: ${prepared.stderr.trim()}`,
    );
  if (!/^format\tdarrow-native-goal-prepared-v1$/m.test(prepared.stdout))
    throw new Error("goal preflight preparation returned an unknown format");
  return {
    evidence: `${start.stdout.trimEnd()}\n${prepared.stdout.trimEnd()}`,
    ledger,
    stagingDir,
  };
}

function readWorkflowDocuments(
  dimensions: PreparedGoalDimensions,
): Promise<string[]> {
  return Promise.all(
    [...dimensions.workflows].map(async ([id, workflow]) => {
      const content = await readFile(workflow.file, "utf8");
      return [
        `workflow_document_begin\t${id}`,
        content.trim(),
        `workflow_document_end\t${id}`,
      ].join("\n");
    }),
  );
}

interface PreparedGoalPreflight {
  engineeringRequest: string;
  prompt: string;
  ledger: string;
  stagingDir: string;
  dimensions: PreparedGoalDimensions;
  intentRoutingGuidance: string;
  stage: GoalDimensionStage;
  durationMs: number;
}

async function prepareGoalPreflight(
  repoDir: string,
  engineeringRequest: string,
): Promise<PreparedGoalPreflight> {
  const started = performance.now();
  const preparation = await runGoalPreparation(repoDir);
  const stage = goalDimensionStage(engineeringRequest);
  const dimensions = parsePreparedGoalDimensions(preparation.evidence);
  const skill = await readFile(
    join(repoDir, ".agents", "skills", "adaptive-goal", "SKILL.md"),
    "utf8",
  );
  const intentRoutingGuidance = extractIntentRoutingGuidance(skill);
  const workflowDocuments = await readWorkflowDocuments(dimensions);
  const preparedEvidence = [preparation.evidence, ...workflowDocuments].join(
    "\n",
  );
  return {
    engineeringRequest,
    ledger: preparation.ledger,
    stagingDir: preparation.stagingDir,
    prompt: buildPreparedGoalPrompt(
      engineeringRequest,
      preparedEvidence,
      intentRoutingGuidance,
      stage,
    ),
    dimensions,
    intentRoutingGuidance,
    stage,
    durationMs: performance.now() - started,
  };
}

async function gitStatus(repoDir: string): Promise<string> {
  const { stdout, stderr, code } = await captureProcess(
    ["git", "status", "--porcelain=v1", "--untracked-files=all"],
    repoDir,
  );
  if (code !== 0)
    throw new Error(`cannot inspect preflight changes: ${stderr.trim()}`);
  return stdout;
}

/** Positional `HarnessAdapter.run` arguments, bundled for this adapter. */
interface CodexGoalRunOptions {
  repoDir: string;
  prompt: string;
  model: string;
  effort: string;
  control?: { expectedGoalRoute?: GoalRoute };
}

async function startAppServerClient(repoDir: string): Promise<AppServerClient> {
  const env = await isolatedHarnessEnvironment("codex", repoDir);
  const argv = await sandboxedAgentCommand(
    ["codex", "app-server", "--stdio"],
    repoDir,
  );
  const proc = Bun.spawn(argv, {
    cwd: repoDir,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...env,
      PATH: `${join(repoDir, ".git", "fixture-bin")}:${env.PATH ?? ""}`,
    },
  });
  return new AppServerClient(proc);
}

async function initializeAppServer(client: AppServerClient): Promise<void> {
  await client.request("initialize", {
    clientInfo: {
      name: "darrow_eval",
      title: "Darrow Eval",
      version: "1.0.0",
    },
  });
  client.notify("initialized", {});
}

async function fetchModelCatalog(
  client: AppServerClient,
): Promise<CatalogRoute[]> {
  const models = await client.request<ModelListResult>("model/list", {
    limit: 100,
    includeHidden: true,
  });
  return models.data.map((entry) => ({
    model: entry.model,
    efforts: entry.supportedReasoningEfforts.map(
      (option) => option.reasoningEffort,
    ),
  }));
}

async function startGoalThread(
  client: AppServerClient,
  repoDir: string,
  model: string,
): Promise<string> {
  const thread = await client.request<ThreadStartResult>("thread/start", {
    model,
    modelProvider: "openai",
    cwd: repoDir,
    approvalPolicy: "never",
    ephemeral: false,
  });
  return thread.thread.id;
}

/**
 * A prepared preflight may spend exactly one model call and no tool call;
 * anything else means the classifier turn escaped its read-only budget.
 */
function assertPreflightDiscipline(
  client: AppServerClient,
  turnId: string,
): number {
  const modelCalls = client.matching((message) =>
    isTokenUsageUpdate(message, turnId),
  );
  const toolCalls = client.matching(
    (message) =>
      message.method === "item/completed" &&
      message.params?.turnId === turnId &&
      /tool|command/i.test(message.params?.item?.type ?? ""),
  );
  if (modelCalls.length !== 1 || toolCalls.length !== 0)
    throw new Error(
      `prepared preflight used ${modelCalls.length} model calls and ${toolCalls.length} tool calls`,
    );
  return modelCalls.length;
}

interface PreflightTurnOptions {
  client: AppServerClient;
  threadId: string;
  prepared: PreparedGoalPreflight;
  run: CodexGoalRunOptions;
}

async function runPreflightTurn(
  options: PreflightTurnOptions,
): Promise<{ result: TurnOutcome; modelCalls: number }> {
  const { client, threadId, prepared, run } = options;
  const preflight = await client.request<TurnStartResult>("turn/start", {
    threadId,
    input: [{ type: "text", text: prepared.prompt }],
    cwd: run.repoDir,
    approvalPolicy: "never",
    sandboxPolicy: { type: "readOnly", networkAccess: false },
    model: run.model,
    effort: run.effort,
    outputSchema: handoffSchema([...prepared.dimensions.routes.keys()]),
  });
  const turnId = preflight.turn.id;
  const result = await runTurn(client, turnId);
  return { result, modelCalls: assertPreflightDiscipline(client, turnId) };
}

function assertControlRoute(selected: GoalRoute, expected?: GoalRoute): void {
  if (expected && !sameGoalRoute(selected, expected))
    throw new Error(
      `selected route does not match evaluation control: expected ${expected.harness}/${expected.provider}/${expected.model}/${expected.effort}`,
    );
}

function ledgerRoute(route: GoalRoute): string {
  return [route.harness, route.provider, route.model, route.effort].join("|");
}

async function recordLedgerRoute(
  repoDir: string,
  ledger: string,
  handoff: GoalHandoff,
): Promise<void> {
  const helper = join(repoDir, ".agents", "bin", "goal-loop");
  const argv = [
    "bash",
    helper,
    "step",
    "route",
    "--ledger",
    ledger,
    "--workflow",
    handoff.workflow,
    "--risk",
    handoff.risk,
    "--profile",
    handoff.profile,
    "--verification-gate",
    handoff.workflow === "decision-gated" ? "not-applicable" : handoff.risk,
    "--readiness",
    handoff.readinessGate.selection,
    "--review",
    handoff.independentReview.selection,
  ];
  if (handoff.independentReview.roundLimit !== undefined)
    argv.push(
      "--review-round-limit",
      String(handoff.independentReview.roundLimit),
    );
  if (handoff.routeSource === "user")
    argv.push("--route", ledgerRoute(handoff.selectedRoute));
  const result = await captureProcess(argv, repoDir);
  if (result.code !== 0)
    throw new Error(`goal route recording failed: ${result.stderr.trim()}`);
  const selected = requiredStepRecord(result.stdout, "selected_route");
  const expected =
    handoff.workflow === "decision-gated"
      ? "none"
      : ledgerRoute(handoff.selectedRoute);
  if (selected !== expected)
    throw new Error("goal ledger route does not match the handoff");
}

interface PreflightPhase {
  threadId: string;
  prepared: PreparedGoalPreflight;
  handoff: GoalHandoff;
  result: TurnOutcome;
  modelCalls: number;
  readinessAvailable: boolean;
  reviewAvailable: boolean;
}

async function installedSkillDescriptions(repoDir: string): Promise<string[]> {
  const root = join(repoDir, ".agents", "skills");
  let names: string[];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    names = entries
      .filter((entry) => entry.isDirectory() && entry.name !== "adaptive-goal")
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  const descriptions = await Promise.all(
    names.map(async (name) => {
      let skill: string;
      try {
        skill = await readFile(join(root, name, "SKILL.md"), "utf8");
      } catch {
        return "";
      }
      const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      return frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
    }),
  );
  return descriptions;
}

export async function independentReviewCapabilityAvailable(
  repoDir: string,
): Promise<boolean> {
  const descriptions = await installedSkillDescriptions(repoDir);
  return descriptions.some((description) =>
    [
      /\bindependent(?:ly)?\b/i,
      /\breview\b/i,
      /\b(?:code|change|fix)\b/i,
    ].every((pattern) => pattern.test(description)),
  );
}

export async function implementationReadinessCapabilityAvailable(
  repoDir: string,
): Promise<boolean> {
  const descriptions = await installedSkillDescriptions(repoDir);
  return descriptions.some((description) =>
    [
      /\bimplementation[- ]readiness\b/i,
      /\b(?:assess|assessment|ready)\b/i,
      /\b(?:ticket|specification|plan|request)\b/i,
    ].every((pattern) => pattern.test(description)),
  );
}

async function runGoalPreflightPhase(
  client: AppServerClient,
  run: CodexGoalRunOptions,
): Promise<PreflightPhase> {
  await initializeAppServer(client);
  const catalog = await fetchModelCatalog(client);
  const threadId = await startGoalThread(client, run.repoDir, run.model);
  const beforePreflight = await gitStatus(run.repoDir);
  const prepared = await prepareGoalPreflight(run.repoDir, run.prompt);
  const preflight = await runPreflightTurn({
    client,
    threadId,
    prepared,
    run,
  });
  if ((await gitStatus(run.repoDir)) !== beforePreflight)
    throw new Error("goal preflight modified the fixture before activation");
  const handoff = parseCodexGoalHandoff(
    preflight.result.text,
    catalog,
    prepared.dimensions,
    {
      route: parseExplicitUserRoute(run.prompt),
      reviewRoundLimit: parseExplicitReviewRoundLimit(run.prompt),
      ledger: prepared.ledger,
      goalLoop: join(run.repoDir, ".agents", "bin", "goal-loop"),
    },
  );
  if (handoff.workflow !== "decision-gated")
    assertControlRoute(handoff.selectedRoute, run.control?.expectedGoalRoute);
  await recordLedgerRoute(run.repoDir, prepared.ledger, handoff);
  const readinessAvailable =
    handoff.readinessGate.selection !== "selected" ||
    (await implementationReadinessCapabilityAvailable(run.repoDir));
  const reviewAvailable =
    handoff.independentReview.selection !== "selected" ||
    (await independentReviewCapabilityAvailable(run.repoDir));
  return {
    threadId,
    prepared,
    handoff,
    readinessAvailable,
    reviewAvailable,
    ...preflight,
  };
}

interface ExecutionTurnOptions {
  client: AppServerClient;
  threadId: string;
  repoDir: string;
  prompt: string;
  route: GoalRoute;
}

interface ExecutionTurnStart {
  turnId: string;
  eventCursor: number;
}

async function startExecutionTurn(
  options: ExecutionTurnOptions,
): Promise<ExecutionTurnStart> {
  const eventCursor = options.client.cursor();
  const execution = await options.client.request<TurnStartResult>(
    "turn/start",
    {
      threadId: options.threadId,
      input: [{ type: "text", text: options.prompt }],
      cwd: options.repoDir,
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
      model: options.route.model,
      effort: options.route.effort,
    },
  );
  return { turnId: execution.turn.id, eventCursor };
}

interface GoalEvidenceOptions {
  client: AppServerClient;
  threadId: string;
  turnId: string;
  phase: PreflightPhase;
  workflow: WorkflowEntry;
  workflowSha256: string;
}

function recordGoalEvidence(options: GoalEvidenceOptions): void {
  const { client, threadId, turnId, phase } = options;
  const handoff = phase.handoff;
  client.record({
    type: "darrow.route_applied",
    accepted: true,
    threadId,
    turnId,
    selected: handoff.selectedRoute,
    effective: handoff.selectedRoute,
    appliedBy: "host-api",
  });
  client.record({
    type: "darrow.dimensions_applied",
    accepted: true,
    threadId,
    turnId,
    stage: phase.prepared.stage,
    workflow: handoff.workflow,
    risk: handoff.risk,
  });
  client.record({
    type: "darrow.workflow_loaded",
    accepted: true,
    threadId,
    turnId,
    workflow: handoff.workflow,
    file: options.workflow.file,
    sha256: options.workflowSha256,
  });
}

async function assertGoalOutcome(
  client: AppServerClient,
  threadId: string,
): Promise<"complete" | "blocked" | "active" | "paused"> {
  const goal = await client.request<GoalGetResult>("thread/goal/get", {
    threadId,
  });
  const status = goal.goal?.status;
  if (!isReportableGoalStatus(status) && !isResumableGoalStatus(status))
    throw new Error(`native goal ended as ${status ?? "missing"}`);
  return status;
}

async function recordLedgerActivation(
  repoDir: string,
  ledger: string,
  route: GoalRoute,
): Promise<void> {
  const helper = join(repoDir, ".agents", "bin", "goal-loop");
  const effective = [
    route.harness,
    route.provider,
    route.model,
    route.effort,
  ].join("|");
  const result = await captureProcess(
    [
      "bash",
      helper,
      "step",
      "activate",
      "--ledger",
      ledger,
      "--applied-by",
      "host-api",
      "--boundary",
      "host_api",
      "--agent-id",
      "none",
      "--effective-route",
      effective,
      "--route-verified",
      "true",
    ],
    repoDir,
  );
  if (result.code !== 0)
    throw new Error(
      `goal activation recording failed: ${result.stderr.trim()}`,
    );
}

async function renderLedgerReport(
  repoDir: string,
  ledger: string,
  status: "complete" | "blocked" | "launch-required",
  humanInterruptions = 0,
): Promise<string> {
  const helper = join(repoDir, ".agents", "bin", "goal-loop");
  const result = await captureProcess(
    [
      "bash",
      helper,
      "step",
      "report",
      "--ledger",
      ledger,
      "--status",
      status,
      "--human-interruptions",
      String(humanInterruptions),
    ],
    repoDir,
  );
  if (result.code !== 0)
    throw new Error(`goal report rendering failed: ${result.stderr.trim()}`);
  return result.stdout.trimEnd();
}

async function recordPreActivationStop(
  repoDir: string,
  ledger: string,
  reason: "readiness-unavailable" | "review-unavailable" | "launch-unavailable",
): Promise<void> {
  const helper = join(repoDir, ".agents", "bin", "goal-loop");
  const result = await captureProcess(
    [
      "bash",
      helper,
      "step",
      "launch-stop",
      "--ledger",
      ledger,
      "--reason",
      reason,
    ],
    repoDir,
  );
  if (result.code !== 0)
    throw new Error(
      `goal launch stop recording failed: ${result.stderr.trim()}`,
    );
}

export function stripModelAuthoredGoalReports(text: string): string {
  const lines = text.split(/\r?\n/);
  const retained: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const report = GOAL_REPORT_KEYS.every((key, offset) => {
      const line = lines[index + offset]?.trim();
      const prefix = `${key}: `;
      return line?.startsWith(prefix) && line.length > prefix.length;
    });
    if (
      report &&
      lines[index]!.trim() === "format: darrow-native-goal-report-v1"
    ) {
      index += GOAL_REPORT_KEYS.length - 1;
      continue;
    }
    retained.push(lines[index]!);
  }
  return retained.join("\n").trim();
}

export function composeGoalExecutionResult(
  report: string,
  ownerText: string,
  readinessVerdict: string,
): string {
  const ownerResult = stripModelAuthoredGoalReports(ownerText);
  const nonReady = isNonReadyReadinessVerdict(readinessVerdict);
  const readinessResult = parseImplementationReadinessResult(ownerResult);
  if (
    nonReady &&
    (!readinessResult || readinessResult.verdict !== readinessVerdict)
  )
    throw new Error(
      "non-ready owner result omitted a complete matching implementation-readiness result",
    );
  const orderedResult = nonReady
    ? [ownerResult, report]
    : [report, ownerResult];
  return orderedResult.filter(Boolean).join("\n\n");
}

function recordObjectiveEvidence(
  client: AppServerClient,
  handoff: GoalHandoff,
  materialized: MaterializedGoalObjective,
): void {
  client.record({
    type: "darrow.goal_objective_materialized",
    mode: materialized.mode,
    contractBytes: Buffer.byteLength(handoff.goalContract),
    objectiveBytes: Buffer.byteLength(materialized.objective),
  });
}

function recordRetainedObjective(
  client: AppServerClient,
  threadId: string,
  attachment: GoalAttachmentRelease | undefined,
): void {
  if (!attachment) return;
  client.record({
    type: "darrow.goal_objective_retained",
    threadId,
    mode: "file-backed",
    reason: "goal_terminal_status_unconfirmed",
    attachmentDir: attachment.attachmentDir,
    contractSha256: attachment.contractSha256,
  });
}

export async function withMaterializedGoalLifecycle<T>(
  materialized: MaterializedGoalObjective,
  execute: (confirmTerminal: () => void) => Promise<T>,
  recordRetention: (attachment: GoalAttachmentRelease | undefined) => void,
): Promise<T> {
  let terminalConfirmed = false;
  let result: T;
  try {
    result = await execute(() => {
      terminalConfirmed = true;
    });
  } catch (error) {
    if (terminalConfirmed) await materialized.cleanup();
    else recordRetention(materialized.attachment);
    throw error;
  }
  if (terminalConfirmed) await materialized.cleanup();
  else recordRetention(materialized.attachment);
  return result;
}

interface GoalWorkflowEvidence {
  workflow: WorkflowEntry;
  content: string;
  sha256: string;
}

async function loadGoalWorkflowEvidence(
  phase: PreflightPhase,
): Promise<GoalWorkflowEvidence> {
  const workflow = phase.prepared.dimensions.workflows.get(
    phase.handoff.workflow,
  )!;
  const content = await readFile(workflow.file, "utf8");
  const sha256 = new Bun.CryptoHasher("sha256").update(content).digest("hex");
  return { workflow, content, sha256 };
}

export function authorizedFeedbackAnswerCommand(
  engineeringRequest: string,
  feedbackId: string,
): string[] | undefined {
  if (!/^[A-Za-z0-9._-]+$/.test(feedbackId)) return undefined;
  const match = engineeringRequest.match(
    /(?:`|\b)([A-Za-z0-9_./-]+)\s+answer\s+<reported-id>(?:`|\b)/,
  );
  return match ? [match[1]!, "answer", feedbackId] : undefined;
}

async function runAuthorizedFeedbackAnswer(
  repoDir: string,
  argv: string[],
): Promise<string> {
  const env = await isolatedHarnessEnvironment("codex", repoDir);
  env.PATH = `${join(repoDir, ".git", "fixture-bin")}:${env.PATH ?? ""}`;
  env.CODEX_THREAD_ID = "darrow-goal-host-parent";
  const process = Bun.spawn(argv, {
    cwd: repoDir,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  const answer = stdout.trim();
  if (code !== 0)
    throw new Error(`authorized feedback answer failed: ${stderr.trim()}`);
  if (!answer || /[\r\n]/.test(answer))
    throw new Error("authorized feedback answer must be one non-empty line");
  return answer;
}

interface GoalOwnerTurnContext {
  client: AppServerClient;
  repoDir: string;
  phase: PreflightPhase;
  workflow: GoalWorkflowEvidence;
}

interface GoalOwnerTurnState {
  result: TurnOutcome;
  status: "complete" | "blocked" | "active" | "paused";
  humanInterruptions: number;
}

interface GoalOwnerTurnOutcome extends GoalOwnerTurnState {
  durationMs: number;
}

function completeNonReadyResult(
  client: AppServerClient,
  threadId: string,
  current: GoalOwnerTurnState,
): string {
  const result = current.result.text
    .trimStart()
    .startsWith("## Implementation readiness")
    ? current.result.text
    : client.latestImplementationReadinessResult(threadId);
  if (!result)
    throw new Error(
      "non-ready owner result omitted the complete implementation-readiness result",
    );
  return result;
}

function goalOwnerPrompt(context: GoalOwnerTurnContext): string {
  return buildGoalExecutionPrompt(
    context.phase.handoff,
    context.workflow.content,
    context.phase.prepared.intentRoutingGuidance,
  );
}

async function settleNonReadyReadiness(
  context: GoalOwnerTurnContext,
  confirmTerminal: () => void,
  current: GoalOwnerTurnState,
): Promise<GoalOwnerTurnState> {
  const { client, repoDir, phase } = context;
  const { threadId, handoff, prepared } = phase;
  const verdict = await ledgerReadinessVerdict(prepared.ledger);
  if (!isNonReadyReadinessVerdict(verdict)) return current;
  const readinessResult = completeNonReadyResult(client, threadId, current);
  if (current.status === "complete")
    throw new Error(
      "non-ready readiness verdict settled the native goal complete",
    );
  if (current.status === "blocked")
    return {
      ...current,
      result: { ...current.result, text: readinessResult },
    };

  const settlement = await startExecutionTurn({
    client,
    threadId,
    repoDir,
    prompt: readinessStatusSettlementPrompt(verdict),
    route: handoff.selectedRoute,
  });
  client.record({
    type: "darrow.readiness_status_settlement",
    verdict,
    thread_id: threadId,
    same_owner: true,
  });
  const result = await runNativeGoal(
    client,
    {
      threadId,
      turnId: settlement.turnId,
      eventCursor: settlement.eventCursor,
    },
    confirmTerminal,
  );
  const status = await assertGoalOutcome(client, threadId);
  if (status !== "blocked")
    throw new Error(`non-ready readiness settlement ended as ${status}`);
  return {
    result: { ...result, text: readinessResult },
    status,
    humanInterruptions: current.humanInterruptions,
  };
}

async function relayGoalFeedback(
  context: GoalOwnerTurnContext,
  confirmTerminal: () => void,
  current: GoalOwnerTurnState,
): Promise<GoalOwnerTurnState> {
  if (!isResumableGoalStatus(current.status)) return current;
  const { client, repoDir, phase } = context;
  const { threadId, handoff, prepared } = phase;
  const feedbackId = client.latestFeedbackRequestId(threadId);
  const argv = feedbackId
    ? authorizedFeedbackAnswerCommand(prepared.engineeringRequest, feedbackId)
    : undefined;
  if (!argv || !feedbackId) return current;
  const answer = await runAuthorizedFeedbackAnswer(repoDir, argv);
  client.record({
    type: "darrow.human_feedback_answer",
    feedback_id: feedbackId,
    answer,
    status: "completed",
  });
  const resumed = await startExecutionTurn({
    client,
    threadId,
    repoDir,
    prompt: `- phase: human-feedback-response\n${answer}`,
    route: handoff.selectedRoute,
  });
  client.record({
    type: "darrow.human_feedback_relay",
    feedback_id: feedbackId,
    thread_id: threadId,
    same_owner: true,
  });
  const result = await runNativeGoal(
    client,
    { threadId, turnId: resumed.turnId, eventCursor: resumed.eventCursor },
    confirmTerminal,
  );
  const status = await assertGoalOutcome(client, threadId);
  if (!isReportableGoalStatus(status))
    throw new Error("native goal requested unresolved feedback twice");
  return { result, status, humanInterruptions: 1 };
}

async function runGoalOwnerTurn(
  context: GoalOwnerTurnContext,
  confirmTerminal: () => void,
): Promise<GoalOwnerTurnOutcome> {
  const { client, repoDir, phase, workflow } = context;
  const { threadId, handoff, prepared } = phase;
  const started = performance.now();
  const execution = await startExecutionTurn({
    client,
    threadId,
    repoDir,
    prompt: goalOwnerPrompt(context),
    route: handoff.selectedRoute,
  });
  await recordLedgerActivation(repoDir, prepared.ledger, handoff.selectedRoute);
  recordGoalEvidence({
    client,
    threadId,
    turnId: execution.turnId,
    phase,
    workflow: workflow.workflow,
    workflowSha256: workflow.sha256,
  });
  const result = await runNativeGoal(
    client,
    {
      threadId,
      turnId: execution.turnId,
      eventCursor: execution.eventCursor,
      readinessLedger: prepared.ledger,
    },
    confirmTerminal,
  );
  const status = await assertGoalOutcome(client, threadId);
  const settledReadiness = await settleNonReadyReadiness(
    context,
    confirmTerminal,
    { result, status, humanInterruptions: 0 },
  );
  const final = await relayGoalFeedback(
    context,
    confirmTerminal,
    settledReadiness,
  );
  const durationMs = performance.now() - started;
  return { ...final, durationMs };
}

async function runGoalExecutionPhase(
  client: AppServerClient,
  repoDir: string,
  phase: PreflightPhase,
): Promise<{ result: TurnOutcome; durationMs: number }> {
  const { threadId, handoff, prepared } = phase;
  const workflow = await loadGoalWorkflowEvidence(phase);
  const materialized = await activateMaterializedGoal(client, {
    repoDir,
    threadId,
    goalContract: handoff.goalContract,
    ledger: prepared.ledger,
    stagingDir: prepared.stagingDir,
  });
  recordObjectiveEvidence(client, handoff, materialized);
  const execution = await withMaterializedGoalLifecycle(
    materialized,
    (confirmTerminal) =>
      runGoalOwnerTurn({ client, repoDir, phase, workflow }, confirmTerminal),
    (attachment) => recordRetainedObjective(client, threadId, attachment),
  );
  if (isReportableGoalStatus(execution.status)) {
    const report = await renderLedgerReport(
      repoDir,
      prepared.ledger,
      execution.status,
      execution.humanInterruptions,
    );
    client.record({
      type: "darrow.goal_report_rendered",
      ledger: prepared.ledger,
      status: execution.status,
      enforcement: "helper",
    });
    const readinessVerdict = await ledgerReadinessVerdict(prepared.ledger);
    execution.result = {
      ...execution.result,
      text: composeGoalExecutionResult(
        report,
        execution.result.text,
        readinessVerdict,
      ),
    };
  }
  return { result: execution.result, durationMs: execution.durationMs };
}

type CodexGoalOutcome = Omit<HarnessResult, "ok" | "durationMs">;
type PreflightStopReason =
  "decision-gated" | "readiness-unavailable" | "review-unavailable";

function preflightOnlyMetrics(
  preflight: PreflightPhase,
  usage: TokenUsageTotals,
  executionDurationMs: number,
) {
  return {
    preparation: { durationMs: preflight.prepared.durationMs },
    classifier: {
      durationMs: preflight.result.durationMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      modelCalls: preflight.modelCalls,
    },
    execution: {
      durationMs: executionDurationMs,
      inputTokens: 0,
      outputTokens: 0,
    },
  };
}

async function preflightStopOutcome(
  client: AppServerClient,
  repoDir: string,
  preflight: PreflightPhase,
  reason: PreflightStopReason,
): Promise<CodexGoalOutcome> {
  const started = performance.now();
  if (reason !== "decision-gated")
    await recordPreActivationStop(repoDir, preflight.prepared.ledger, reason);
  const report = await renderLedgerReport(
    repoDir,
    preflight.prepared.ledger,
    "launch-required",
    reason === "decision-gated" ? 1 : 0,
  );
  client.record({
    type: "darrow.goal_report_rendered",
    ledger: preflight.prepared.ledger,
    status: "launch-required",
    enforcement: "helper",
  });
  const usage = turnTokenTotals(preflight.result);
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: null,
    resultText: [
      report,
      reason === "decision-gated" ? preflight.handoff.goalContract : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    raw: client.raw(),
    phaseMetrics: preflightOnlyMetrics(
      preflight,
      usage,
      performance.now() - started,
    ),
  };
}

function preflightStopReason(
  preflight: PreflightPhase,
): PreflightStopReason | undefined {
  if (preflight.handoff.workflow === "decision-gated") return "decision-gated";
  if (!preflight.readinessAvailable) return "readiness-unavailable";
  if (!preflight.reviewAvailable) return "review-unavailable";
  return undefined;
}

async function executeCodexGoal(
  client: AppServerClient,
  run: CodexGoalRunOptions,
): Promise<CodexGoalOutcome> {
  const preflight = await runGoalPreflightPhase(client, run);
  const stopReason = preflightStopReason(preflight);
  if (stopReason)
    return preflightStopOutcome(client, run.repoDir, preflight, stopReason);
  const execution = await runGoalExecutionPhase(client, run.repoDir, preflight);
  // This adapter creates a fresh thread per trial. The final cumulative
  // total therefore covers every model call in both turns without double
  // counting the preflight usage.
  const usage = turnTokenTotals(execution.result);
  const classifierUsage = turnTokenTotals(preflight.result);
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: null,
    resultText: execution.result.text,
    raw: client.raw(),
    phaseMetrics: {
      preparation: { durationMs: preflight.prepared.durationMs },
      classifier: {
        durationMs: preflight.result.durationMs,
        inputTokens: classifierUsage.inputTokens,
        outputTokens: classifierUsage.outputTokens,
        modelCalls: preflight.modelCalls,
      },
      execution: {
        durationMs: execution.durationMs,
        inputTokens: usage.inputTokens - classifierUsage.inputTokens,
        outputTokens: usage.outputTokens - classifierUsage.outputTokens,
      },
    },
  };
}

async function runCodexGoalTrial(
  run: CodexGoalRunOptions,
): Promise<HarnessResult> {
  const start = performance.now();
  const client = await startAppServerClient(run.repoDir);
  try {
    const outcome = await executeCodexGoal(client, run);
    return { ok: true, durationMs: performance.now() - start, ...outcome };
  } catch (error) {
    return {
      ok: false,
      durationMs: performance.now() - start,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      resultText: "",
      raw: `${client.raw()}\n${error instanceof Error ? error.stack : String(error)}`,
    };
  } finally {
    await client.close();
  }
}

export const codexGoalAdapter: HarnessAdapter = {
  name: "codex",
  defaultModel: "gpt-5.6-terra",
  skillMounts: [".agents/skills"],

  async version(): Promise<string> {
    const proc = Bun.spawn(["codex", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return out.trim();
  },

  // `HarnessAdapter.run` fixes the positional arity for every adapter, so this
  // adapter accepts the shared tuple and forwards it as one named options
  // object instead of threading five positional parameters through the run.
  run(
    ...positional: Parameters<HarnessAdapter["run"]>
  ): Promise<HarnessResult> {
    const [repoDir, prompt, model, effort, control] = positional;
    return runCodexGoalTrial({ repoDir, prompt, model, effort, control });
  },
};
