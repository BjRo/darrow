import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyze } from "../src/analyze";
import { loadProtocol } from "../src/config";
import type { Corpus, Harness, Observation, Treatment } from "../src/types";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

test("mechanically applies the confirmatory continue gate at task level", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-analysis-test-"));
  roots.push(root);
  const protocol = await loadProtocol();
  protocol.design.bootstrapSamples = 500;
  protocol.design.randomizationSamples = 500;
  const tasks = Array.from({ length: 26 }, (_, index) => ({
    id: `task-${index}`,
    repository: index % 2 ? "mynab" : "credfolio2",
    phase: "confirmatory" as const,
    stratum: index % 4 < 2 ? ("simple" as const) : ("orchestrated" as const),
    baseRevision: "a".repeat(40),
    oracleRevision: "b".repeat(40),
    prompt: "task",
    verificationCommand: "true",
    grading: "mixed" as const,
    rubric: ["correct"],
  }));
  const corpus: Corpus = {
    schemaVersion: "1.0.0",
    repositories: [
      {
        id: "mynab",
        url: "https://example.test/mynab",
        pinnedRevision: "c".repeat(40),
        setupCommand: "true",
      },
      {
        id: "credfolio2",
        url: "https://example.test/credfolio2",
        pinnedRevision: "d".repeat(40),
        setupCommand: "true",
      },
    ],
    tasks,
  };
  let ordinal = 0;
  for (const task of tasks)
    for (const harness of ["codex", "claude"] as Harness[])
      for (const treatment of ["native", "plugins", "cli"] as Treatment[])
        for (let repeat = 1; repeat <= 2; repeat++) {
          ordinal++;
          const quality =
            treatment === "cli" ? 0.8 : treatment === "plugins" ? 0.7 : 0.6;
          const runId = `run-${ordinal}`;
          const observation: Observation = {
            schemaVersion: "1.0.0",
            runId,
            assignment: {
              ordinal,
              taskId: task.id,
              repository: task.repository,
              phase: "confirmatory",
              stratum: task.stratum,
              harness,
              treatment,
              repeat,
              order: 1,
            },
            startedAt: new Date(0).toISOString(),
            finishedAt: new Date(1).toISOString(),
            status: "completed",
            setupFailure: null,
            operationalFailure: null,
            harnessVersion: protocol.harnesses[harness].version,
            model: protocol.harnesses[harness].model,
            effort: "high",
            permissionMode: "test",
            sourceRevision: "c".repeat(40),
            runnerRevision: "e".repeat(40),
            pluginDigest: `sha256:${"f".repeat(64)}`,
            configurationDigest: `sha256:${"a".repeat(64)}`,
            sanitizationDigest: `sha256:${"b".repeat(64)}`,
            inputTokens: treatment === "cli" ? 120 : 100,
            outputTokens: 0,
            costUsd: null,
            wallTimeMs: treatment === "cli" ? 1200 : 1000,
            preparationTimeMs: 100,
            harnessTimeMs: 900,
            humanAttentionMinutes: treatment === "cli" ? 0.8 : 1,
            interventions: 0,
            failures: 0,
            retries: 0,
            recovered: false,
            reworkCount: 0,
            deterministicQuality: quality,
            blindedQuality: quality,
            quality,
            verification: null,
            patchPath: null,
            rawOutputPath: "raw",
            darrowRunId: null,
            retainedWorkspacePath: null,
          };
          const directory = join(root, "runs", runId);
          await mkdir(directory, { recursive: true });
          await writeFile(
            join(directory, "observation.json"),
            JSON.stringify(observation),
          );
        }

  const report = await analyze(protocol, corpus, root);
  expect(report.decision).toBe("continue");
  expect(report.distinctTasks).toBe(26);
  expect((report.economics as any).modelResourceRatio).toBeCloseTo(1.2);
});
