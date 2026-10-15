import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveCase } from "../sevro-extension/index";
import { fixtureExtensionRequest } from "./fixture-command";

test("Native goal evidence requirements follow the checks that consume them", async () => {
  const projectRoot = pathToFileURL(resolve(import.meta.dir, "../..")).href;
  for (const [id, required] of [
    ["goal-preflight-high-risk-routine", false],
    ["goal-preflight-quality-sensitive-localized", false],
    ["goal-preflight-routing-difficult-routine-diagnosis", false],
    ["guide-mutation", true],
  ] as const) {
    const { cases } = await resolveCase({
      projectRoot,
      selectors: { caseIds: [id] },
    });
    expect(
      cases[0]!.requiredEvidence.includes("sevro.host.native-controls"),
    ).toBe(required);
    if (!required)
      expect(cases[0]!.requiredEvidence).toEqual(["sevro.host.native-goal"]);
  }
  for (const id of [
    "doctor-adaptive-goal-direct-codex",
    "create-agent-skill-refuse-undefined-skill",
  ]) {
    const { cases } = await resolveCase({
      projectRoot,
      selectors: { caseIds: [id] },
    });
    await expect(
      fixtureExtensionRequest("prepare", {
        case: cases[0],
        host: { id: "sevro.host.claude", capabilities: [] },
        condition: "passive",
        configuration: {},
      }),
    ).rejects.toThrow("excludes the candidate host");
  }
});

test("Ticket publication reads belong to the retained main thread", async () => {
  for (const id of [
    "ticket-to-pr-composition-existing-pr",
    "ticket-to-pr-composition-replacement",
  ]) {
    const { cases } = await resolveCase({
      projectRoot: pathToFileURL(resolve(import.meta.dir, "../..")).href,
      selectors: { caseIds: [id] },
    });
    const selected = cases[0]!;
    const details = selected.extensionData["darrow.case"] as {
      transcriptChecks: { kind: string; skill?: string }[];
    };
    const check = details.transcriptChecks.find(
      (x) => x.skill === "create-pr" || x.skill === "ship-proposal",
    );
    expect(check?.kind).toBe("supporting-skill-read");
    const observation = {
      id: "sevro.codex.skill-reads",
      source: "sevro.host.codex",
      completeness: "complete",
      data: {
        method: "skill_file_read_probe",
        primarySkill: check!.skill,
        observedSkills: [check!.skill],
      },
    };
    const grade = async (observations: unknown[]) => {
      const result = await fixtureExtensionRequest<{
        checks: { status: string }[];
      }>("evaluate", {
        extensionData: {
          "darrow.case": { transcriptChecks: [{ ...check, id: "publisher" }] },
        },
        observations,
      });
      return result.checks[0]!.status;
    };
    expect(await grade([observation])).toBe("passed");
    expect(
      await grade([
        {
          ...observation,
          data: { ...observation.data, primarySkill: null, observedSkills: [] },
        },
      ]),
    ).toBe("failed");
    expect(
      await grade([
        {
          ...observation,
          data: {
            ...observation.data,
            primarySkill: "unrelated",
            observedSkills: ["unrelated"],
          },
        },
      ]),
    ).toBe("failed");
    for (const observations of [
      [],
      [observation, observation],
      [{ ...observation, completeness: "partial" }],
      [{ ...observation, source: "other" }],
    ])
      expect(await grade(observations)).toBe("unavailable");
  }
}, 30_000);

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
                skill: "adaptive-goal",
                forbidNativeSkillCall: true,
              },
            ],
          },
        },
        observations: [
          { ...native, data: { ...native.data, execCalls } },
          continuation,
          {
            id: "sevro.codex.follow-up-skill-reads",
            source: "sevro.host.codex",
            completeness: "complete",
            data: {
              method: "skill_file_read_probe",
              primarySkill: null,
              observedSkills: [],
            },
          },
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
    expect(
      await grade("skill-absent-after-continuation", [earlier, later]),
    ).toBe("passed");
    expect(
      await grade("skill-absent-after-continuation", [
        earlier,
        { ...later, completeness: "partial" },
      ]),
    ).toBe("unavailable");
    expect(
      await grade("skill-absent-after-continuation", [
        earlier,
        { ...later, calls: [{ index: 0, namespace: "other", name: "Skill" }] },
      ]),
    ).toBe("failed");
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

test("Explicit owner dispatch does not establish complete supporting reads", async () => {
  const dispatch = {
    id: "sevro.codex.explicit-invocation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "explicit_invocation",
      primarySkill: "verify-change",
      observedSkills: ["verify-change", "code-review"],
    },
  };
  const reads = {
    id: "sevro.codex.skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: "code-review",
      observedSkills: ["code-review"],
    },
  };
  const grade = async (
    observations: unknown[],
    expectation: Record<string, unknown>,
  ) => {
    const result = await fixtureExtensionRequest<{
      domainOutcomes: { status: string; evidenceRefs: string[] }[];
    }>("evaluate", {
      extensionData: {
        "darrow.case": {
          activation: {
            class: "positive",
            targetSkill: "verify-change",
            ...expectation,
          },
          invocation: { pluginName: "probe", skillName: "verify-change" },
        },
      },
      observations,
    });
    return result.domainOutcomes[0]!;
  };
  expect(
    (await grade([dispatch, { ...reads, completeness: "partial" }], {})).status,
  ).toBe("passed");
  for (const expectation of [
    { includes: ["code-review"] },
    { sequence: ["verify-change", "code-review"] },
    { excludes: ["adaptive-goal"] },
  ]) {
    expect(await grade([dispatch, reads], expectation)).toMatchObject({
      status: "passed",
      evidenceRefs: [dispatch.id, reads.id],
    });
    for (const observations of [
      [dispatch],
      [dispatch, { ...reads, completeness: "partial" }],
      [dispatch, reads, reads],
      [dispatch, { ...reads, source: "other" }],
      [
        dispatch,
        {
          ...reads,
          data: { ...reads.data, primarySkill: null, observedSkills: [] },
        },
      ],
    ]) {
      expect((await grade(observations, expectation)).status).toBe(
        "unavailable",
      );
    }
  }
  const ownerOnly = {
    ...dispatch,
    data: { ...dispatch.data, observedSkills: ["verify-change"] },
  };
  const noSupport = {
    ...reads,
    data: { ...reads.data, primarySkill: null, observedSkills: [] },
  };
  expect(
    (await grade([ownerOnly, noSupport], { includes: ["code-review"] })).status,
  ).toBe("failed");
}, 30_000);
