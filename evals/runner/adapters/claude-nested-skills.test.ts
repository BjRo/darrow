import { expect, test } from "bun:test";
import {
  mergeClaudeNestedSkillActivation,
  observeClaudeNestedSkills,
  recoverClaudeNestedSkills,
} from "./claude-nested-skills";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const sessionId = "session-1";
const entry = (
  agentId: string | undefined,
  timestamp: number,
  value: object,
) => ({
  sessionId,
  agentId,
  timestamp: new Date(timestamp).toISOString(),
  ...value,
});
const skill = (agent: string | undefined, time: number, invocation: string) =>
  entry(agent, time, {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          name: "Skill",
          input: { skill: invocation, args: "private" },
        },
      ],
    },
  });
const launch = (agent: string | undefined, child: string, time: number) => [
  entry(agent, time, {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          name: "Agent",
          id: child,
          input: { prompt: "private" },
        },
      ],
    },
  }),
  entry(agent, time + 10, {
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: child }] },
    toolUseResult: { status: "completed", agentId: child },
  }),
];
const jsonl = (entries: object[]) =>
  entries.map((e) => JSON.stringify(e)).join("\n");
const rootTranscript = jsonl([
  skill(undefined, 1, "adaptive-delivery"),
  ...launch(undefined, "owner", 2),
]);
const children: Record<string, string> = {
  owner: jsonl([
    skill("owner", 3, "darrow-verification:verify-change"),
    ...launch("owner", "provider", 4),
  ]),
  provider: jsonl([skill("provider", 5, "darrow-review:code-review")]),
};
const recover = (
  overrides: Partial<Parameters<typeof recoverClaudeNestedSkills>[0]> = {},
) =>
  recoverClaudeNestedSkills({
    rootTranscript,
    sessionId,
    streamSkills: ["adaptive-delivery", "verify-change"],
    readAgent: async (id) => children[id]!,
    ...overrides,
  });

test("recovers only completed session-bound descendant Skill invocations", async () => {
  const read: string[] = [];
  const result = await recover({
    readAgent: async (id) => {
      read.push(id);
      return children[id]!;
    },
  });
  expect(result.complete).toBe(true);
  expect(result.observedSkills).toEqual([
    "adaptive-delivery",
    "verify-change",
    "code-review",
  ]);
  expect(read).toEqual(["owner", "provider"]);
  expect(JSON.stringify(result)).not.toContain("private");
  expect(result.invocations.at(-1)?.invocation).toBe(
    "darrow-review:code-review",
  );
});

test("missing, foreign, malformed, and uncorrelated native evidence cannot clear activation", async () => {
  for (const bad of [
    "",
    "{broken",
    children.provider!.replaceAll("session-1", "foreign"),
    children.provider!.replaceAll('"agentId":"provider"', '"agentId":"other"'),
  ]) {
    const result = await recover({
      readAgent: async (id) => (id === "provider" ? bad : children[id]!),
    });
    expect(result.complete).toBe(false);
    expect(result.observedSkills).not.toContain("code-review");
  }
  const result = await recover({
    rootTranscript: rootTranscript.replace(
      '"tool_use_id":"owner"',
      '"tool_use_id":"unbound"',
    ),
  });
  expect(result.complete).toBe(false);
  expect(result.observedSkills).not.toContain("code-review");
});

test("native order must preserve observed stream order", async () => {
  const result = await recover({
    streamSkills: ["verify-change", "adaptive-delivery"],
  });
  expect(result.complete).toBe(false);
});

test("merging retains earlier native dispatch unless an explicit expansion owns primary", async () => {
  const receipt = await recover();
  receipt.observedSkills = ["code-review", "verify-change"];
  const observation = {
    source: "harness_event" as const,
    complete: true,
    primarySkill: "verify-change",
    observedSkills: ["verify-change"],
  };
  expect(
    mergeClaudeNestedSkillActivation(observation, receipt).observedSkills,
  ).toEqual(["code-review", "verify-change"]);
  expect(
    mergeClaudeNestedSkillActivation(observation, receipt).primarySkill,
  ).toBe("code-review");
  expect(
    mergeClaudeNestedSkillActivation(observation, receipt, "adaptive-delivery")
      .observedSkills,
  ).toEqual(["adaptive-delivery", "code-review", "verify-change"]);
});

test("ignores non-message metadata and refuses repeated child receipts", async () => {
  const result = await recover({
    rootTranscript:
      JSON.stringify({ type: "file-history-snapshot" }) + "\n" + rootTranscript,
  });
  expect(result.complete).toBe(true);
  const repeated = await recover({
    rootTranscript:
      rootTranscript + "\n" + jsonl(launch(undefined, "owner", 20)),
  });
  expect(repeated.complete).toBe(false);
});

test("malformed Agent calls and excessive skill metadata stay incomplete and bounded", async () => {
  const malformed = jsonl([
    entry(undefined, 30, {
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Agent", input: {} }] },
    }),
  ]);
  expect(
    (await recover({ rootTranscript: rootTranscript + "\n" + malformed }))
      .complete,
  ).toBe(false);
  const excessive = await recover({
    rootTranscript: jsonl(
      Array.from({ length: 130 }, (_, i) =>
        skill(undefined, i + 1, `skill-${i}`),
      ),
    ),
    streamSkills: [],
  });
  expect(excessive.complete).toBe(false);
  expect(excessive.invocations.length).toBeLessThanOrEqual(128);
  expect(excessive.observedSkills.length).toBeLessThanOrEqual(128);
});

test("native sidecars bind nested results that omit top-level result metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "claude-nested-test-"));
  const repo = "/fixture";
  const project = join(directory, "projects", "-fixture");
  const agents = join(project, sessionId, "subagents");
  try {
    await mkdir(agents, { recursive: true });
    await writeFile(join(project, `${sessionId}.jsonl`), rootTranscript);
    const owner = children
      .owner!.split("\n")
      .map((line) => {
        const value = JSON.parse(line);
        delete value.toolUseResult;
        return JSON.stringify(value);
      })
      .join("\n");
    await writeFile(join(agents, "agent-owner.jsonl"), owner);
    await writeFile(join(agents, "agent-provider.jsonl"), children.provider!);
    const metadata = join(agents, "agent-provider.meta.json");
    const observe = () =>
      observeClaudeNestedSkills({
        repo,
        configRoot: directory,
        stream: JSON.stringify({ type: "result", session_id: sessionId }),
        streamSkills: ["adaptive-delivery", "verify-change"],
        matchingPaths: async (root, filename) => {
          const paths: string[] = [];
          for await (const path of new Bun.Glob("**/*").scan({
            cwd: root,
            absolute: true,
            onlyFiles: true,
          }))
            if (
              typeof filename === "string"
                ? basename(path) === filename
                : filename.test(basename(path))
            )
              paths.push(path);
          return paths;
        },
      });
    await writeFile(
      metadata,
      JSON.stringify({ toolUseId: "provider", parentAgentId: "owner" }),
    );
    expect((await observe()).observedSkills).toEqual([
      "adaptive-delivery",
      "verify-change",
      "code-review",
    ]);
    expect((await observe()).complete).toBe(true);
    for (const bad of [
      { toolUseId: "provider", parentAgentId: "foreign" },
      { toolUseId: "wrong", parentAgentId: "owner" },
    ]) {
      await writeFile(metadata, JSON.stringify(bad));
      expect((await observe()).complete).toBe(false);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("background and failed Agent returns cannot establish completion", async () => {
  const background = rootTranscript.replace(
    '"prompt":"private"',
    '"prompt":"private","run_in_background":true',
  );
  expect((await recover({ rootTranscript: background })).complete).toBe(false);
  const failed = rootTranscript.replace(
    '"tool_use_id":"owner"',
    '"tool_use_id":"owner","is_error":true',
  );
  expect((await recover({ rootTranscript: failed })).complete).toBe(false);
});
