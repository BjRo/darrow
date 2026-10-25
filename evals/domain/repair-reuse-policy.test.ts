import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureExtensionRequest, policyOutcomes } from "./fixture-command";

const roots: string[] = [];
const projectRoot = pathToFileURL(join(import.meta.dir, "../..")).href;

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function resolveCase(id: string) {
  const resolved = await fixtureExtensionRequest<{
    cases: Array<{ id: string; extensionData: Record<string, unknown> }>;
  }>("resolve", {
    projectRoot,
    selectors: { caseIds: [id] },
    configuration: {},
  });
  return resolved.cases[0]!;
}

async function reuseStatus(
  id: string,
  observations: unknown[],
  artifacts: unknown[] = [],
) {
  const selected = await resolveCase(id);
  const result = await fixtureExtensionRequest<{
    checks: Array<{ id: string; status: string }>;
  }>("evaluate", {
    caseId: selected.id,
    extensionData: selected.extensionData,
    configuration: {},
    artifacts,
    builtinChecks: [],
    execution: { status: "completed" },
    observations,
  });
  return policyOutcomes(result).find(
    (check) => check.id === "darrow.evals.transcript.1",
  )?.status;
}

function codexCalls(followUp: "followup_task" | "spawn_agent") {
  const spawn = (agentRef: string, start: number, effort: string) => ({
    agentRef,
    threadId: `${agentRef}-thread`,
    requestedOrdinal: start,
    startedOrdinal: start + 1,
    acceptedOrdinal: start + 2,
    model: "gpt-6.1-sol",
    reasoningEffort: effort,
  });
  const spawns = [spawn("impl", 1, "high"), spawn("verify", 5, "medium")];
  const repair =
    followUp === "followup_task"
      ? { ordinal: 9, namespace: "collaboration", name: "followup_task" }
      : { ordinal: 9, namespace: "collaboration", name: "spawn_agent" };
  const direct = [1, 5, ...(followUp === "spawn_agent" ? [9] : [])].map(
    (ordinal) => ({
      ordinal,
      namespace: "collaboration",
      name: "spawn_agent",
      evidence: "invocation_attempt",
    }),
  );
  return {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: direct,
      toolCalls: [
        { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
        { ordinal: 5, namespace: "collaboration", name: "spawn_agent" },
        followUp === "followup_task" ? { ...repair, target: "impl" } : repair,
      ],
      submittedExecCalls: 0,
      acceptedSpawns:
        followUp === "spawn_agent"
          ? [...spawns, spawn("replacement", 9, "high")]
          : spawns,
      feedbackCalls:
        followUp === "followup_task"
          ? [
              {
                ordinal: 9,
                tool: "followup_task",
                target: "impl",
                responseObserved: true,
              },
            ]
          : [],
    },
  };
}

test("Codex repair reuse requires follow-up to the one retained implementor", async () => {
  expect(
    await reuseStatus("goal-placement-repair-reuse", [
      codexCalls("followup_task"),
    ]),
  ).toBe("passed");
  expect(
    await reuseStatus("goal-placement-repair-reuse", [
      codexCalls("spawn_agent"),
    ]),
  ).toBe("failed");
  expect(await reuseStatus("goal-placement-repair-reuse", [])).toBe(
    "unavailable",
  );
});

async function claudeEvidence(target: string) {
  const root = await mkdtemp(join(tmpdir(), "darrow-repair-reuse-"));
  roots.push(root);
  const agent = (id: string) => ({
    type: "tool_use",
    name: "Agent",
    id,
    input: {
      subagent_type: "darrow-adaptive-goal:adaptive-goal-opus-5-5-high",
      run_in_background: false,
    },
  });
  const result = (id: string, content: string) => ({
    type: "user",
    message: {
      content: [{ type: "tool_result", tool_use_id: id, content }],
    },
  });
  const text = [
    { type: "assistant", message: { content: [agent("use-1")] } },
    result("use-1", "Implemented.\nagentId: impl123"),
    { type: "assistant", message: { content: [agent("use-2")] } },
    result("use-2", "Verification blocked.\nagentId: verify456"),
    {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "SendMessage",
            id: "use-3",
            input: { to: target, message: "Repair the boundary finding." },
          },
        ],
      },
    },
    { type: "result", subtype: "success", is_error: false },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n");
  const path = join(root, "events.jsonl");
  await writeFile(path, text);
  const call = (ordinal: number, toolUseId: string, nested?: string) => ({
    ordinal,
    actor: nested ? "nested" : "parent",
    parentToolUseId: nested ?? null,
    name: "Agent",
    toolUseId,
    subagentType: nested
      ? "darrow-verification:review-coordinator-sonnet-5-5-medium"
      : "darrow-adaptive-goal:adaptive-goal-opus-5-5-high",
    runInBackground: false,
    promptSha256: "a".repeat(64),
  });
  return {
    observations: [
      {
        id: "sevro.host.native-goal",
        source: "sevro.host.claude",
        completeness: "complete",
        data: {
          threadId: "root",
          goals: [{ status: "complete", characters: 12 }],
          goalStatus: "complete",
        },
      },
      {
        id: "sevro.claude.tool-calls",
        source: "sevro.host.claude",
        completeness: "complete",
        data: {
          method: "stream_tool_calls",
          truncated: false,
          calls: [
            call(1, "use-1"),
            call(2, "use-2"),
            call(3, "use-4", "use-2"),
          ],
        },
      },
    ],
    artifacts: [
      {
        id: "sevro.claude.events",
        path: pathToFileURL(path).href,
        sha256: createHash("sha256").update(text).digest("hex"),
      },
    ],
  };
}

test("Claude repair reuse requires SendMessage to the one retained implementor", async () => {
  for (const [target, expected] of [
    ["impl123", "passed"],
    ["verify456", "failed"],
  ] as const) {
    const evidence = await claudeEvidence(target);
    expect(
      await reuseStatus(
        "goal-placement-repair-reuse-claude",
        evidence.observations,
        evidence.artifacts,
      ),
    ).toBe(expected);
  }
});
