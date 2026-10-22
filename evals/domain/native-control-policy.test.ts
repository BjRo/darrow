import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveCase } from "../sevro-extension/index";
import { fixtureExtensionRequest } from "./fixture-command";
import {
  policyHostCapabilities,
  policyProject,
  runPolicyPrompt,
} from "./policy-project";

type Call = { ordinal: number; namespace: string; name: string };
const projectRoot = pathToFileURL(resolve(import.meta.dir, "../..")).href;

test("Ticket-to-PR task outcomes are independent of workflow diagnostics", async () => {
  const project = await policyProject(
    {
      prompt: "launch_required: adaptive-goal is unavailable",
      native_goal: "forbidden",
      transcript_checks: [
        {
          name: "no agent fallback",
          not_regex:
            '"tool":"spawn_agent"|"type":"darrow.codex_native_spawn"|"name":"Agent"',
        },
      ],
    },
    {
      skill: "ticket-to-pr",
      plugin: "darrow-ticket-to-pr",
      directory: "plugins/task-recipe/darrow-ticket-to-pr",
    },
  );
  const selected = await project.resolve();
  expect(selected.checks).not.toContainEqual(
    expect.objectContaining({ grader: "darrow.evals.transcript" }),
  );
  const graded = await fixtureExtensionRequest<{
    checks: unknown[];
    domainOutcomes: { id: string; status: string }[];
  }>("evaluate", {
    extensionData: selected.extensionData,
    observations: [],
    artifacts: [],
  });
  expect(graded.checks).toEqual([]);
  expect(graded.domainOutcomes).toContainEqual(
    expect.objectContaining({
      id: "darrow.evals.workflow.transcript.1",
      status: "unavailable",
    }),
  );
  const violation = await fixtureExtensionRequest<{
    checks: unknown[];
    domainOutcomes: { id: string; status: string }[];
  }>("evaluate", {
    extensionData: selected.extensionData,
    observations: [
      {
        id: "sevro.host.native-goal",
        source: "sevro.host.codex",
        completeness: "complete",
        data: {
          threadId: "root",
          goals: [{ status: "active", characters: 12 }],
          goalStatus: "active",
        },
      },
    ],
    artifacts: [],
  });
  expect(violation.checks).toEqual([]);
  expect(violation.domainOutcomes).toContainEqual(
    expect.objectContaining({
      id: "darrow.evals.workflow.native-goal",
      status: "failed",
    }),
  );
  const good = await runPolicyPrompt(
    project,
    "codex",
    project.definition.prompt,
  );
  expect(good.exitCode, good.diagnostic).toBe(0);
  expect(good.value.task.verdict).toBe("passed");
  await project.write({
    checks: [{ name: "observable task failure", run: "exit 1" }],
  });
  const bad = await runPolicyPrompt(
    project,
    "codex",
    project.definition.prompt,
  );
  expect(bad.value.task.verdict).toBe("failed");
}, 30_000);

for (const name of [
  "empty-diff",
  "invalid-base",
  "reviewer-route-unavailable",
]) {
  test(`Review terminal ${name} requires current bound native controls`, async () => {
    const { cases } = await resolveCase({
      projectRoot,
      selectors: { caseIds: [`code-review-${name}`] },
      configuration: {},
    });
    const selected = cases[0]!;
    expect(selected.requiredEvidence).toContain("sevro.host.native-controls");
    expect(JSON.stringify(selected)).not.toContain("retained-harness.jsonl");
    for (const host of ["codex", "claude"] as const) {
      await fixtureExtensionRequest("prepare", {
        case: selected,
        configuration: {},
        host: {
          id: `sevro.host.${host}`,
          capabilities: [
            ...policyHostCapabilities(host),
            "sevro.host.native-controls",
          ],
        },
      });
      const observation = (calls: Call[] = [], exec = 0) => ({
        id: "sevro.host.native-controls",
        source: `sevro.host.${host}`,
        completeness: "complete",
        data: {
          method: "native_control_calls",
          truncated: false,
          acceptedAgentCount: host === "codex" ? 0 : null,
          submittedExecCalls: host === "codex" ? exec : null,
          calls,
        },
      });
      const grade = async (observations: unknown[]) => {
        const result = await fixtureExtensionRequest<{
          checks: { id: string; status: string }[];
        }>("evaluate", {
          extensionData: selected.extensionData,
          observations,
          artifacts: [],
        });
        return result.checks.find(
          (check) => check.id === "darrow.evals.transcript.1",
        )?.status;
      };
      expect(await grade([observation()])).toBe("passed");
      expect(await grade([])).toBe("unavailable");
      expect(await grade([observation(), observation()])).toBe("unavailable");
      expect(await grade([{ ...observation(), completeness: "partial" }])).toBe(
        "unavailable",
      );
      expect(await grade([{ ...observation(), source: "another.host" }])).toBe(
        "unavailable",
      );
      const namespace = host === "codex" ? "collaboration" : "claude";
      const spawn = host === "codex" ? "spawn_agent" : "Agent";
      expect(
        await grade([observation([{ ordinal: 1, namespace, name: spawn }])]),
      ).toBe("failed");
      expect(
        await grade([
          observation([
            {
              ordinal: 1,
              namespace: host === "codex" ? "functions" : "claude",
              name: "update_goal",
            },
          ]),
        ]),
      ).toBe("passed");
      if (host === "codex")
        expect(await grade([observation([], 1)])).toBe("unavailable");
    }
  }, 30_000);
}

test("Ledger text checks inspect control receipts only when goal absence is required", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-ledger-controls-"));
  try {
    const path = resolve(root, "events.jsonl");
    const native = {
      id: "sevro.codex.native-calls",
      source: "sevro.host.codex",
      completeness: "complete",
      data: {
        method: "native_session",
        calls: [],
        acceptedSpawns: [],
        toolCalls: [{ ordinal: 2, namespace: "other", name: "exec" }],
        submittedExecCalls: 1,
        execCalls: [{ ordinal: 2, completeness: "partial", calls: [] }],
      },
    };
    const grade = async (forbidGoal: boolean, text = "") => {
      const events = '{"type":"turn.completed"}\n' + text;
      await writeFile(path, events);
      const result = await fixtureExtensionRequest<{
        checks: { status: string }[];
      }>("evaluate", {
        extensionData: {
          "darrow.case": {
            transcriptChecks: [
              {
                id: "ledger",
                kind: "no-lifecycle-ledger",
                terms: ["retired-ledger"],
                forbidGoal,
              },
            ],
          },
        },
        observations: [native],
        artifacts: [
          {
            id: "sevro.codex.events",
            path: pathToFileURL(path).href,
            sha256: createHash("sha256").update(events).digest("hex"),
          },
        ],
      });
      return result.checks[0]!.status;
    };
    expect(await grade(false)).toBe("passed");
    expect(await grade(true)).toBe("unavailable");
    expect(await grade(false, "retired-ledger")).toBe("failed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);

test("Continuation absence inspects the relevant submitted-code interval", async () => {
  const root = await mkdtemp(
    resolve(tmpdir(), "darrow-continuation-controls-"),
  );
  try {
    const path = resolve(root, "events.jsonl");
    const events = '{"type":"turn.completed"}\n';
    await writeFile(path, events);
    const earlier = { ordinal: 2, completeness: "partial", calls: [] };
    const later = { ordinal: 8, completeness: "complete", calls: [] };
    const native = {
      id: "sevro.codex.native-calls",
      source: "sevro.host.codex",
      completeness: "complete",
      data: {
        method: "native_session",
        calls: [],
        acceptedSpawns: [],
        submittedExecCalls: 2,
        toolCalls: [2, 8].map((ordinal) => ({
          ordinal,
          namespace: "other",
          name: "exec",
        })),
      },
    };
    const continuation = {
      id: "sevro.codex.continuation",
      source: "sevro.host.codex",
      completeness: "complete",
      data: {
        method: "same_thread_resume",
        threadId: "thread-1",
        nativeAfterOrdinal: 5,
        preFollowUpWorktreeUnchanged: true,
      },
    };
    const grade = async (kind: string, execCalls: unknown) => {
      const result = await fixtureExtensionRequest<{
        checks: { status: string }[];
      }>("evaluate", {
        extensionData: {
          "darrow.case": {
            transcriptChecks: [
              {
                id: "boundary",
                kind,
              },
            ],
          },
        },
        observations: [
          { ...native, data: { ...native.data, execCalls } },
          continuation,
        ],
        artifacts: [
          {
            id: "sevro.codex.follow-up-events",
            path: pathToFileURL(path).href,
            sha256: createHash("sha256").update(events).digest("hex"),
          },
        ],
      });
      return result.checks[0]!.status;
    };
    expect(await grade("no-owner-before-continuation", [earlier, later])).toBe(
      "unavailable",
    );
    expect(
      await grade("no-replacement-after-continuation", [earlier, later]),
    ).toBe("passed");
    expect(
      await grade("no-replacement-after-continuation", [
        earlier,
        { ...later, completeness: "partial" },
      ]),
    ).toBe("unavailable");
    for (const [namespace, name] of [
      ["collaboration", "spawn_agent"],
      ["functions", "create_goal"],
    ]) {
      expect(
        await grade("no-replacement-after-continuation", [
          earlier,
          { ...later, calls: [{ index: 0, namespace, name }] },
        ]),
      ).toBe("failed");
    }
    expect(
      await grade("no-replacement-after-continuation", [
        { ...earlier, ordinal: 3 },
        later,
      ]),
    ).toBe("unavailable");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);

test("Legacy native absence policies also require inspected submissions", async () => {
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      acceptedSpawns: [],
      toolCalls: [{ ordinal: 2, namespace: "functions", name: "exec" }],
      submittedExecCalls: 1,
      execCalls: [{ ordinal: 2, completeness: "complete", calls: [] }],
    },
  };
  for (const [kind, namespace, name] of [
    ["no-agent-spawn", "collaboration", "spawn_agent"],
    ["no-native-goal-control", "functions", "create_goal"],
  ]) {
    const grade = async (execCalls: unknown) => {
      const result = await fixtureExtensionRequest<{
        checks: { status: string }[];
      }>("evaluate", {
        extensionData: {
          "darrow.case": { transcriptChecks: [{ id: "absence", kind }] },
        },
        observations: [{ ...native, data: { ...native.data, execCalls } }],
      });
      return result.checks[0]!.status;
    };
    expect(await grade(native.data.execCalls)).toBe("passed");
    expect(await grade(undefined)).toBe("unavailable");
    expect(
      await grade([{ ...native.data.execCalls[0], completeness: "partial" }]),
    ).toBe("unavailable");
    expect(
      await grade([
        { ...native.data.execCalls[0], calls: [{ index: 0, namespace, name }] },
      ]),
    ).toBe("failed");
  }
}, 30_000);

test("Code Mode absence requires complete receipts and checks submitted attempts", async () => {
  const { cases } = await resolveCase({
    projectRoot: pathToFileURL(resolve(import.meta.dir, "../..")).href,
    selectors: { caseIds: ["guide-mutation"] },
  });
  const exec = { ordinal: 4, namespace: "functions", name: "exec" };
  const receipt = {
    ordinal: 4,
    completeness: "complete",
    calls: [{ index: 0, namespace: "functions", name: "exec_command" }],
  };
  const observation = {
    id: "sevro.host.native-controls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_control_calls",
      truncated: false,
      acceptedAgentCount: 0,
      submittedExecCalls: 1,
      calls: [exec],
      execCalls: [receipt],
    },
  };
  const grade = async (data: unknown, legacy?: unknown) => {
    const result = await fixtureExtensionRequest<{
      checks: { id: string; status: string }[];
    }>("evaluate", {
      extensionData: cases[0]!.extensionData,
      observations: [{ ...observation, data }, ...(legacy ? [legacy] : [])],
    });
    return result.checks.find(
      (check) => check.id === "darrow.evals.transcript.1",
    )?.status;
  };
  expect(await grade(observation.data)).toBe("passed");
  for (const [namespace, name] of [
    ["collaboration", "spawn_agent"],
    ["functions", "create_goal"],
    ["functions", "update_goal"],
  ]) {
    expect(
      await grade({
        ...observation.data,
        execCalls: [{ ...receipt, calls: [{ index: 0, namespace, name }] }],
      }),
    ).toBe("failed");
  }
  for (const execCalls of [
    undefined,
    [],
    [receipt, receipt],
    [{ ...receipt, ordinal: 5 }],
    [{ ...receipt, completeness: "partial" }],
    [{ ...receipt, calls: [{ ...receipt.calls[0], index: 1 }] }],
    [{ ...receipt, calls: [null] }],
  ]) {
    expect(await grade({ ...observation.data, execCalls })).toBe("unavailable");
  }
  expect(await grade({ ...observation.data, submittedExecCalls: 0 })).toBe(
    "unavailable",
  );
  const legacy = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [exec],
      acceptedSpawns: [],
      submittedExecCalls: 1,
      execCalls: [receipt],
    },
  };
  expect(await grade(observation.data, legacy)).toBe("passed");
  expect(
    await grade(observation.data, {
      ...legacy,
      data: { ...legacy.data, execCalls: [{ ...receipt, calls: [] }] },
    }),
  ).toBe("unavailable");
}, 30_000);
