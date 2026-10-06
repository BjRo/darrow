import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureExtensionRequest } from "./fixture-command";

const roots: string[] = [];

test("current implementation routes grade sourced Claude completions on both hosts", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-claude-route-"));
  roots.push(root);
  for (const [id, types] of [
    [
      "goal-preflight-high-risk-routine",
      ["adaptive-goal-sonnet-5-5-low", "adaptive-goal-sonnet-5-5-medium"],
    ],
    [
      "goal-preflight-quality-sensitive-localized",
      ["adaptive-goal-sonnet-5-5-medium"],
    ],
    [
      "goal-preflight-routing-difficult-routine-diagnosis",
      ["adaptive-goal-opus-5-5-high"],
    ],
  ] as const) {
    const resolved = await fixtureExtensionRequest<{
      cases: Array<{
        id: string;
        requiredEvidence: string[];
        extensionData: Record<string, unknown>;
      }>;
    }>("resolve", {
      projectRoot: pathToFileURL(join(import.meta.dir, "../..")).href,
      selectors: { caseIds: [id] },
      configuration: {},
    });
    for (const type of [...types, "other-agent"]) {
      const subagentType = `darrow-adaptive-goal:${type}`;
      const call = {
        ordinal: 1,
        actor: "parent",
        parentToolUseId: null,
        name: "Agent",
        toolUseId: "use-1",
        subagentType,
        runInBackground: false,
        promptSha256: "a".repeat(64),
      };
      const text = [
        {
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                name: "Agent",
                id: "use-1",
                input: {
                  subagent_type: subagentType,
                  run_in_background: false,
                },
              },
            ],
          },
        },
        {
          type: "user",
          message: {
            content: [
              {
                type: "tool_result",
                tool_use_id: "use-1",
                content: "Completed",
                is_error: false,
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
      const attemptText = text
        .split("\n")
        .filter((line) => JSON.parse(line).type !== "user")
        .join("\n");
      const attemptPath = join(root, "attempt.jsonl");
      await writeFile(attemptPath, attemptText);
      for (const [calls, artifacts, expected] of [
        [
          [call],
          [
            {
              id: "sevro.claude.events",
              path: pathToFileURL(path).href,
              sha256: createHash("sha256").update(text).digest("hex"),
            },
          ],
          type === "other-agent" ? "failed" : "passed",
        ],
        [[call], [], "unavailable"],
        [
          [call],
          [
            {
              id: "sevro.claude.events",
              path: pathToFileURL(attemptPath).href,
              sha256: createHash("sha256").update(attemptText).digest("hex"),
            },
          ],
          "unavailable",
        ],
        [[{}], [], "unavailable"],
      ] as const) {
        const result = await fixtureExtensionRequest<{
          checks: Array<{ id: string; status: string; evidenceRefs: string[] }>;
        }>("evaluate", {
          caseId: id,
          extensionData: resolved.cases[0]!.extensionData,
          configuration: {},
          artifacts,
          builtinChecks: [],
          execution: { status: "completed" },
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
              data: { method: "stream_tool_calls", truncated: false, calls },
            },
          ],
        });
        expect(result.checks).toContainEqual(
          expect.objectContaining({
            id: "darrow.evals.transcript.1",
            status: expected,
            evidenceRefs:
              expected === "unavailable"
                ? []
                : ["sevro.claude.tool-calls", "sevro.claude.events"],
          }),
        );
      }
    }
    expect(resolved.cases[0]!.requiredEvidence).not.toContain(
      "sevro.codex.native-calls",
    );
    expect(resolved.cases[0]!.requiredEvidence).toContain(
      "sevro.host.native-controls",
    );
  }
});

test("current Claude assertions keep malformed tool evidence unavailable", async () => {
  const resolved = await fixtureExtensionRequest<{
    cases: Array<{ id: string; extensionData: Record<string, unknown> }>;
  }>("resolve", {
    projectRoot: pathToFileURL(join(import.meta.dir, "../..")).href,
    selectors: { caseIds: ["claude-readiness-nonready-stops"] },
    configuration: {},
  });
  const skill = {
    ordinal: 1,
    actor: "parent",
    name: "Skill",
    skill: "assess-implementation-readiness",
    invocation: "assess-implementation-readiness",
  };
  const agent = {
    ordinal: 1,
    actor: "parent",
    name: "Agent",
    toolUseId: "agent-use",
    subagentType: "probe",
    runInBackground: false,
    promptSha256: "a".repeat(64),
  };
  const malformed = [
    { method: "stream_tool_calls", truncated: false, calls: [{}] },
    ...[
      { ...skill, invocation: undefined },
      { ...skill, ordinal: 0 },
      { ...skill, actor: "unknown" },
      { ...agent, toolUseId: undefined },
      { ...agent, subagentType: undefined },
      { ...agent, promptSha256: "bad" },
    ].map((call) => ({
      method: "stream_tool_calls",
      truncated: false,
      calls: [call],
    })),
    { method: "unsupported", truncated: false, calls: [] },
    { method: "stream_tool_calls", truncated: false, calls: [skill, skill] },
  ];
  const examples = [
    ...malformed.map((data) => ({
      data,
      statuses: ["unavailable", "unavailable", "unavailable"],
    })),
    {
      data: { method: "stream_tool_calls", truncated: false, calls: [] },
      statuses: ["failed", "passed", "passed"],
    },
  ];
  for (const { data, statuses } of examples) {
    const result = await fixtureExtensionRequest<{
      checks: Array<{ id: string; status: string }>;
    }>("evaluate", {
      caseId: resolved.cases[0]!.id,
      extensionData: resolved.cases[0]!.extensionData,
      configuration: {},
      artifacts: [],
      observations: [
        {
          id: "sevro.claude.tool-calls",
          source: "sevro.host.claude",
          completeness: "complete",
          data,
        },
      ],
    });
    for (const [index, status] of statuses.entries())
      expect(result.checks).toContainEqual(
        expect.objectContaining({
          id: `darrow.evals.transcript.${index + 1}`,
          status,
        }),
      );
  }
});

test("current ordinary engineering distinguishes absence, activation and unavailable native goals", async () => {
  const resolved = await fixtureExtensionRequest<{
    cases: Array<{ id: string; extensionData: Record<string, unknown> }>;
  }>("resolve", {
    projectRoot: pathToFileURL(join(import.meta.dir, "../..")).href,
    selectors: { caseIds: ["goal-ordinary-engineering-does-not-activate"] },
    configuration: {},
  });
  for (const [completeness, data, expected] of [
    ["complete", { threadId: "root", goals: [], goalStatus: null }, "passed"],
    [
      "complete",
      {
        threadId: "root",
        goals: [{ status: "active", characters: 12 }],
        goalStatus: "active",
      },
      "failed",
    ],
    [
      "unavailable",
      { threadId: "root", goals: [], goalStatus: null },
      "unavailable",
    ],
  ] as const) {
    const result = await fixtureExtensionRequest<{
      checks: Array<{ id: string; status: string }>;
    }>("evaluate", {
      caseId: resolved.cases[0]!.id,
      extensionData: resolved.cases[0]!.extensionData,
      observations: [
        {
          id: "sevro.host.native-goal",
          source: "sevro.host.codex",
          completeness,
          data,
        },
      ],
      artifacts: [],
      configuration: {},
    });
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        id: "darrow.evals.native-goal",
        status: expected,
      }),
    );
  }
});

test("contradictory native goal history remains unavailable", async () => {
  const resolved = await fixtureExtensionRequest<{
    cases: Array<{ id: string; extensionData: Record<string, unknown> }>;
  }>("resolve", {
    projectRoot: pathToFileURL(join(import.meta.dir, "../..")).href,
    selectors: { caseIds: ["goal-preflight-high-risk-routine"] },
    configuration: {},
  });
  for (const data of [
    {
      threadId: "root",
      goals: [{ status: "active", characters: 12 }],
      goalStatus: "complete",
    },
    { threadId: "root", goals: [], goalStatus: "active" },
  ]) {
    const result = await fixtureExtensionRequest<{
      checks: Array<{ id: string; status: string }>;
    }>("evaluate", {
      caseId: resolved.cases[0]!.id,
      extensionData: resolved.cases[0]!.extensionData,
      observations: [
        {
          id: "sevro.host.native-goal",
          source: "sevro.host.codex",
          completeness: "complete",
          data,
        },
      ],
      artifacts: [],
      configuration: {},
    });
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        id: "darrow.evals.native-goal",
        status: "unavailable",
      }),
    );
  }
});

test("current native transcript checks declare required host facts", async () => {
  for (const [id, facts] of [
    [
      "goal-ordinary-engineering-does-not-activate",
      ["sevro.codex.skill-reads", "sevro.codex.events"],
    ],
    ["goal-preflight-high-risk-routine", ["sevro.host.native-controls"]],
    ["claude-readiness-nonready-stops", ["sevro.claude.tool-calls"]],
  ] as const) {
    const result = await fixtureExtensionRequest<{
      cases: Array<{ requiredEvidence: string[] }>;
    }>("resolve", {
      projectRoot: pathToFileURL(join(import.meta.dir, "../..")).href,
      selectors: { caseIds: [id] },
      configuration: {},
    });
    for (const fact of facts)
      expect(result.cases[0]!.requiredEvidence).toContain(fact);
  }
});

test("native route grading refuses observations attributed to another host", async () => {
  const resolved = await fixtureExtensionRequest<{
    cases: Array<{ id: string; extensionData: Record<string, unknown> }>;
  }>("resolve", {
    projectRoot: pathToFileURL(join(import.meta.dir, "../..")).href,
    selectors: { caseIds: ["goal-preflight-high-risk-routine"] },
    configuration: {},
  });
  const result = await fixtureExtensionRequest<{
    checks: Array<{ id: string; status: string }>;
  }>("evaluate", {
    caseId: resolved.cases[0]!.id,
    extensionData: resolved.cases[0]!.extensionData,
    configuration: {},
    artifacts: [],
    observations: [
      {
        id: "sevro.codex.native-calls",
        source: "sevro.host.claude",
        completeness: "complete",
        data: {
          acceptedSpawns: [{ model: "gpt-6-luna", reasoningEffort: "medium" }],
        },
      },
    ],
  });
  expect(result.checks).toContainEqual(
    expect.objectContaining({
      id: "darrow.evals.transcript.1",
      status: "unavailable",
    }),
  );
});

test("native route grading requires correlated acceptance and cites its observation", async () => {
  const resolved = await fixtureExtensionRequest<{
    cases: Array<{ id: string; extensionData: Record<string, unknown> }>;
  }>("resolve", {
    projectRoot: pathToFileURL(join(import.meta.dir, "../..")).href,
    selectors: { caseIds: ["goal-preflight-high-risk-routine"] },
    configuration: {},
  });
  const evaluate = (data: Record<string, unknown>) =>
    fixtureExtensionRequest<{
      checks: Array<{ id: string; status: string; evidenceRefs: string[] }>;
    }>("evaluate", {
      caseId: resolved.cases[0]!.id,
      extensionData: resolved.cases[0]!.extensionData,
      configuration: {},
      artifacts: [],
      observations: [
        {
          id: "sevro.codex.native-calls",
          source: "sevro.host.codex",
          completeness: "complete",
          data,
        },
      ],
    });
  const spawn = {
    agentRef: "child",
    threadId: "child-thread",
    requestedOrdinal: 1,
    startedOrdinal: 2,
    acceptedOrdinal: 3,
    model: "gpt-6-luna",
    reasoningEffort: "medium",
  };
  const data = {
    method: "native_session",
    calls: [
      {
        ordinal: 1,
        namespace: "collaboration",
        name: "spawn_agent",
        evidence: "invocation_attempt",
      },
    ],
    toolCalls: [
      { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
    ],
    submittedExecCalls: 0,
    acceptedSpawns: [spawn],
  };
  const invalid = await evaluate({ ...data, toolCalls: [] });
  expect(invalid.checks).toContainEqual(
    expect.objectContaining({
      id: "darrow.evals.transcript.1",
      status: "unavailable",
    }),
  );
  const valid = await evaluate(data);
  expect(valid.checks).toContainEqual(
    expect.objectContaining({
      id: "darrow.evals.transcript.1",
      status: "passed",
      evidenceRefs: ["sevro.codex.native-calls"],
    }),
  );
});
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("public extension mounts plugin references and excludes their evals", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-main-sync-reference-"));
  roots.push(root);
  const plugin = join(root, "plugins/capability/probe");
  for (const part of [
    ".claude-plugin",
    ".codex-plugin",
    "skills/probe/evals",
    "references/evals",
  ])
    await mkdir(join(plugin, part), { recursive: true });
  await writeFile(
    join(plugin, ".claude-plugin/plugin.json"),
    JSON.stringify({ name: "probe", version: "0.1.0" }),
  );
  await writeFile(
    join(plugin, ".codex-plugin/plugin.json"),
    JSON.stringify({ name: "probe", version: "0.1.0", skills: "./skills/" }),
  );
  await writeFile(
    join(plugin, "skills/probe/SKILL.md"),
    "---\nname: probe\ndescription: Reference fixture\n---\nRead ../../references/context.md\n",
  );
  await writeFile(join(plugin, "references/context.md"), "Mounted reference");
  await writeFile(join(plugin, "references/evals/hidden.md"), "Hidden oracle");
  await writeFile(
    join(plugin, "skills/probe/evals/case.yaml"),
    JSON.stringify({
      id: "reference-probe",
      invariant: "SE-C18",
      prompt: "Read the reference",
      fixture: {
        commits: [{ message: "Initial", files: { "README.md": "fixture" } }],
      },
      checks: [],
    }),
  );
  const resolved = await fixtureExtensionRequest<{
    cases: Array<{ id: string; extensionData: Record<string, unknown> }>;
  }>("resolve", {
    projectRoot: pathToFileURL(root).href,
    selectors: { caseIds: ["reference-probe"] },
    configuration: {},
  });
  const prepared = await fixtureExtensionRequest<{
    artifacts: Array<{ relativePath: string; contentBase64: string }>;
  }>("prepare", {
    case: resolved.cases[0],
    configuration: {},
    host: {
      id: "sevro.host.codex",
      capabilities: ["sevro.codex.plugin-marketplace"],
    },
  });
  expect(
    prepared.artifacts.some(
      (item) =>
        item.relativePath.endsWith("/references/context.md") &&
        Buffer.from(item.contentBase64, "base64").toString() ===
          "Mounted reference",
    ),
  ).toBe(true);
  expect(
    prepared.artifacts.some((item) =>
      item.relativePath.includes("references/evals"),
    ),
  ).toBe(false);
});

test("current native goal cases preserve their transcript assertions", async () => {
  const root = join(import.meta.dir, "../..");
  for (const id of [
    "goal-preflight-bounded-native-goal",
    "goal-preflight-high-risk-routine",
    "claude-readiness-nonready-stops",
    "goal-readiness-iterative-resolution",
    "goal-review-high-selected-claude",
  ]) {
    const reply = await fixtureExtensionRequest<{
      cases: Array<{ id: string; checks: Array<{ id: string }> }>;
    }>("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: [id] },
      configuration: {},
    });
    expect(
      reply.cases[0]!.checks.some((check) =>
        check.id.startsWith("darrow.evals.transcript."),
      ),
    ).toBe(true);
  }
});

test("public extension translates saved-artifact checks for Sevro", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-main-sync-artifact-"));
  roots.push(root);
  const directory = join(root, "evals/experiments/probe/cases");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "case.yaml"),
    JSON.stringify({
      id: "artifact-probe",
      invariant: "SE-R4",
      prompt: "Save a decision",
      fixture: {
        commits: [{ message: "Initial", files: { "README.md": "fixture" } }],
      },
      checks: [],
      semantic_artifact: {
        path: "docs/decisions/decision-*.md",
        checks: [
          {
            name: "decision authority",
            proposition: "The document records a proposed decision.",
          },
        ],
      },
    }),
  );
  const reply = await fixtureExtensionRequest<{
    cases: Array<{
      checks: Array<{
        id: string;
        grader: string;
        configuration: Record<string, unknown>;
      }>;
    }>;
  }>("resolve", {
    projectRoot: pathToFileURL(root).href,
    selectors: { caseIds: ["artifact-probe"] },
    configuration: {},
  });
  expect(reply.cases[0]!.checks).toContainEqual({
    id: "darrow.semantic-artifact.1",
    grader: "sevro.semantic",
    configuration: {
      artifactPath: "docs/decisions/decision-*.md",
      proposition: "The document records a proposed decision.",
    },
  });
});

test("public extension grades native main-thread activation independently", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-main-sync-"));
  roots.push(root);
  const directory = join(root, "evals/experiments/probe/cases");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "case.yaml"),
    JSON.stringify({
      id: "native-probe",
      invariant: "SE-C33",
      prompt: "Return ready",
      fixture: {
        commits: [{ message: "Initial", files: { "README.md": "fixture" } }],
      },
      checks: [],
      native_goal: "required",
    }),
  );
  const resolved = await fixtureExtensionRequest<{
    cases: Array<{
      id: string;
      checks: Array<{ id: string }>;
      requiredEvidence: string[];
      extensionData: Record<string, unknown>;
    }>;
  }>("resolve", {
    projectRoot: pathToFileURL(root).href,
    selectors: { caseIds: ["native-probe"] },
    configuration: {},
  });
  const selected = resolved.cases[0]!;
  expect(selected.requiredEvidence).toContain("sevro.host.native-goal");
  for (const [completeness, status, expected] of [
    ["complete", "complete", "passed"],
    ["complete", null, "failed"],
    ["unavailable", null, "unavailable"],
  ] as const) {
    const reply = await fixtureExtensionRequest<{
      checks: Array<{ id: string; status: string }>;
    }>("evaluate", {
      caseId: selected.id,
      extensionData: selected.extensionData,
      configuration: {},
      observations: [
        {
          id: "sevro.host.native-goal",
          source: "sevro.host.codex",
          completeness,
          data: {
            threadId: "root",
            goals: status ? [{ status, characters: 12 }] : [],
            goalStatus: status,
          },
        },
        {
          id: "sevro.observation.final-message",
          source: "sevro.host.codex",
          completeness: "complete",
          data: { text: "Completed the task." },
        },
      ],
      artifacts: [],
    });
    expect(reply.checks).toContainEqual(
      expect.objectContaining({
        id: "darrow.evals.native-goal",
        status: expected,
      }),
    );
  }
});
