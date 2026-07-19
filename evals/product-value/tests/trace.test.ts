import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InvocationResult } from "../src/harness";
import { createExecutionTrace, traceTokenUsage } from "../src/trace";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function invocation(raw: string): InvocationResult {
  return {
    ok: true,
    waiting: false,
    timedOut: false,
    setupDurationMs: 0,
    durationMs: 12_000,
    inputTokens: 100,
    outputTokens: 20,
    costUsd: null,
    raw,
    darrowRunId: null,
    workspace: "/tmp/workspace",
    patchBaseCommit: null,
  };
}

describe("compact execution traces", () => {
  test("leaves TDD phases empty for portable instruction-only treatments", async () => {
    const trace = await createExecutionTrace(
      invocation(
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command: "bun test focused.test.ts",
            exit_code: 0,
            aggregated_output: "passed",
          },
        }),
      ),
      "native",
    );
    expect(trace.schemaVersion).toBe("1.2.0");
    expect(trace.phases).toEqual({});
    expect(trace.timeline).toBeNull();
    expect((trace.model as any).commands.categories.test.total).toBe(1);
  });

  test("summarizes direct model events and matched evidence without content", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-trace-test-"));
    roots.push(root);
    const lines = [
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "/private/evidence.sh run /private/evidence red -- secret command",
          exit_code: 1,
          aggregated_output:
            "red output did not contain expected behavioral failure",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "ln -s /private/dependencies node_modules",
          exit_code: 0,
        },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: {
          input_tokens: 100,
          cached_input_tokens: 80,
          output_tokens: 20,
        },
      }),
    ].join("\n");
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, "red.meta"),
      "exit_status=1\nstarted_at=2026-01-01T00:00:00Z\nfinished_at=2026-01-01T00:00:01Z\n",
    );
    const trace = await createExecutionTrace(
      invocation(lines),
      "native-matched-policy",
      root,
    );
    expect(trace.modelInvocationDurationMs).toBe(12_000);
    expect((trace.model as any).itemTypes.command_execution).toBe(2);
    expect((trace.model as any).commands).toEqual({
      total: 2,
      nonZero: 1,
      categories: {
        evidence: { total: 1, nonZero: 1 },
        test: { total: 0, nonZero: 0 },
        dependency_setup: { total: 1, nonZero: 0 },
        git: { total: 0, nonZero: 0 },
        inspection: { total: 0, nonZero: 0 },
        other: { total: 0, nonZero: 0 },
      },
      evidenceOperations: {
        red: { total: 1, nonZero: 1 },
        green: { total: 0, nonZero: 0 },
        regression: { total: 0, nonZero: 0 },
        validate: { total: 0, nonZero: 0 },
      },
      nonZeroReasons: {
        evidence_expected_mismatch: 1,
        evidence_usage: 0,
        missing_dependency: 0,
        test_failure: 0,
        other: 0,
      },
    });
    expect((trace.phases as any).red.durationMs).toBe(1_000);
    expect(traceTokenUsage(trace)).toEqual({
      inputTokens: 100,
      outputTokens: 20,
    });
    expect(JSON.stringify(trace)).not.toContain("secret command");
  });

  test("reads a Darrow transcript before its disposable workspace is removed", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-trace-test-"));
    roots.push(root);
    const transcript = join(root, "transcript.jsonl");
    await writeFile(
      transcript,
      JSON.stringify({
        type: "item.completed",
        item: { type: "file_change", changes: ["sensitive.ts"] },
      }) + "\n",
    );
    const raw = JSON.stringify({
      ok: true,
      data: {
        results: [
          {
            transcript,
            timing: {
              startedAt: "2026-01-01T00:00:00Z",
              finishedAt: "2026-01-01T00:00:10Z",
            },
            payload: {
              evidence: {
                red: {
                  exitStatus: 1,
                  startedAt: "2026-01-01T00:00:01Z",
                  finishedAt: "2026-01-01T00:00:02Z",
                },
                green: {
                  exitStatus: 0,
                  startedAt: "2026-01-01T00:00:03Z",
                  finishedAt: "2026-01-01T00:00:04Z",
                },
                regression: {
                  exitStatus: 0,
                  startedAt: "2026-01-01T00:00:05Z",
                  finishedAt: "2026-01-01T00:00:06Z",
                },
              },
            },
          },
        ],
      },
    });
    const trace = await createExecutionTrace(invocation(raw), "cli");
    expect(trace.modelInvocationDurationMs).toBe(10_000);
    expect(trace.runtimeWrapperDurationMs).toBe(2_000);
    expect(trace.timeline).toEqual({
      beforeRedMs: 1_000,
      redExecutionMs: 1_000,
      redToGreenMs: 1_000,
      greenExecutionMs: 1_000,
      greenToRegressionMs: 1_000,
      regressionExecutionMs: 1_000,
      afterRegressionMs: 4_000,
    });
    expect(trace.transcriptAvailableForSummary).toBe(true);
    expect((trace.model as any).itemTypes.file_change).toBe(1);
    expect(JSON.stringify(trace)).not.toContain("sensitive.ts");
  });

  test("recovers partial CLI evidence timing after an evidence failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-trace-test-"));
    roots.push(root);
    const evidence = join(
      root,
      ".darrow-attempts",
      "run-1",
      "attempt-implement-1",
    );
    await mkdir(evidence, { recursive: true });
    await writeFile(
      join(evidence, "red.meta"),
      "exit_status=1\nstarted_at=2026-01-01T00:00:02Z\nfinished_at=2026-01-01T00:00:03Z\n",
    );
    const raw = JSON.stringify({
      ok: false,
      data: {
        results: [
          {
            timing: {
              startedAt: "2026-01-01T00:00:00Z",
              finishedAt: "2026-01-01T00:00:10Z",
            },
          },
        ],
      },
    });
    const failed = invocation(raw);
    failed.ok = false;
    failed.workspace = root;
    failed.darrowRunId = "run-1";

    const trace = await createExecutionTrace(failed, "cli");
    expect((trace.phases as any).red.exitStatus).toBe(1);
    expect(trace.timeline).toEqual({
      beforeRedMs: 2_000,
      redExecutionMs: 1_000,
      afterRedWithoutGreenMs: 7_000,
    });
  });
});
