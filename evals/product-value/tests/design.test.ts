import { describe, expect, test } from "bun:test";
import {
  loadCorpus,
  loadOperationalDiagnostic,
  loadOperatorStudy,
  loadProtocol,
} from "../src/config";
import {
  buildOperationalDiagnosticSchedule,
  buildOperatorStudySchedule,
  buildPolicyDiagnosticSchedule,
  buildSchedule,
} from "../src/schedule";
import { pairedEstimate, poweredTasks } from "../src/stats";

describe("product-value design (PV-7 through PV-11)", () => {
  test("contains a powered, balanced real-task corpus", async () => {
    const protocol = await loadProtocol();
    const corpus = await loadCorpus();
    expect(corpus.tasks).toHaveLength(32);
    expect(corpus.tasks.filter((task) => task.phase === "pilot")).toHaveLength(
      6,
    );
    expect(
      corpus.tasks.filter((task) => task.phase === "confirmatory"),
    ).toHaveLength(26);
    for (const repository of ["mynab", "credfolio2"])
      for (const stratum of ["simple", "orchestrated"])
        expect(
          corpus.tasks.filter(
            (task) =>
              task.repository === repository && task.stratum === stratum,
          ),
        ).toHaveLength(8);
    expect(
      corpus.tasks
        .filter((task) => task.oracleTestAdjustments?.length)
        .map((task) => task.id),
    ).toEqual(["credfolio-github-profile"]);
    expect(
      poweredTasks(
        protocol.design.alpha,
        protocol.design.power,
        protocol.design.pairedTaskSd,
        protocol.design.usefulQualityGain,
      ),
    ).toBe(26);
  });

  test("builds deterministic complete paired schedules", async () => {
    const protocol = await loadProtocol();
    const corpus = await loadCorpus();
    const first = buildSchedule(protocol, corpus, "confirmatory");
    const second = buildSchedule(protocol, corpus, "confirmatory");
    expect(first).toEqual(second);
    expect(first).toHaveLength(312);
    expect(buildSchedule(protocol, corpus, "pilot")).toHaveLength(36);
    const smoke = buildSchedule(protocol, corpus, "smoke");
    expect(smoke).toHaveLength(6);
    expect(new Set(smoke.map((assignment) => assignment.taskId))).toEqual(
      new Set([protocol.phases.smoke.taskId!]),
    );
    expect(smoke.every((assignment) => assignment.repeat === 1)).toBe(true);
    expect(new Set(smoke.map((assignment) => assignment.harness))).toEqual(
      new Set(["codex", "claude"]),
    );
    expect(new Set(smoke.map((assignment) => assignment.treatment))).toEqual(
      new Set(["native", "plugins", "cli"]),
    );
    const cells = new Map<string, Set<string>>();
    for (const assignment of first) {
      const key = `${assignment.taskId}:${assignment.harness}:${assignment.repeat}`;
      const treatments = cells.get(key) ?? new Set();
      treatments.add(assignment.treatment);
      cells.set(key, treatments);
    }
    expect([...cells.values()].every((values) => values.size === 3)).toBe(true);
    for (let index = 0; index < first.length; index += 3) {
      const block = first.slice(index, index + 3);
      expect(
        new Set(
          block.map(
            (assignment) =>
              `${assignment.taskId}:${assignment.harness}:${assignment.repeat}`,
          ),
        ).size,
      ).toBe(1);
      expect(block.map((assignment) => assignment.order)).toEqual([1, 2, 3]);
    }
  });

  test("keeps the no-TDD diagnostic outside the core schedule", async () => {
    const protocol = await loadProtocol();
    const corpus = await loadCorpus();
    const diagnostic = buildPolicyDiagnosticSchedule(protocol, corpus);
    expect(diagnostic).toHaveLength(4);
    expect(new Set(diagnostic.map((item) => item.treatment))).toEqual(
      new Set(["native", "native-no-tdd", "plugins", "plugins-no-tdd"]),
    );
    expect(diagnostic.every((item) => item.harness === "codex")).toBe(true);
    expect(diagnostic.every((item) => item.phase === "smoke")).toBe(true);
    expect(
      buildSchedule(protocol, corpus, "smoke").some((item) =>
        item.treatment.endsWith("-no-tdd"),
      ),
    ).toBe(false);
  });

  test("builds an excluded paired playbook-autonomy diagnostic", async () => {
    const protocol = await loadProtocol();
    const corpus = await loadCorpus();
    const diagnostic = await loadOperationalDiagnostic();
    const schedule = buildOperationalDiagnosticSchedule(
      protocol,
      corpus,
      diagnostic,
    );
    expect(schedule).toHaveLength(12);
    expect(new Set(schedule.map((item) => item.treatment))).toEqual(
      new Set(["manual-playbook", "cli-playbook"]),
    );
    expect(new Set(schedule.map((item) => item.taskId))).toEqual(
      new Set(diagnostic.taskIds),
    );
    expect(
      new Set(
        schedule
          .filter((item) => item.stratum === "simple")
          .map((item) => item.taskId),
      ).size,
    ).toBe(1);
    expect(
      new Set(
        schedule
          .filter((item) => item.stratum === "orchestrated")
          .map((item) => item.taskId),
      ).size,
    ).toBe(2);
    for (let index = 0; index < schedule.length; index += 2) {
      const block = schedule.slice(index, index + 2);
      expect(
        new Set(
          block.map((item) => `${item.taskId}:${item.harness}:${item.repeat}`),
        ).size,
      ).toBe(1);
      expect(block.map((item) => item.order)).toEqual([1, 2]);
    }
    expect(
      buildSchedule(protocol, corpus, "pilot").some((item) =>
        item.treatment.endsWith("-playbook"),
      ),
    ).toBe(false);
  });

  test("freezes a paired operator study on orchestrated pilot tasks", async () => {
    const corpus = await loadCorpus();
    const study = await loadOperatorStudy();
    const first = buildOperatorStudySchedule(corpus, study);
    const second = buildOperatorStudySchedule(corpus, study);
    expect(first).toEqual(second);
    expect(first).toHaveLength(12);
    expect(study.taskIds).toEqual([
      "mynab-import-commit-backend",
      "credfolio-github-profile",
      "credfolio-finding-index",
    ]);
    expect(
      first.every((assignment) => assignment.stratum === "orchestrated"),
    ).toBe(true);
    expect(new Set(first.map((assignment) => assignment.harness))).toEqual(
      new Set(["codex", "claude"]),
    );
    for (let index = 0; index < first.length; index += 2) {
      const block = first.slice(index, index + 2);
      expect(
        new Set(
          block.map(
            (assignment) => `${assignment.taskId}:${assignment.harness}`,
          ),
        ).size,
      ).toBe(1);
      expect(new Set(block.map((assignment) => assignment.treatment))).toEqual(
        new Set(["manual-playbook", "cli-playbook"]),
      );
      expect(block.map((assignment) => assignment.order)).toEqual([1, 2]);
    }
  });

  test("uses seeded task-level bootstrap and sign flips", () => {
    const estimate = pairedEstimate([0.2, 0.1, 0.3, 0.2], 1000, 1000, 7);
    expect(estimate.estimate).toBeCloseTo(0.2);
    expect(estimate.ciLow).toBeGreaterThanOrEqual(0.1);
    expect(estimate.ciHigh).toBeLessThanOrEqual(0.3);
    expect(estimate.pValue).toBeGreaterThan(0);
  });
});
