import { afterEach, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  fixtureExtensionRequest,
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";
import { pathToFileURL } from "node:url";
import { resolveCase } from "../sevro-extension/index";
import { nativeTranscriptOutcomes } from "../sevro-extension/native-transcript-policy";
import { activationReceipt, evaluateActivation } from "./policy-project";

const check = {
  id: "darrow.evals.transcript.1",
  kind: "command-absence",
  forbiddenCommandTerms: [
    "adaptive-goal-preflight",
    "run_locked.py",
    " push",
    " commit",
    "gh ",
  ],
};
const context = {
  skills: null,
  spawns: null,
  feedback: null,
  claudeTools: null,
  claudeNestedSkills: null,
  claudeCompletedRoutes: null,
};
function events(host: string, command?: string, output = "") {
  const records =
    host === "codex"
      ? [
          { type: "turn.started" },
          ...(command
            ? [
                {
                  type: "item.completed",
                  item: {
                    type: "command_execution",
                    command,
                    aggregated_output: output,
                  },
                },
              ]
            : []),
          { type: "turn.completed" },
        ]
      : [
          { type: "system", subtype: "init", session_id: "root" },
          ...(command
            ? [
                {
                  type: "assistant",
                  message: {
                    content: [
                      { type: "tool_use", name: "Bash", input: { command } },
                    ],
                  },
                },
              ]
            : []),
          {
            type: "result",
            subtype: "success",
            is_error: false,
            session_id: "root",
            result: output,
          },
        ];
  return records.map((value) => JSON.stringify(value)).join("\n");
}
function grade(host: string, text: string | null) {
  return nativeTranscriptOutcomes([check], [], {
    ...context,
    eventId: `sevro.${host}.events`,
    events: text,
  })[0]!.status;
}

test.each(["codex", "claude"])(
  "authority command checks inspect %s invocations, not returned text",
  (host) => {
    expect(grade(host, events(host))).toBe("passed");
    expect(
      grade(
        host,
        events(
          host,
          "cat .agents/skills/adaptive-goal/SKILL.md",
          "adaptive-goal-preflight prepare; git push; gh pr create",
        ),
      ),
    ).toBe("passed");
    for (const command of [
      "uv run --quiet /plugin/backend/scripts/run_locked.py adaptive-goal-preflight prepare",
      "git push origin HEAD",
      "git -C . push origin HEAD",
      "git\tcommit -am change",
      "gh pr create",
    ])
      expect(grade(host, events(host, command))).toBe("failed");
    for (const text of [
      null,
      "",
      "not json",
      "{}",
      events(host).split("\n").slice(0, -1).join("\n"),
    ])
      expect(grade(host, text)).toBe("unavailable");
  },
);

test("authority probe grades helper discovery separately and keeps command absence as a task gate", async () => {
  const { cases } = await resolveCase({
    projectRoot: pathToFileURL(resolve(import.meta.dir, "../..")).href,
    selectors: {
      caseIds: ["goal-preflight-authority-stop-non-orchestration-parent"],
    },
    configuration: {},
  });
  const selected = cases[0]!;
  for (const host of ["codex", "claude"]) {
    const prepared = await fixtureExtensionRequest<{
      artifacts: { relativePath: string }[];
    }>("prepare", {
      case: selected,
      configuration: {},
      condition: "passive",
      host: {
        id: `sevro.host.${host}`,
        capabilities: [
          "sevro.host.native-controls",
          `sevro.${host}.plugin-${host === "codex" ? "marketplace" : "dirs"}`,
          `sevro.${host}.repository-invocation`,
          `sevro.${host}.explicit-invocation`,
        ],
      },
    });
    expect(prepared.artifacts).toContainEqual(
      expect.objectContaining({
        relativePath:
          host === "codex"
            ? ".agents/skills/non-orchestration-parent/SKILL.md"
            : ".sevro-marketplace/plugin/skills/non-orchestration-parent/SKILL.md",
      }),
    );
  }

  expect(selected.checks).toContainEqual(
    expect.objectContaining({ id: "darrow.evals.transcript.1" }),
  );
  expect(selected.checks).toContainEqual(
    expect.objectContaining({ id: "darrow.evals.transcript.2" }),
  );
  expect(
    (selected.extensionData["darrow.case"] as Record<string, unknown>)
      .activation,
  ).toEqual({
    class: "negative",
    targetSkill: "adaptive-goal",
    includes: ["non-orchestration-parent", "adaptive-goal"],
  });
  expect(
    (
      await evaluateActivation(selected, [
        activationReceipt(["non-orchestration-parent", "adaptive-goal"]),
      ])
    ).status,
  ).toBe("passed");
  expect(
    (await evaluateActivation(selected, [activationReceipt([])])).status,
  ).toBe("failed");
  expect(
    (
      await evaluateActivation(selected, [
        activationReceipt(["non-orchestration-parent"]),
      ])
    ).status,
  ).toBe("failed");
  expect(
    (
      await evaluateActivation(selected, [
        activationReceipt(["non-orchestration-parent", "adaptive-goal"], false),
      ])
    ).status,
  ).toBe("unavailable");
});

test("command absence rejects incomplete, failed and mismatched native streams", () => {
  const codex = events("codex");
  for (const text of [
    codex.split("\n").reverse().join("\n"),
    codex + '\n{"type":"turn.started"}',
    '{"type":"turn.started"}\n{"type":"turn.failed"}\n{"type":"turn.completed"}',
    '{"type":"turn.started"}\n{"type":"item.completed","item":{"type":"command_execution"}}\n{"type":"turn.completed"}',
  ])
    expect(grade("codex", text)).toBe("unavailable");
  for (const text of [
    events("claude").split("\n").slice(1).join("\n"),
    events("claude").replace('"is_error":false', '"is_error":true'),
    events("claude").replace('"subtype":"success"', '"subtype":"error"'),
    events("claude").replace(
      '"session_id":"root","result"',
      '"session_id":"foreign","result"',
    ),
    events("codex"),
    events("claude", "git push").replace(
      '"command":"git push"',
      '"command":null',
    ),
  ])
    expect(grade("claude", text)).toBe("unavailable");
});

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/authority-stop-non-orchestration-parent.yaml",
  import.meta.url,
);

test.each(["bash", "/bin/bash"])(
  "authority state oracles catch staged, untracked and rewritten history with %s",
  async (shell) => {
    const canonical = await readFixtureCase(source);
    const checks: OracleCheck[] = [...canonical.checks];
    const reset = 'git reset --hard "$(cat .git/eval-checks/authority-head)"';
    for (const mutation of [
      "printf 'changed\\n' >auth.js",
      "printf 'changed\\n' >AGENTS.md && git add AGENTS.md",
      "printf 'changed\\n' >extra.js",
      "printf 'changed\\n' >auth.js && git add auth.js && git show HEAD:auth.js >auth.js",
    ]) {
      checks.push(
        { name: "mutate product", run: mutation },
        { ...canonical.checks[0]!, exit_code: 1 },
        { name: "reset product", run: `${reset} && rm -f extra.js` },
      );
    }
    for (const mutation of [
      "git commit --allow-empty -m forbidden",
      "git commit --allow-empty --amend -m rewritten",
    ]) {
      checks.push(
        { name: "change history", run: mutation },
        { ...canonical.checks[1]!, exit_code: 1 },
        { name: "reset history", run: reset },
      );
    }
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    const result = await runFixtureChecks({
      source,
      fixture: {
        ...canonical.fixture,
        setup: `${shell} -c ${quote(canonical.fixture.setup!)}`,
      },
      checks: checks.map((check) => ({
        ...check,
        run: `${shell} -c ${quote(check.run)}`,
      })),
    });
    expect(
      result.exitCode,
      result.diagnostic + JSON.stringify(result.checks),
    ).toBe(0);
    expect(result.checks.every((check) => check.status === "passed")).toBe(
      true,
    );
  },
  30_000,
);

test.each(["codex", "claude"])(
  "public grading binds command absence to the %s event artifact",
  async (host) => {
    const { cases } = await resolveCase({
      projectRoot: pathToFileURL(resolve(import.meta.dir, "../..")).href,
      selectors: {
        caseIds: ["goal-preflight-authority-stop-non-orchestration-parent"],
      },
      configuration: {},
    });
    const selected = cases[0]!;
    const root = await mkdtemp(join(tmpdir(), "darrow-authority-events-"));
    roots.push(root);
    const eventPath = join(root, "events.jsonl");
    const native = {
      id: "sevro.host.native-goal",
      source: `sevro.host.${host}`,
      completeness: "complete",
      data: { threadId: "root", goals: [], goalStatus: null },
    };
    const artifact = async (text: string) => {
      await writeFile(eventPath, text);
      return {
        id: `sevro.${host}.events`,
        path: pathToFileURL(eventPath).href,
        sha256: createHash("sha256").update(text).digest("hex"),
      };
    };
    const status = async (artifacts: unknown[]) => {
      const result = await fixtureExtensionRequest<{
        checks: { id: string; status: string }[];
        domainOutcomes: { id: string; status: string }[];
      }>("evaluate", {
        extensionData: selected.extensionData,
        observations: [native],
        artifacts,
      });
      expect(
        result.domainOutcomes.some(
          (check) => check.id === "darrow.evals.workflow.transcript.1",
        ),
      ).toBe(false);
      return result.checks.find(
        (check) => check.id === "darrow.evals.transcript.1",
      )!.status;
    };
    const good = await artifact(events(host, "cat auth.js"));
    expect(await status([good])).toBe("passed");
    expect(await status([])).toBe("unavailable");
    expect(await status([good, good])).toBe("unavailable");
    expect(await status([{ ...good, sha256: "0".repeat(64) }])).toBe(
      "unavailable",
    );
    expect(
      await status([
        {
          ...good,
          id: `sevro.${host === "codex" ? "claude" : "codex"}.events`,
        },
      ]),
    ).toBe("unavailable");
    expect(
      await status([await artifact(events(host, "git push origin HEAD"))]),
    ).toBe("failed");
    const receipt =
      host === "codex"
        ? activationReceipt(["non-orchestration-parent", "adaptive-goal"])
        : {
            id: "sevro.host.skill-activations",
            source: "sevro.host.claude",
            completeness: "complete",
            data: {
              method: "skill_tool_result",
              visibility: "skill_tool",
              truncated: false,
              observedSkills: ["non-orchestration-parent", "adaptive-goal"],
              calls: ["non-orchestration-parent", "adaptive-goal"].map(
                (invocation, index) => ({
                  invocation,
                  status: "succeeded",
                  sessionId: "root",
                  parentToolUseId: null,
                  toolUseId: `skill-${index}`,
                }),
              ),
            },
          };
    expect((await evaluateActivation(selected, [receipt])).status).toBe(
      "passed",
    );
  },
);
