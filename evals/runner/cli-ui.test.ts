import { describe, expect, test } from "bun:test";
import {
  artifactLine,
  EvalCliUi,
  progressFrame,
  resolvePresentation,
  summaryLines,
  trialLines,
  type CaseSummary,
} from "./cli-ui";

const ESC = "\u001B[";

describe("eval CLI presentation", () => {
  test("enables rich interactive output and honors independent opt-outs", () => {
    expect(resolvePresentation({ isTTY: true, env: {} })).toEqual({
      color: true,
      emoji: true,
      progress: true,
      hyperlinks: true,
    });
    expect(
      resolvePresentation({
        isTTY: true,
        env: { NO_COLOR: "1" },
      }),
    ).toEqual({
      color: false,
      emoji: true,
      progress: true,
      hyperlinks: true,
    });
    expect(
      resolvePresentation({
        isTTY: true,
        env: {},
        noEmoji: true,
        noProgress: true,
      }),
    ).toEqual({
      color: true,
      emoji: false,
      progress: false,
      hyperlinks: true,
    });
    expect(resolvePresentation({ isTTY: false, env: {} })).toEqual({
      color: false,
      emoji: false,
      progress: false,
      hyperlinks: false,
    });
  });

  test("renders a bounded progress bar for the active trial", () => {
    const frame = progressFrame(
      {
        completed: 2,
        total: 8,
        caseId: "asks-before-changing-public-api",
        trial: 1,
        trials: 3,
        elapsedMs: 12_400,
        spinnerIndex: 2,
      },
      100,
      { color: false, emoji: false, progress: true, hyperlinks: false },
    );

    expect(frame).toContain("2/8");
    expect(frame).toContain("25%");
    expect(frame).toContain("███");
    expect(frame).toContain("░");
    expect(frame).toContain("trial 1/3");
    expect(frame.length).toBeLessThanOrEqual(100);
  });

  test("updates one live terminal line and clears it at completion", () => {
    const chunks: string[] = [];
    const stream = {
      columns: 100,
      write(chunk: string) {
        chunks.push(chunk);
      },
    };
    const ui = new EvalCliUi(
      { color: true, emoji: true, progress: true, hyperlinks: true },
      1,
      stream,
    );

    ui.startTrial("live-progress", 1, 1);
    ui.finishTrial({
      passed: true,
      caseId: "live-progress",
      trial: 1,
      trials: 1,
      durationMs: 100,
      tokens: 10,
      failedChecks: [],
    });

    expect(chunks.join("")).toContain("\r\u001B[2K");
    expect(chunks.join("")).toContain("Evaluating");
    expect(chunks.join("")).toContain("1/1");
  });

  test("separates case blocks while keeping repeated trials compact", () => {
    const chunks: string[] = [];
    const stream = {
      write(chunk: string) {
        chunks.push(chunk);
      },
    };
    const ui = new EvalCliUi(
      { color: false, emoji: false, progress: false, hyperlinks: false },
      3,
      stream,
    );
    const finish = (caseId: string, trial: number, trials: number) =>
      ui.finishTrial({
        passed: true,
        caseId,
        trial,
        trials,
        durationMs: 100,
        tokens: 10,
        failedChecks: [],
      });

    ui.startTrial("case-a", 1, 2);
    finish("case-a", 1, 2);
    const sameCaseStart = chunks.length;
    ui.startTrial("case-a", 2, 2);
    expect(chunks.slice(sameCaseStart).join("")).toStartWith("RUN 2/3");
    finish("case-a", 2, 2);
    const nextCaseStart = chunks.length;
    ui.startTrial("case-b", 1, 1);
    expect(chunks.slice(nextCaseStart).join("")).toStartWith("\nRUN 3/3");
    ui.stop();
  });

  test("colors task and activation outcomes independently", () => {
    const lines = trialLines(
      {
        passed: true,
        caseId: "activation-regression",
        trial: 2,
        trials: 3,
        completed: 5,
        total: 9,
        durationMs: 5_200,
        tokens: 12_400,
        failedChecks: [],
        activation: {
          passed: false,
          className: "competition",
          targetSkill: "create-plan",
          primarySkill: "create-ticket",
          source: "skill-read",
        },
      },
      { color: true, emoji: true, progress: true, hyperlinks: true },
    ).join("\n");

    expect(lines).toContain(`${ESC}32m`);
    expect(lines).toContain(`${ESC}31m`);
    expect(lines).toContain(`${ESC}2m`);
    expect(lines).not.toContain(`${ESC}90m`);
    expect(lines).toContain("Task passed");
    expect(lines).toContain("Activation failed");
    expect(lines).toContain("✕");
  });

  test("summarizes repeated trials with symbols and a plain-text fallback", () => {
    const cases: CaseSummary[] = [
      {
        caseId: "passing-case",
        invariant: "SE-C16",
        passed: true,
        taskPassed: true,
        passRate: 1,
        trials: 3,
        meanDurationMs: 2_000,
        meanTokens: 1_000,
      },
      {
        caseId: "failing-case",
        invariant: "SE-C16",
        passed: false,
        taskPassed: false,
        passRate: 1 / 3,
        trials: 3,
        meanDurationMs: 3_000,
        meanTokens: null,
      },
    ];

    const rich = summaryLines(
      cases,
      {
        color: true,
        emoji: true,
        progress: true,
        hyperlinks: true,
      },
      80_000,
    ).join("\n");
    expect(rich).toContain("1 passed");
    expect(rich).toContain("1 failed");
    expect(rich).toContain("6 trials");
    expect(rich).toContain("1m 20s");
    expect(rich).not.toContain("████");
    expect(rich).toContain("✓");
    expect(rich).toContain("✕");

    const plain = summaryLines(cases, {
      color: false,
      emoji: false,
      progress: false,
      hyperlinks: false,
    }).join("\n");
    expect(plain).toContain("PASS");
    expect(plain).toContain("FAIL");
    expect(plain).not.toContain("\u001B");
    expect(plain).not.toMatch(/[✓✕]/u);
  });

  test("links the absolute result path only when hyperlinks are enabled", () => {
    const resultPath = "/tmp/darrow results/run.json";
    expect(
      artifactLine(resultPath, {
        color: false,
        emoji: true,
        progress: true,
        hyperlinks: true,
      }),
    ).toContain("\u001B]8;;file:///tmp/darrow%20results/run.json");

    const plain = artifactLine(resultPath, {
      color: false,
      emoji: false,
      progress: false,
      hyperlinks: false,
    });
    expect(plain).toBe(`Results: ${resultPath}`);
  });
});
