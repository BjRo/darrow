import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeOperationalDiagnostic } from "../src/operations";
import type { Harness, Observation, OperationalDiagnostic } from "../src/types";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("playbook-autonomy analysis (PV-19)", () => {
  test("keeps structural autonomy separate from annotated attention", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-operations-test-"));
    roots.push(root);
    const diagnostic: OperationalDiagnostic = {
      schemaVersion: "1.0.0",
      id: "test",
      phase: "pilot",
      repeats: 1,
      treatments: ["manual-playbook", "cli-playbook"],
      taskIds: ["simple", "complex-a", "complex-b"],
    };
    let ordinal = 0;
    for (const taskId of diagnostic.taskIds) {
      for (const harness of ["codex", "claude"] as Harness[]) {
        for (const treatment of diagnostic.treatments) {
          ordinal += 1;
          const manual = treatment === "manual-playbook";
          const runId = `run-${ordinal}`;
          const runRoot = join(root, "runs", runId);
          await mkdir(runRoot, { recursive: true });
          const observation = {
            runId,
            assignment: {
              ordinal,
              taskId,
              repository: "repo",
              phase: "pilot",
              stratum: taskId === "simple" ? "simple" : "orchestrated",
              harness,
              treatment,
              repeat: 1,
              order: manual ? 1 : 2,
            },
            status: "completed",
            quality: manual ? 0.7 : 0.8,
            wallTimeMs: manual ? 1_100 : 1_000,
            inputTokens: manual ? 100 : 95,
            outputTokens: 10,
            costUsd: manual ? 0.2 : 0.19,
            humanAttentionMinutes: manual ? 2 : 1,
            operationalMetrics: {
              operatorLaunchesRequired: manual ? 2 : 1,
              operatorHandoffsRequired: manual ? 1 : 0,
              expectedStages: 2,
              executedStages: 2,
              finishedStages: 2,
              unattendedCompletion: !manual,
            },
          } as Observation;
          await writeFile(
            join(runRoot, "observation.json"),
            JSON.stringify(observation),
          );
        }
      }
    }

    const report = await analyzeOperationalDiagnostic(diagnostic, root);
    expect(report.observations).toBe(12);
    expect(report.attentionComplete).toBe(true);
    expect(report.cliMinusManual.quality).toBeCloseTo(0.1);
    expect(report.cliMinusManual.humanAttentionMinutes).toBe(-1);
    expect(report.cliToManual.wallTime).toBeCloseTo(1_000 / 1_100);
    expect(report.cliToManual.humanAttention).toBe(0.5);
    expect(report.treatments["manual-playbook"]).toEqual(
      expect.objectContaining({
        meanOperatorLaunchesRequired: 2,
        meanOperatorHandoffsRequired: 1,
        unattendedCompletionRate: 0,
      }),
    );
    expect(report.treatments["cli-playbook"]).toEqual(
      expect.objectContaining({
        meanOperatorLaunchesRequired: 1,
        meanOperatorHandoffsRequired: 0,
        unattendedCompletionRate: 1,
      }),
    );
  });

  test("does not infer zero attention from evaluator automation", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-operations-test-"));
    roots.push(root);
    const diagnostic: OperationalDiagnostic = {
      schemaVersion: "1.0.0",
      id: "test",
      phase: "pilot",
      repeats: 1,
      treatments: ["manual-playbook", "cli-playbook"],
      taskIds: ["simple", "complex-a", "complex-b"],
    };
    const runRoot = join(root, "runs", "run-1");
    await mkdir(runRoot, { recursive: true });
    await writeFile(
      join(runRoot, "observation.json"),
      JSON.stringify({
        runId: "run-1",
        assignment: { treatment: "cli-playbook" },
        humanAttentionMinutes: null,
      } as Observation),
    );

    const report = await analyzeOperationalDiagnostic(diagnostic, root);
    expect(report.attentionComplete).toBe(false);
    expect(report.cliMinusManual.humanAttentionMinutes).toBeNull();
  });
});
