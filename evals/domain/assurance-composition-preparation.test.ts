import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureExtensionRequest } from "./fixture-command";

type Case = {
  id: string;
  requiredEvidence: string[];
  extensionData: Record<string, unknown>;
};
async function prepared(caseId: string) {
  const projectRoot = pathToFileURL(resolve(import.meta.dir, "../..")).href;
  const result = await fixtureExtensionRequest<{ cases: Case[] }>("resolve", {
    projectRoot,
    selectors: { caseIds: [caseId] },
    configuration: {},
  });
  expect(result.cases).toHaveLength(1);
  if (caseId.includes("inline"))
    expect(result.cases[0]!.requiredEvidence).toContain(
      "sevro.host.native-transcripts",
    );
  return fixtureExtensionRequest<{
    artifacts: { gitExclude?: boolean; relativePath: string }[];
    fixtureSetup: { environment: Record<string, string> };
  }>("prepare", {
    case: result.cases[0],
    configuration: {},
    condition: "passive",
    host: {
      id: "sevro.host.codex",
      capabilities: [
        "sevro.codex.plugin-marketplace",
        "sevro.codex.explicit-invocation",
        "sevro.codex.native-calls",
        "sevro.host.native-controls",
      ],
    },
  });
}
test("real assurance compositions fit the native fixture environment without unused mount metadata", async () => {
  for (const id of [
    "ticket-to-pr-inline-assurance-composition",
    "goal-inline-verification-initial-and-followup",
  ]) {
    const result = await prepared(id);
    expect(
      Buffer.byteLength(JSON.stringify(result.fixtureSetup.environment)),
    ).toBeLessThanOrEqual(16 * 1024);
    expect(
      result.fixtureSetup.environment.DARROW_EVAL_MOUNT_EXCLUDES,
    ).toBeUndefined();
    expect(result.artifacts.some((artifact) => artifact.gitExclude)).toBeTrue();
  }
});
test("fixtures that request mount exclusions retain their exact actual paths", async () => {
  const result = await prepared(
    "prepare-task-branch-guard-correlated-creation",
  );
  expect(
    JSON.parse(result.fixtureSetup.environment.DARROW_EVAL_MOUNT_EXCLUDES!),
  ).toEqual(
    result.artifacts
      .filter((artifact) => artifact.gitExclude)
      .map((artifact) => artifact.relativePath),
  );
});

test("Claude doctor prepares with native no-child evidence and retains missing or violated controls", async () => {
  const resolved = await fixtureExtensionRequest<{ cases: Case[] }>("resolve", {
    projectRoot: pathToFileURL(resolve(import.meta.dir, "../..")).href,
    selectors: { caseIds: ["doctor-adaptive-goal-claude-inline-capacity"] },
    configuration: {},
  });
  const selected = resolved.cases[0]!;
  await fixtureExtensionRequest("prepare", {
    case: selected,
    configuration: {},
    condition: "passive",
    host: {
      id: "sevro.host.claude",
      capabilities: [
        "sevro.claude.plugin-dirs",
        "sevro.claude.explicit-invocation",
        "sevro.host.native-controls",
      ],
    },
  });
  const native = {
    id: "sevro.host.native-controls",
    source: "sevro.host.claude",
    completeness: "complete",
    data: {
      method: "native_control_calls",
      calls: [] as { ordinal: number; namespace: string; name: string }[],
      acceptedAgentCount: null,
      submittedExecCalls: null,
      truncated: false,
    },
  };
  for (const [observations, expected] of [
    [[native], "passed"],
    [[], "unavailable"],
    [[{ ...native, completeness: "partial" }], "unavailable"],
    [
      [
        {
          ...native,
          data: {
            ...native.data,
            calls: [{ ordinal: 1, namespace: "claude", name: "Agent" }],
          },
        },
      ],
      "failed",
    ],
  ] as const) {
    const result = await fixtureExtensionRequest<{
      checks: { id: string; status: string }[];
      domainOutcomes: { id: string; status: string }[];
    }>("evaluate", { observations, extensionData: selected.extensionData });
    expect(
      result.domainOutcomes.find(
        (entry) => entry.id === "darrow.evals.workflow.transcript.1",
      )?.status,
    ).toBe(expected);
  }
});
