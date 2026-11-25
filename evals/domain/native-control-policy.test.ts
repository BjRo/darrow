import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveCase } from "../sevro-extension/index";
import { fixtureExtensionRequest, policyOutcomes } from "./fixture-command";
import {
  policyHostCapabilities,
  policyProject,
  runPolicyPrompt,
} from "./policy-project";

type Call = { ordinal: number; namespace: string; name: string };
const projectRoot = pathToFileURL(resolve(import.meta.dir, "../..")).href;

test.each([
  "goal-blocked-retry-existing-publication",
  "goal-blocked-retry-observes-publication",
  "goal-readiness-nonready-stops",
  "goal-readiness-required-unavailable",
  "goal-review-required-unavailable",
  "goal-verification-combined-pending",
])("%s prepares and rejects agent launches on both hosts", async (id) => {
  const { cases } = await fixtureExtensionRequest<{
    cases: {
      requiredEvidence: string[];
      extensionData: { "darrow.case": Record<string, unknown> };
    }[];
  }>("resolve", { projectRoot, selectors: { caseIds: [id] } });
  const selected = cases[0]!;
  expect(selected.requiredEvidence).not.toContain("sevro.codex.native-calls");
  const details = selected.extensionData["darrow.case"];
  const checks = details.transcriptChecks as {
    id: string;
    kind: string;
    forbiddenCommandTerms?: string[];
  }[];
  const control = checks.find((check) =>
    [
      "preflight-no-agent-spawn",
      "inactive-controls",
      "no-agent-spawn",
    ].includes(check.kind),
  );
  expect(control).toBeDefined();
  for (const host of ["claude", "codex"] as const) {
    await fixtureExtensionRequest("prepare", {
      case: selected,
      configuration: {},
      host: {
        id: `sevro.host.${host}`,
        capabilities: [
          ...policyHostCapabilities(host).filter(
            (capability) => capability !== "sevro.codex.native-calls",
          ),
          "sevro.host.native-controls",
        ],
      },
    });
    const data = {
      method: "native_control_calls",
      truncated: false,
      acceptedAgentCount: host === "codex" ? 0 : null,
      submittedExecCalls: host === "codex" ? 0 : null,
      calls: [] as Call[],
    };
    const observation = {
      id: "sevro.host.native-controls",
      source: `sevro.host.${host}`,
      completeness: "complete",
      data,
    };
    const grade = async (observations: unknown[]) => {
      const result = await fixtureExtensionRequest<{
        checks: { id: string; status: string }[];
        domainOutcomes: { id: string; status: string }[];
      }>("evaluate", {
        extensionData: selected.extensionData,
        observations,
        artifacts: [],
      });
      return policyOutcomes(result).find((check) => check.id === control!.id)
        ?.status;
    };
    expect(await grade([observation])).toBe("passed");
    expect(await grade([])).toBe("unavailable");
    expect(
      await grade([
        {
          ...observation,
          data: {
            ...data,
            calls: [
              {
                ordinal: 1,
                namespace: host === "codex" ? "collaboration" : "claude",
                name: host === "codex" ? "spawn_agent" : "Agent",
              },
            ],
          },
        },
      ]),
    ).toBe("failed");
  }
  if (id.startsWith("goal-blocked-retry-"))
    expect(
      checks.find((check) => check.kind === "command-absence"),
    ).toMatchObject({ forbiddenCommandTerms: ["adaptive-goal-preflight"] });
  if (id === "goal-readiness-nonready-stops")
    expect(details.activation).toMatchObject({
      includes: ["assess-implementation-readiness"],
    });
});

test("Adaptive Goal ticket preflight uses complete native controls on both hosts", async () => {
  const { cases } = await fixtureExtensionRequest<{
    cases: { id: string; requiredEvidence: string[]; extensionData: unknown }[];
  }>("resolve", {
    projectRoot,
    selectors: { caseIds: ["goal-preflight-ticket-input"] },
  });
  const selected = cases[0]!;
  for (const host of ["claude", "codex"] as const) {
    await fixtureExtensionRequest("prepare", {
      case: selected,
      configuration: {},
      host: {
        id: `sevro.host.${host}`,
        capabilities: [
          ...policyHostCapabilities(host).filter(
            (capability) => capability !== "sevro.codex.native-calls",
          ),
          "sevro.host.native-controls",
        ],
      },
    });
    expect(selected.requiredEvidence).not.toContain("sevro.codex.native-calls");
    const observation = {
      id: "sevro.host.native-controls",
      source: `sevro.host.${host}`,
      completeness: "complete",
      data: {
        method: "native_control_calls",
        truncated: false,
        acceptedAgentCount: host === "codex" ? 0 : null,
        submittedExecCalls: host === "codex" ? 0 : null,
        calls: [] as Call[],
      },
    };
    const grade = async (observations: unknown[]) => {
      const result = await fixtureExtensionRequest<{
        checks: { id: string; status: string }[];
        domainOutcomes: { id: string; status: string }[];
      }>("evaluate", {
        extensionData: selected.extensionData,
        observations,
        artifacts: [],
      });
      return policyOutcomes(result).find(
        (check) => check.id === "darrow.evals.transcript.1",
      )?.status;
    };
    expect(await grade([observation])).toBe("passed");
    for (const observations of [
      [],
      [observation, observation],
      [{ ...observation, completeness: "partial" }],
      [{ ...observation, source: "another.host" }],
      [{ ...observation, data: { ...observation.data, truncated: true } }],
    ])
      expect(await grade(observations)).toBe("unavailable");
    expect(
      await grade([
        {
          ...observation,
          data: {
            ...observation.data,
            calls: [
              {
                ordinal: 1,
                namespace: host === "codex" ? "collaboration" : "claude",
                name: host === "codex" ? "spawn_agent" : "Agent",
              },
            ],
          },
        },
      ]),
    ).toBe("failed");
    if (host !== "codex") continue;
    const receipt = {
      ordinal: 4,
      completeness: "complete",
      calls: [{ index: 0, namespace: "functions", name: "exec_command" }],
    };
    const data = {
      ...observation.data,
      submittedExecCalls: 1,
      calls: [{ ordinal: 4, namespace: "functions", name: "exec" }],
      execCalls: [receipt],
    };
    expect(await grade([{ ...observation, data }])).toBe("passed");
    expect(
      await grade([
        {
          ...observation,
          data: {
            ...data,
            execCalls: [
              {
                ...receipt,
                calls: [
                  { index: 0, namespace: "collaboration", name: "spawn_agent" },
                ],
              },
            ],
          },
        },
      ]),
    ).toBe("failed");
    for (const execCalls of [
      undefined,
      [],
      [receipt, receipt],
      [{ ...receipt, ordinal: 5 }],
      [{ ...receipt, completeness: "partial" }],
      [{ ...receipt, calls: [{ ...receipt.calls[0], index: 1 }] }],
    ])
      expect(
        await grade([{ ...observation, data: { ...data, execCalls } }]),
      ).toBe("unavailable");
  }
}, 30_000);

test("Ticket-to-PR task outcomes are independent of workflow diagnostics", async () => {
  const project = await policyProject(
    {
      prompt: "launch_required: adaptive-goal is unavailable",
      native_goal: "forbidden",
      transcript_checks: [
        { name: "no agent fallback", kind: "no-agent-spawn" },
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
  expect(good.exitCode, good.diagnostic + JSON.stringify(good.value)).toBe(0);
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

test("Adaptive Goal separates auxiliary diagnostics from goal and route requirements", async () => {
  const selected = async (id: string) =>
    (
      await resolveCase({
        projectRoot,
        selectors: { caseIds: [id] },
        configuration: {},
      })
    ).cases[0]!;
  const stop = await selected("goal-readiness-required-unavailable");
  expect(
    stop.checks.some((check) =>
      check.id.startsWith("darrow.evals.transcript."),
    ),
  ).toBe(false);
  expect(stop.requiredEvidence).toEqual(["sevro.host.native-goal"]);
  const graded = await fixtureExtensionRequest<{
    checks: { id: string; status: string }[];
    domainOutcomes: { id: string; status: string }[];
  }>("evaluate", {
    extensionData: stop.extensionData,
    observations: [
      {
        id: "sevro.host.native-goal",
        source: "sevro.host.codex",
        completeness: "complete",
        data: { threadId: "root", goals: [], goalStatus: null },
      },
      {
        id: "sevro.observation.final-message",
        source: "sevro.host.codex",
        completeness: "complete",
        data: { text: "launch_required: readiness is unavailable" },
      },
    ],
    artifacts: [],
  });
  expect(graded.checks.every((check) => check.status === "passed")).toBe(true);
  expect(graded.domainOutcomes).toContainEqual(
    expect.objectContaining({
      id: "darrow.evals.workflow.transcript.1",
      status: "unavailable",
    }),
  );
  const routing = await selected("goal-preflight-quality-sensitive-localized");
  expect(routing.checks).toContainEqual(
    expect.objectContaining({
      id: "darrow.evals.transcript.1",
    }),
  );
  expect(routing.checks).not.toContainEqual(
    expect.objectContaining({
      id: "darrow.evals.transcript.2",
    }),
  );
  const selection = await selected(
    "doctor-adaptive-goal-nonactivation-delivery",
  );
  expect(selection.checks).toContainEqual(
    expect.objectContaining({
      id: "darrow.evals.transcript.1",
    }),
  );
}, 30_000);

test("Adaptive Goal retains the user-feedback mutation boundary as a task gate", async () => {
  for (const id of [
    "goal-cross-turn-feedback-answer",
    "goal-steering-without-question",
  ]) {
    const { cases } = await resolveCase({
      projectRoot,
      selectors: { caseIds: [id] },
      configuration: {},
    });
    const selected = cases[0]!;
    const details = selected.extensionData["darrow.case"] as {
      transcriptChecks: { id: string; kind: string }[];
    };
    const boundary = details.transcriptChecks.find(
      (check) => check.kind === "unchanged-before-continuation",
    )!;
    expect(selected.checks).toContainEqual(
      expect.objectContaining({ id: boundary.id }),
    );
    const observation = {
      id: "sevro.codex.continuation",
      source: "sevro.host.codex",
      completeness: "complete",
      data: {
        method: "same_thread_resume",
        threadId: "root",
        preFollowUpWorktreeUnchanged: true,
      },
    };
    const grade = async (observations: unknown[]) => {
      const result = await fixtureExtensionRequest<{
        checks: { id: string; status: string }[];
        domainOutcomes: { id: string; status: string }[];
      }>("evaluate", {
        extensionData: selected.extensionData,
        observations,
        artifacts: [],
      });
      expect(
        result.domainOutcomes.some(
          (entry) =>
            entry.id ===
            boundary.id.replace("darrow.evals.", "darrow.evals.workflow."),
        ),
      ).toBe(false);
      return result.checks.find((check) => check.id === boundary.id)?.status;
    };
    expect(await grade([observation])).toBe("passed");
    expect(
      await grade([
        {
          ...observation,
          data: { ...observation.data, preFollowUpWorktreeUnchanged: false },
        },
      ]),
    ).toBe("failed");
    for (const unavailable of [
      [],
      [observation, observation],
      [{ ...observation, completeness: "partial" }],
      [
        {
          ...observation,
          data: { ...observation.data, preFollowUpWorktreeUnchanged: null },
        },
      ],
    ])
      expect(await grade(unavailable)).toBe("unavailable");
  }
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
