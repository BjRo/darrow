import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyzeOperationalDiagnostic,
  analyzeOperatorStudy,
} from "../src/operations";
import type {
  Harness,
  Observation,
  OperationalDiagnostic,
  OperatorStudy,
} from "../src/types";

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
    expect(report.scope).toBe("full-diagnostic");
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

  test("analyzes a complete timed subset without treating it as the full diagnostic", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-operations-test-"));
    const reverificationRoot = await mkdtemp(
      join(tmpdir(), "darrow-operations-reverification-test-"),
    );
    roots.push(root);
    roots.push(reverificationRoot);
    const diagnostic: OperationalDiagnostic = {
      schemaVersion: "1.0.0",
      id: "test",
      phase: "pilot",
      repeats: 1,
      treatments: ["manual-playbook", "cli-playbook"],
      taskIds: ["simple", "complex-a", "complex-b"],
    };
    for (const [index, treatment] of diagnostic.treatments.entries()) {
      const runId = `run-${index}`;
      const runRoot = join(root, "runs", runId);
      await mkdir(runRoot, { recursive: true });
      const observationText = JSON.stringify({
        runId,
        assignment: {
          taskId: "complex-a",
          harness: "codex",
          treatment,
          repeat: 1,
        },
        humanAttentionMinutes: treatment === "manual-playbook" ? 2 : 1,
        deterministicQuality: treatment === "manual-playbook" ? 1 : 0,
        quality: treatment === "manual-playbook" ? 1 : 0,
        wallTimeMs: 1_000,
        inputTokens: 100,
        outputTokens: 10,
        costUsd: null,
      } as Observation);
      await writeFile(join(runRoot, "observation.json"), observationText);
      if (treatment === "cli-playbook") {
        const recordRoot = join(reverificationRoot, runId);
        await mkdir(recordRoot, { recursive: true });
        await writeFile(
          join(recordRoot, "reverification.json"),
          JSON.stringify({
            runId,
            deterministicQuality: 1,
            quality: 1,
            identity: {
              sourceObservationDigest: `sha256:${new Bun.CryptoHasher("sha256")
                .update(observationText)
                .digest("hex")}`,
            },
          }),
        );
      }
    }

    const report = await analyzeOperationalDiagnostic(
      diagnostic,
      root,
      true,
      reverificationRoot,
    );

    expect(report.scope).toBe("observed-subset");
    expect(report.observations).toBe(2);
    expect(report.expectedObservations).toBe(2);
    expect(report.reverifiedObservations).toBe(1);
    expect(report.attentionComplete).toBe(true);
    expect(report.treatments["cli-playbook"]!.meanQuality).toBe(1);
    expect(report.cliToManual.humanAttention).toBe(0.5);
  });

  test("does not call an empty observed subset attention-complete", async () => {
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

    const report = await analyzeOperationalDiagnostic(diagnostic, root, true);

    expect(report.observations).toBe(0);
    expect(report.expectedObservations).toBe(0);
    expect(report.attentionComplete).toBe(false);
  });
});

describe("interruption-free ownership study (PV-20)", () => {
  test("applies the frozen count and guardrail criteria mechanically", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-operator-study-test-"));
    roots.push(root);
    const study: OperatorStudy = {
      schemaVersion: "1.0.0",
      id: "test-study",
      preregisteredAt: "2026-07-23T00:00:00+02:00",
      frozenSeed: "test-seed",
      phase: "pilot",
      repeats: 1,
      harnesses: ["codex", "claude"],
      treatments: ["manual-playbook", "cli-playbook"],
      taskIds: ["complex-a", "complex-b", "complex-c"],
      thresholds: {
        minCliUnattendedCompletions: 5,
        minCliQualityQualifiedUnattendedCompletions: 4,
        maxCliQualityDeficit: 0,
        maxCliInterventions: 1,
        maxCliOperationalFailures: 1,
        maxWallTimeRatio: 1.75,
        maxResourceRatio: 1.5,
      },
      budget: { costUsd: 50, tokens: 30_000_000 },
    };
    expect((await analyzeOperatorStudy(study, root)).decision).toBe(
      "incomplete",
    );
    let ordinal = 0;
    let cliCell = 0;
    for (const taskId of study.taskIds) {
      for (const harness of study.harnesses) {
        for (const treatment of study.treatments) {
          ordinal += 1;
          const cli = treatment === "cli-playbook";
          if (cli) cliCell += 1;
          const quality = cli ? (cliCell <= 4 ? 1 : 0) : cliCell < 4 ? 1 : 0;
          const unattended = cli && cliCell <= 5;
          const runId = `study-${ordinal}`;
          const runRoot = join(root, "runs", runId);
          await mkdir(runRoot, { recursive: true });
          await writeFile(
            join(runRoot, "observation.json"),
            JSON.stringify({
              runId,
              assignment: {
                ordinal,
                taskId,
                repository: "repo",
                phase: "pilot",
                stratum: "orchestrated",
                harness,
                treatment,
                repeat: 1,
                order: cli ? 2 : 1,
              },
              status: cli && cliCell === 6 ? "failed" : "completed",
              operationalFailure:
                cli && cliCell === 6 ? "harness_or_runtime_failure" : null,
              deterministicQuality: quality,
              quality,
              wallTimeMs: cli ? 1_200 : 1_000,
              inputTokens: cli ? 110 : 90,
              outputTokens: 10,
              costUsd: cli ? 0.12 : 0.1,
              humanAttentionMinutes: cli ? 1 : 2,
              interventions: cli && cliCell === 5 ? 1 : 0,
              operationalMetrics: {
                operatorLaunchesRequired: cli ? 1 : 2,
                operatorHandoffsRequired: cli ? 0 : 1,
                operatorReturnsRequired: cli ? 0 : 1,
                expectedStages: 2,
                executedStages: 2,
                finishedStages: unattended || !cli ? 2 : 1,
                unattendedCompletion: unattended,
              },
            } as Observation),
          );
        }
      }
    }

    const report = await analyzeOperatorStudy(study, root);
    expect(report.decision).toBe("supports-narrowed-hypothesis");
    expect(report.criteria).toEqual(
      expect.objectContaining({
        completeTimedPairs: true,
        noRequiredMidRunReturn: true,
        unattendedCompletions: true,
        qualityQualifiedUnattendedCompletions: true,
        qualityGuardrail: true,
        interventionGuardrail: true,
        operationalFailureGuardrail: true,
        wallTimeGuardrail: true,
        resourceGuardrail: true,
      }),
    );
    expect(
      report.treatments["cli-playbook"]!.qualityQualifiedUnattendedCompletions,
    ).toBe(4);

    const stricter = {
      ...study,
      thresholds: {
        ...study.thresholds,
        minCliQualityQualifiedUnattendedCompletions: 5,
      },
    };
    expect((await analyzeOperatorStudy(stricter, root)).decision).toBe(
      "does-not-support",
    );
  });
});
