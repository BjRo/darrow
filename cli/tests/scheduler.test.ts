import { describe, expect, test } from "bun:test";
import { executeStaticGraph } from "../src/scheduler";

describe("M2 static graph scheduler", () => {
  test("runs ready roots concurrently, joins after both, and records plan order", async () => {
    const steps = [
      { id: "slow", dependsOn: [] },
      { id: "fast", dependsOn: [] },
      { id: "join", dependsOn: ["slow", "fast"] },
    ];
    const started: string[] = [];
    const finished = new Set<string>();
    let releaseRoots!: () => void;
    const rootsStarted = new Promise<void>((resolve) => {
      releaseRoots = resolve;
    });

    const execution = await executeStaticGraph(steps, async (step) => {
      started.push(step.id);
      if (step.id === "join") {
        expect(finished).toEqual(new Set(["slow", "fast"]));
      } else {
        if (started.filter((id) => id !== "join").length === 2) releaseRoots();
        await rootsStarted;
        if (step.id === "slow") await Bun.sleep(20);
        finished.add(step.id);
      }
      return { state: "succeeded", value: `${step.id}-result` };
    });

    expect(started.slice(0, 2)).toEqual(["slow", "fast"]);
    expect(started[2]).toBe("join");
    expect(execution.results).toEqual([
      "slow-result",
      "fast-result",
      "join-result",
    ]);
    expect(execution.steps.map((step) => step.state)).toEqual([
      "succeeded",
      "succeeded",
      "succeeded",
    ]);
  });

  test("blocks failed dependents while an independent path completes", async () => {
    const invoked: string[] = [];
    const execution = await executeStaticGraph(
      [
        { id: "failed-root", dependsOn: [] },
        { id: "blocked-child", dependsOn: ["failed-root"] },
        { id: "independent", dependsOn: [] },
      ],
      async (step) => {
        invoked.push(step.id);
        if (step.id === "failed-root")
          return { state: "failed", value: "failed-result" };
        return { state: "succeeded", value: `${step.id}-result` };
      },
    );

    expect(invoked).toEqual(["failed-root", "independent"]);
    expect(execution.results).toEqual(["failed-result", "independent-result"]);
    expect(execution.steps).toEqual([
      { stepId: "failed-root", state: "failed", attempt: 1 },
      { stepId: "blocked-child", state: "blocked", attempt: 0 },
      { stepId: "independent", state: "succeeded", attempt: 1 },
    ]);
  });

  test("a stop outcome waits for active paths but schedules no new work", async () => {
    const invoked: string[] = [];
    const execution = await executeStaticGraph(
      [
        { id: "abort", dependsOn: [] },
        { id: "active", dependsOn: [] },
        { id: "not-started", dependsOn: ["active"] },
      ],
      async (step) => {
        invoked.push(step.id);
        return step.id === "abort"
          ? { state: "failed", stop: true }
          : { state: "succeeded" };
      },
    );

    expect(invoked).toEqual(["abort", "active"]);
    expect(execution.steps.map((step) => step.state)).toEqual([
      "failed",
      "succeeded",
      "blocked",
    ]);
  });
});
