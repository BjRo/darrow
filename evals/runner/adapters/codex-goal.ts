import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { GoalRoute, HarnessAdapter, HarnessResult } from "../types";
import { isolatedHarnessEnvironment } from "../environment";
import { sandboxedAgentCommand } from "../sandbox";

interface CatalogRoute {
  model: string;
  efforts: string[];
}

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
  format: "darrow-native-goal-handoff-v3";
  workflow: GoalWorkflow;
  risk: GoalRisk;
  profile: string;
  routeSource: "policy" | "user";
  selectedRoute: GoalRoute;
  goalContract: string;
}

interface WorkflowEntry {
  file: string;
}
interface RiskEntry {
  verification: string;
}
export interface PreparedGoalDimensions {
  routes: Map<string, GoalRoute>;
  workflows: Map<string, WorkflowEntry>;
  risks: Map<string, RiskEntry>;
}

export function parsePreparedGoalDimensions(
  text: string,
): PreparedGoalDimensions {
  const dimensions: PreparedGoalDimensions = {
    routes: new Map(),
    workflows: new Map(),
    risks: new Map(),
  };
  for (const rawLine of text.split("\n")) {
    const fields = rawLine.split("\t");
    const [kind, id] = fields;
    if (!id || !/^[a-z0-9-]+$/.test(id)) continue;
    if (kind === "route") {
      if (
        fields.length !== 6 ||
        !fields[2] ||
        !fields[3] ||
        !fields[4] ||
        !fields[5]
      )
        throw new Error(`invalid route row: ${rawLine}`);
      if (dimensions.routes.has(id)) throw new Error(`duplicate route: ${id}`);
      dimensions.routes.set(id, {
        harness: fields[2],
        provider: fields[3],
        model: fields[4],
        effort: fields[5],
      });
    } else if (kind === "workflow") {
      const file = fields[2];
      if (
        fields.length !== 3 ||
        !file ||
        !isAbsolute(file) ||
        !file.endsWith(`/references/workflows/${id}.md`)
      )
        throw new Error(`invalid workflow row: ${rawLine}`);
      if (dimensions.workflows.has(id))
        throw new Error(`duplicate workflow: ${id}`);
      dimensions.workflows.set(id, { file });
    } else if (kind === "risk") {
      if (fields.length !== 3 || !fields[2])
        throw new Error(`invalid risk row: ${rawLine}`);
      if (dimensions.risks.has(id)) throw new Error(`duplicate risk: ${id}`);
      dimensions.risks.set(id, { verification: fields[2] });
    }
  }
  if (
    !dimensions.routes.size ||
    !dimensions.workflows.size ||
    !dimensions.risks.size
  )
    throw new Error("prepared goal dimensions are incomplete");
  return dimensions;
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
  const candidatePolicy = /^route\troutine\t/m.test(preparedEvidence);
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
    "An evaluation_expected_route record is enclosing-harness metadata, not a user override. Select the policy profile whose concrete route matches it; a mismatch must fail rather than be silently attributed to preflight.",
    "Select risk and profile independently: risk reflects the cost of an incorrect result, while routing reflects the kind and scale of reasoning required. Risk alone and a workflow label alone do not determine profile.",
    candidatePolicy
      ? "Map ordinary-localized to routine (Luna/high), scaled-coding to scaled (Terra/medium), repo-wide-coding to repo-wide (Terra/high), and judgment to judgment (Sol/high). Use routine-plus (Luna/xhigh) only when the request specifically makes its additional quality worthwhile."
      : "Under the current baseline, map an exact mechanical transformation with a complete oracle and no substantive reasoning to fast; map ordinary-localized and scaled-coding to standard; and map repo-wide-coding and judgment to deep.",
    "",
    "The goalContract must stay within 4,000 bytes and preserve the outcome, acceptance criteria, scope, repository instructions, local work, publication boundary, selected workflow, risk gate, profile, and route. Finish with this record:",
    "format\tdarrow-native-goal-preflight-v4",
    "workflow\t<selected-workflow>",
    "risk\t<selected-risk>",
    "profile\t<selected-profile>",
    "selected_route\t<harness>\t<provider>\t<model>\t<effort>",
    "effective_route\t<harness>\t<provider>\t<model>\t<effort>",
    "route_applied_by\thost-api",
    "route_verified\ttrue",
    "launch_boundary\thost_api",
    "verification_gate\t<selected-risk>",
    "evaluation_child_invocations\t0",
    "evaluation_human_interruptions\t0",
    "",
    "Return only a darrow-native-goal-handoff-v3 object with workflow, risk, profile, routeSource, selectedRoute, and goalContract.",
    "",
    "Prepared evidence:",
    preparedEvidence,
    "",
    "Engineering request:",
    engineeringRequest,
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

export function parseCodexGoalHandoff(
  text: string,
  catalog: CatalogRoute[],
  dimensions: PreparedGoalDimensions,
  explicitUserRoute?: GoalRoute,
): GoalHandoff {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("preflight did not return one JSON handoff");
  }
  if (!value || typeof value !== "object")
    throw new Error("preflight handoff is not an object");
  const handoff = value as Partial<GoalHandoff>;
  const route = handoff.selectedRoute;
  if (
    handoff.format !== "darrow-native-goal-handoff-v3" ||
    typeof handoff.workflow !== "string" ||
    typeof handoff.risk !== "string" ||
    typeof handoff.profile !== "string" ||
    !dimensions.routes.has(handoff.profile) ||
    !["policy", "user"].includes(handoff.routeSource ?? "") ||
    !route ||
    route.harness !== "codex" ||
    route.provider !== "openai" ||
    typeof route.model !== "string" ||
    typeof route.effort !== "string" ||
    typeof handoff.goalContract !== "string" ||
    handoff.goalContract.length === 0 ||
    Buffer.byteLength(handoff.goalContract) > 4000
  )
    throw new Error("preflight handoff has an invalid shape");
  if (!dimensions.workflows.has(handoff.workflow))
    throw new Error(`unknown workflow: ${handoff.workflow}`);
  if (!dimensions.risks.has(handoff.risk))
    throw new Error(`unknown risk: ${handoff.risk}`);
  const model = catalog.find((entry) => entry.model === route.model);
  if (!model) throw new Error(`unavailable selected model: ${route.model}`);
  if (!model.efforts.includes(route.effort))
    throw new Error(
      `unsupported selected effort for ${route.model}: ${route.effort}`,
    );
  if (handoff.profile === "fast" && handoff.workflow !== "mechanical")
    throw new Error("fast profile requires a mechanical workflow");
  if (handoff.routeSource === "policy") {
    const expected = dimensions.routes.get(handoff.profile)!;
    if (
      route.harness !== expected.harness ||
      route.provider !== expected.provider ||
      route.model !== expected.model ||
      route.effort !== expected.effort
    )
      throw new Error(
        `selected route does not match ${handoff.profile} policy: expected ${expected.model}/${expected.effort}`,
      );
  }
  if (
    handoff.routeSource === "user" &&
    (!explicitUserRoute ||
      route.harness !== explicitUserRoute.harness ||
      route.provider !== explicitUserRoute.provider ||
      route.model !== explicitUserRoute.model ||
      route.effort !== explicitUserRoute.effort)
  )
    throw new Error("user-sourced handoff has no matching explicit user route");
  const routeRecord = [
    route.harness,
    route.provider,
    route.model,
    route.effort,
  ].join("\t");
  const requiredContractLines = [
    "format\tdarrow-native-goal-preflight-v4",
    `workflow\t${handoff.workflow}`,
    `risk\t${handoff.risk}`,
    `profile\t${handoff.profile}`,
    `selected_route\t${routeRecord}`,
    `effective_route\t${routeRecord}`,
    "route_applied_by\thost-api",
    "route_verified\ttrue",
    "launch_boundary\thost_api",
    `verification_gate\t${handoff.risk}`,
    "evaluation_child_invocations\t0",
    "evaluation_human_interruptions\t0",
  ];
  if (
    !requiredContractLines.every((line) =>
      handoff.goalContract!.split("\n").includes(line),
    )
  )
    throw new Error("goal contract does not preserve handoff and final record");
  return handoff as GoalHandoff;
}

function handoffSchema(profiles: string[]) {
  return {
    type: "object",
    properties: {
      format: { type: "string", const: "darrow-native-goal-handoff-v3" },
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
      profile: { type: "string", enum: profiles },
      routeSource: { type: "string", enum: ["policy", "user"] },
      selectedRoute: {
        type: "object",
        properties: {
          harness: { type: "string", const: "codex" },
          provider: { type: "string", const: "openai" },
          model: { type: "string", minLength: 1 },
          effort: { type: "string", minLength: 1 },
        },
        required: ["harness", "provider", "model", "effort"],
        additionalProperties: false,
      },
      goalContract: { type: "string", minLength: 1, maxLength: 4000 },
    },
    required: [
      "format",
      "workflow",
      "risk",
      "profile",
      "routeSource",
      "selectedRoute",
      "goalContract",
    ],
    additionalProperties: false,
  };
}

class AppServerClient {
  private nextId = 1;
  private messages: any[] = [];
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (reason: Error) => void }
  >();
  private waiters: Array<{
    predicate: (message: any) => boolean;
    resolve: (message: any) => void;
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

  private receive(line: string): void {
    if (!line.trim()) return;
    this.rawLines.push(line);
    let message: any;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    this.messages.push(message);
    if (typeof message.id === "number" && this.pending.has(message.id)) {
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

  request(method: string, params: unknown): Promise<any> {
    const id = this.nextId++;
    this.proc.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    this.proc.stdin.flush();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  waitFor(
    predicate: (message: any) => boolean,
    timeoutMs = 30 * 60 * 1000,
  ): Promise<any> {
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

  latest(predicate: (message: any) => boolean): any | undefined {
    return this.messages.findLast(predicate);
  }

  matching(predicate: (message: any) => boolean): any[] {
    return this.messages.filter(predicate);
  }

  record(message: unknown): void {
    this.rawLines.push(JSON.stringify(message));
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

export function isFinalAgentMessage(message: any, turnId: string): boolean {
  return (
    message.method === "item/completed" &&
    message.params?.turnId === turnId &&
    message.params?.item?.type === "agentMessage" &&
    message.params?.item?.phase === "final_answer"
  );
}

function finalMessage(
  client: AppServerClient,
  turnId: string,
): Promise<string> {
  return client
    .waitFor((message) => isFinalAgentMessage(message, turnId))
    .then((message) => message.params.item.text as string);
}

async function completedTurn(
  client: AppServerClient,
  turnId: string,
): Promise<any> {
  const message = await client.waitFor(
    (candidate) =>
      candidate.method === "turn/completed" &&
      candidate.params?.turn?.id === turnId,
  );
  if (message.params.turn.status !== "completed")
    throw new Error(`Codex turn ended as ${message.params.turn.status}`);
  return message;
}

function turnUsage(client: AppServerClient, turnId: string): Promise<any> {
  return client.waitFor(
    (message) =>
      message.method === "thread/tokenUsage/updated" &&
      message.params?.turnId === turnId,
  );
}

async function runTurn(
  client: AppServerClient,
  turnId: string,
): Promise<{ text: string; usage: any; durationMs: number }> {
  const [text, , completed] = await Promise.all([
    finalMessage(client, turnId),
    turnUsage(client, turnId),
    completedTurn(client, turnId),
  ]);
  const usage = client.latest(
    (message) =>
      message.method === "thread/tokenUsage/updated" &&
      message.params?.turnId === turnId,
  );
  if (!usage) throw new Error(`Codex turn ${turnId} reported no token usage`);
  return {
    text,
    usage,
    durationMs: completed.params.turn.durationMs ?? 0,
  };
}

async function runNativeGoal(
  client: AppServerClient,
  threadId: string,
): Promise<{ text: string; usage: any; durationMs: number }> {
  const terminal = await client.waitFor(
    (message) =>
      (message.method === "thread/goal/updated" &&
        message.params?.threadId === threadId &&
        message.params?.goal?.status !== "active") ||
      (message.method === "turn/completed" &&
        message.params?.threadId === threadId &&
        message.params?.turn?.status === "failed"),
  );
  if (terminal.method === "turn/completed")
    throw new Error(
      `Codex goal turn failed: ${JSON.stringify(terminal.params.turn.error)}`,
    );
  if (terminal.params.goal.status !== "complete")
    throw new Error(`native goal ended as ${terminal.params.goal.status}`);
  const terminalTurnId = terminal.params.turnId;
  if (typeof terminalTurnId !== "string")
    throw new Error("native goal completion did not name its terminal turn");
  return runTurn(client, terminalTurnId);
}

async function prepareGoalPreflight(
  repoDir: string,
  engineeringRequest: string,
): Promise<{
  prompt: string;
  dimensions: PreparedGoalDimensions;
  stage: GoalDimensionStage;
  durationMs: number;
}> {
  const started = performance.now();
  const helper = join(repoDir, ".agents", "bin", "goal-loop");
  const policy = process.env.DARROW_EVAL_GOAL_ROUTE_POLICY ?? "current";
  if (policy !== "current" && policy !== "candidate")
    throw new Error(`unsupported evaluation goal route policy: ${policy}`);
  const proc = Bun.spawn(
    [
      "bash",
      helper,
      "prepare",
      "--repo",
      repoDir,
      "--host",
      "codex",
      "--policy",
      policy,
    ],
    { cwd: repoDir, stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0)
    throw new Error(`goal preflight preparation failed: ${stderr.trim()}`);
  if (!/^format\tdarrow-native-goal-prepared-v1$/m.test(stdout))
    throw new Error("goal preflight preparation returned an unknown format");
  const stage = goalDimensionStage(engineeringRequest);
  const dimensions = parsePreparedGoalDimensions(stdout);
  const skill = await readFile(
    join(repoDir, ".agents", "skills", "pursue-goal", "SKILL.md"),
    "utf8",
  );
  const intentRoutingGuidance = extractIntentRoutingGuidance(skill);
  const workflowDocuments = await Promise.all(
    [...dimensions.workflows].map(async ([id, workflow]) => {
      const content = await readFile(workflow.file, "utf8");
      return [
        `workflow_document_begin\t${id}`,
        content.trim(),
        `workflow_document_end\t${id}`,
      ].join("\n");
    }),
  );
  const preparedEvidence = [stdout.trim(), ...workflowDocuments].join("\n");
  return {
    prompt: buildPreparedGoalPrompt(
      engineeringRequest,
      preparedEvidence,
      intentRoutingGuidance,
      stage,
    ),
    dimensions,
    stage,
    durationMs: performance.now() - started,
  };
}

async function gitStatus(repoDir: string): Promise<string> {
  const proc = Bun.spawn(
    ["git", "status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: repoDir, stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0)
    throw new Error(`cannot inspect preflight changes: ${stderr.trim()}`);
  return stdout;
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

  async run(repoDir, prompt, model, effort): Promise<HarnessResult> {
    const start = performance.now();
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
    const client = new AppServerClient(proc);
    try {
      await client.request("initialize", {
        clientInfo: {
          name: "darrow_eval",
          title: "Darrow Eval",
          version: "1.0.0",
        },
      });
      client.notify("initialized", {});
      const models = await client.request("model/list", {
        limit: 100,
        includeHidden: true,
      });
      const catalog: CatalogRoute[] = models.data.map((entry: any) => ({
        model: entry.model,
        efforts: entry.supportedReasoningEfforts.map(
          (option: any) => option.reasoningEffort,
        ),
      }));
      const thread = await client.request("thread/start", {
        model,
        modelProvider: "openai",
        cwd: repoDir,
        approvalPolicy: "never",
        ephemeral: false,
      });
      const threadId = thread.thread.id as string;
      const beforePreflight = await gitStatus(repoDir);
      const prepared = await prepareGoalPreflight(repoDir, prompt);
      const preflight = await client.request("turn/start", {
        threadId,
        input: [{ type: "text", text: prepared.prompt }],
        cwd: repoDir,
        approvalPolicy: "never",
        sandboxPolicy: { type: "readOnly", networkAccess: false },
        model,
        effort,
        outputSchema: handoffSchema([...prepared.dimensions.routes.keys()]),
      });
      const preflightTurnId = preflight.turn.id as string;
      const preflightResult = await runTurn(client, preflightTurnId);
      const classifierUpdates = client.matching(
        (message) =>
          message.method === "thread/tokenUsage/updated" &&
          message.params?.turnId === preflightTurnId,
      );
      const classifierToolCalls = client.matching(
        (message) =>
          message.method === "item/completed" &&
          message.params?.turnId === preflightTurnId &&
          /tool|command/i.test(message.params?.item?.type ?? ""),
      );
      if (classifierUpdates.length !== 1 || classifierToolCalls.length !== 0)
        throw new Error(
          `prepared preflight used ${classifierUpdates.length} model calls and ${classifierToolCalls.length} tool calls`,
        );
      if ((await gitStatus(repoDir)) !== beforePreflight)
        throw new Error(
          "goal preflight modified the fixture before activation",
        );
      const handoff = parseCodexGoalHandoff(
        preflightResult.text,
        catalog,
        prepared.dimensions,
      );
      const expectedRoute = prompt.match(
        /^evaluation_expected_route\t([^\t\n]+)\t([^\t\n]+)\t([^\t\n]+)\t([^\t\n]+)$/m,
      );
      if (
        expectedRoute &&
        (handoff.selectedRoute.harness !== expectedRoute[1] ||
          handoff.selectedRoute.provider !== expectedRoute[2] ||
          handoff.selectedRoute.model !== expectedRoute[3] ||
          handoff.selectedRoute.effort !== expectedRoute[4])
      )
        throw new Error(
          `selected route does not match evaluation control: expected ${expectedRoute.slice(1).join("/")}`,
        );
      const workflow = prepared.dimensions.workflows.get(handoff.workflow)!;
      const risk = prepared.dimensions.risks.get(handoff.risk)!;
      const workflowContent = await readFile(workflow.file, "utf8");
      const workflowSha256 = new Bun.CryptoHasher("sha256")
        .update(workflowContent)
        .digest("hex");

      await client.request("thread/goal/set", {
        threadId,
        objective: handoff.goalContract,
        status: "active",
      });
      const selected = handoff.selectedRoute;
      const executionPrompt = [
        "The enclosing app-server launcher set the compiled contract as this thread's active native goal.",
        "Do not call create_goal; this same thread already has the active goal.",
        `It is applying the selected route ${selected.harness}|${selected.provider}|${selected.model}|${selected.effort} to this turn.`,
        `Follow the selected ${handoff.workflow} workflow playbook:`,
        workflowContent.trim(),
        `Apply the ${handoff.risk} verification gate: ${risk.verification}.`,
        "Pursue the active goal through implementation and final verification.",
        "Before returning, complete the native goal and include this exact evidence in the v4 launch record:",
        "format\tdarrow-native-goal-preflight-v4",
        `workflow\t${handoff.workflow}`,
        `risk\t${handoff.risk}`,
        `profile\t${handoff.profile}`,
        `selected_route\t${selected.harness}\t${selected.provider}\t${selected.model}\t${selected.effort}`,
        `effective_route\t${selected.harness}\t${selected.provider}\t${selected.model}\t${selected.effort}`,
        "route_applied_by\thost-api",
        "route_verified\ttrue",
        "launch_boundary\thost_api",
        `verification_gate\t${handoff.risk}`,
        "evaluation_child_invocations\t0",
        "evaluation_human_interruptions\t0",
      ].join("\n");
      const executionStarted = performance.now();
      const execution = await client.request("turn/start", {
        threadId,
        input: [{ type: "text", text: executionPrompt }],
        cwd: repoDir,
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" },
        model: selected.model,
        effort: selected.effort,
      });
      const executionTurnId = execution.turn.id as string;
      client.record({
        type: "darrow.route_applied",
        accepted: true,
        threadId,
        turnId: executionTurnId,
        selected,
        effective: selected,
        appliedBy: "host-api",
      });
      client.record({
        type: "darrow.dimensions_applied",
        accepted: true,
        threadId,
        turnId: executionTurnId,
        stage: prepared.stage,
        workflow: handoff.workflow,
        risk: handoff.risk,
      });
      client.record({
        type: "darrow.workflow_loaded",
        accepted: true,
        threadId,
        turnId: executionTurnId,
        workflow: handoff.workflow,
        file: workflow.file,
        sha256: workflowSha256,
      });
      const executionResult = await runNativeGoal(client, threadId);
      const executionDurationMs = performance.now() - executionStarted;
      const goal = await client.request("thread/goal/get", { threadId });
      if (goal.goal?.status !== "complete")
        throw new Error(
          `native goal ended as ${goal.goal?.status ?? "missing"}`,
        );
      // This adapter creates a fresh thread per trial. The final cumulative
      // total therefore covers every model call in both turns without double
      // counting the preflight usage.
      const usage = executionResult.usage.params.tokenUsage.total;
      const classifierUsage = preflightResult.usage.params.tokenUsage.total;
      return {
        ok: true,
        durationMs: performance.now() - start,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: null,
        resultText: executionResult.text,
        raw: client.raw(),
        phaseMetrics: {
          preparation: { durationMs: prepared.durationMs },
          classifier: {
            durationMs: preflightResult.durationMs,
            inputTokens: classifierUsage.inputTokens,
            outputTokens: classifierUsage.outputTokens,
            modelCalls: classifierUpdates.length,
          },
          execution: {
            durationMs: executionDurationMs,
            inputTokens: usage.inputTokens - classifierUsage.inputTokens,
            outputTokens: usage.outputTokens - classifierUsage.outputTokens,
          },
        },
      };
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
  },
};
