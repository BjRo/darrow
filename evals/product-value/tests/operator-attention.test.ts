import { describe, expect, test } from "bun:test";
import { createOperatorAttentionSession } from "../src/operator-attention";

describe("operator attention timing", () => {
  test("counts only the interval between begin and complete confirmations", async () => {
    const times = [5_000, 11_000, 20_000, 23_000];
    const answers = ["ready", "done", "ready", "done"];
    const prompts: string[] = [];
    const output: string[] = [];
    const session = createOperatorAttentionSession(
      async (prompt) => {
        prompts.push(prompt);
        return answers.shift()!;
      },
      (value) => output.push(value),
      () => times.shift()!,
    );

    await session.measure("launch", "Review and launch the workflow.");
    await session.measure("inspection", "Inspect the final result.");

    expect(session.intervals()).toEqual([
      { label: "launch", durationMs: 6_000 },
      { label: "inspection", durationMs: 3_000 },
    ]);
    expect(session.totalMinutes()).toBe(0.15);
    expect(prompts).toHaveLength(4);
    expect(output).toEqual([
      "\n[WAITING — timer off]\nlaunch is ready. Return to this terminal when convenient.\n",
      "\n[ACTIVE — timer running]\nReview and launch the workflow.\n",
      "\n[WAITING — timer off]\nRecorded 6.0s of active attention. Continuing in the background.\n",
      "\n[WAITING — timer off]\ninspection is ready. Return to this terminal when convenient.\n",
      "\n[ACTIVE — timer running]\nInspect the final result.\n",
      "\n[WAITING — timer off]\nRecorded 3.0s of active attention. Continuing in the background.\n",
    ]);
  });

  test("rejects blank and unexpected commands with visible timing state", async () => {
    const answers = ["", "go", "ready", "", "stop", "done"];
    const output: string[] = [];
    const session = createOperatorAttentionSession(
      async () => answers.shift()!,
      (value) => output.push(value),
      (() => {
        const times = [1_000, 2_000];
        return () => times.shift()!;
      })(),
    );

    await session.measure("launch", "Launch it.");

    expect(session.totalMinutes()).toBe(1 / 60);
    expect(output).toContain(
      '\nNo action taken. Expected "ready"; the timer has not started.\n',
    );
    expect(output).toContain(
      '\nNo action taken. Expected "done"; the timer is still running.\n',
    );
  });

  test("does not expose mutable interval state", async () => {
    const times = [0, 1_000];
    const answers = ["ready", "done"];
    const session = createOperatorAttentionSession(
      async () => answers.shift()!,
      () => {},
      () => times.shift()!,
    );
    await session.measure("launch", "Launch.");

    const copy = session.intervals();
    copy[0]!.durationMs = 0;

    expect(session.intervals()[0]!.durationMs).toBe(1_000);
  });
});
