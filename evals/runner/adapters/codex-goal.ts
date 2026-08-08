import { join } from "node:path";
import type { GoalRoute, HarnessAdapter, HarnessResult } from "../types";
import { isolatedHarnessEnvironment } from "../environment";
import { sandboxedAgentCommand } from "../sandbox";

interface CatalogRoute {
  model: string;
  efforts: string[];
}

interface GoalHandoff {
  format: "darrow-native-goal-handoff-v1";
  template: string;
  profile: "fast" | "standard" | "deep";
  routeSource: "policy" | "user";
  selectedRoute: GoalRoute;
  goalContract: string;
}

export function parseCodexGoalHandoff(
  text: string,
  catalog: CatalogRoute[],
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
    handoff.format !== "darrow-native-goal-handoff-v1" ||
    typeof handoff.template !== "string" ||
    !["fast", "standard", "deep"].includes(handoff.profile ?? "") ||
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
  const model = catalog.find((entry) => entry.model === route.model);
  if (!model) throw new Error(`unavailable selected model: ${route.model}`);
  if (!model.efforts.includes(route.effort))
    throw new Error(
      `unsupported selected effort for ${route.model}: ${route.effort}`,
    );
  if (handoff.routeSource === "policy") {
    const policy: Record<
      GoalHandoff["profile"],
      { model: string; effort: string }
    > = {
      fast: { model: "gpt-5.6-terra", effort: "low" },
      standard: { model: "gpt-5.6-sol", effort: "medium" },
      deep: { model: "gpt-5.6-sol", effort: "high" },
    };
    const profile = handoff.profile as GoalHandoff["profile"];
    const expected = policy[profile];
    if (route.model !== expected.model || route.effort !== expected.effort)
      throw new Error(
        `selected route does not match ${profile} policy: expected ${expected.model}/${expected.effort}`,
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
  return handoff as GoalHandoff;
}

const HANDOFF_SCHEMA = {
  type: "object",
  properties: {
    format: { type: "string", const: "darrow-native-goal-handoff-v1" },
    template: { type: "string", minLength: 1 },
    profile: { type: "string", enum: ["fast", "standard", "deep"] },
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
    "template",
    "profile",
    "routeSource",
    "selectedRoute",
    "goalContract",
  ],
  additionalProperties: false,
};

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
): Promise<{ text: string; usage: any }> {
  const [text] = await Promise.all([
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
  return { text, usage };
}

async function runNativeGoal(
  client: AppServerClient,
  threadId: string,
): Promise<{ text: string; usage: any }> {
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
      const preflight = await client.request("turn/start", {
        threadId,
        input: [{ type: "text", text: prompt }],
        cwd: repoDir,
        approvalPolicy: "never",
        sandboxPolicy: { type: "readOnly", networkAccess: false },
        model,
        effort,
        outputSchema: HANDOFF_SCHEMA,
      });
      const preflightTurnId = preflight.turn.id as string;
      const preflightResult = await runTurn(client, preflightTurnId);
      if ((await gitStatus(repoDir)) !== beforePreflight)
        throw new Error(
          "goal preflight modified the fixture before activation",
        );
      const handoff = parseCodexGoalHandoff(preflightResult.text, catalog);

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
        "Pursue the active goal through implementation and final verification.",
        "Before returning, complete the native goal and include this exact route evidence in the v2 launch record:",
        `selected_route\t${selected.harness}\t${selected.provider}\t${selected.model}\t${selected.effort}`,
        `effective_route\t${selected.harness}\t${selected.provider}\t${selected.model}\t${selected.effort}`,
        "route_applied_by\thost-api",
        "route_verified\ttrue",
        "launch_boundary\thost_api",
        "evaluation_child_invocations\t0",
        "evaluation_human_interruptions\t0",
      ].join("\n");
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
      const executionResult = await runNativeGoal(client, threadId);
      const goal = await client.request("thread/goal/get", { threadId });
      if (goal.goal?.status !== "complete")
        throw new Error(
          `native goal ended as ${goal.goal?.status ?? "missing"}`,
        );
      // This adapter creates a fresh thread per trial. The final cumulative
      // total therefore covers every model call in both turns without double
      // counting the preflight usage.
      const usage = executionResult.usage.params.tokenUsage.total;
      return {
        ok: true,
        durationMs: performance.now() - start,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: null,
        resultText: executionResult.text,
        raw: client.raw(),
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
