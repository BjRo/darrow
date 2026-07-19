import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InvocationResult } from "../src/harness";
import {
  createExecutionTrace,
  traceCostUsd,
  traceTokenUsage,
} from "../src/trace";

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
    expect(trace.schemaVersion).toBe("1.3.0");
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
      "native-no-tdd",
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

  test("summarizes Claude tool use and Bash outcomes without content", async () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Bash",
              input: { command: "bun test focused.test.ts" },
            },
            {
              type: "tool_use",
              id: "tool-2",
              name: "Read",
              input: { file_path: "/private/secret.ts" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              is_error: true,
              content: "Failed Tests: private assertion text",
            },
          ],
        },
      }),
    ].join("\n");

    const trace = await createExecutionTrace(invocation(lines), "native");
    expect((trace.model as any).toolTypes).toEqual({ Bash: 1, Read: 1 });
    expect((trace.model as any).commands.total).toBe(1);
    expect((trace.model as any).commands.nonZero).toBe(1);
    expect((trace.model as any).commands.categories.test).toEqual({
      total: 1,
      nonZero: 1,
    });
    expect((trace.model as any).commands.nonZeroReasons.test_failure).toBe(1);
    expect(JSON.stringify(trace)).not.toContain("private assertion text");
    expect(JSON.stringify(trace)).not.toContain("secret.ts");
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

  test("aggregates every command invocation in a multi-step CLI run", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-trace-test-"));
    roots.push(root);
    const implementTranscript = join(root, "implement.jsonl");
    const verifyTranscript = join(root, "verify.jsonl");
    await writeFile(
      implementTranscript,
      [
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command: "git diff --check",
            exit_code: 0,
          },
        }),
        JSON.stringify({
          type: "turn.completed",
          usage: { input_tokens: 100, output_tokens: 10 },
          total_cost_usd: 0.1,
        }),
      ].join("\n"),
    );
    await writeFile(
      verifyTranscript,
      [
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command: "bun test",
            exit_code: 0,
          },
        }),
        JSON.stringify({
          type: "turn.completed",
          usage: { input_tokens: 200, output_tokens: 20 },
          total_cost_usd: 0.2,
        }),
      ].join("\n"),
    );
    const raw = JSON.stringify({
      ok: true,
      data: {
        results: [
          {
            invocationId: "invocation-implement",
            commandId: "darrow-delivery:implement",
            transcript: implementTranscript,
            timing: {
              startedAt: "2026-01-01T00:00:00Z",
              finishedAt: "2026-01-01T00:00:10Z",
            },
          },
          {
            invocationId: "invocation-verify",
            commandId: "darrow-delivery:verify-and-repair",
            transcript: verifyTranscript,
            timing: {
              startedAt: "2026-01-01T00:00:10Z",
              finishedAt: "2026-01-01T00:00:18Z",
            },
          },
        ],
      },
    });
    const trace = await createExecutionTrace(
      { ...invocation(raw), durationMs: 20_000 },
      "cli",
    );
    expect(trace.modelInvocationCount).toBe(2);
    expect(trace.modelInvocations).toEqual([
      {
        invocationId: "invocation-implement",
        commandId: "darrow-delivery:implement",
        durationMs: 10_000,
        transcriptAvailable: true,
      },
      {
        invocationId: "invocation-verify",
        commandId: "darrow-delivery:verify-and-repair",
        durationMs: 8_000,
        transcriptAvailable: true,
      },
    ]);
    expect(trace.modelInvocationDurationMs).toBe(18_000);
    expect(trace.runtimeWrapperDurationMs).toBe(2_000);
    expect((trace.model as any).commands.total).toBe(2);
    expect((trace.model as any).commands.categories.git.total).toBe(1);
    expect((trace.model as any).commands.categories.test.total).toBe(1);
    expect(traceTokenUsage(trace)).toEqual({
      inputTokens: 300,
      outputTokens: 30,
    });
    expect(traceCostUsd(trace)).toBeCloseTo(0.3);
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

  test("recovers usage and cost from a failed CLI transcript", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-trace-test-"));
    roots.push(root);
    const content = join(root, ".darrow", "runs", "run-1", "content");
    await mkdir(content, { recursive: true });
    await writeFile(
      join(content, "invocation-1.jsonl"),
      JSON.stringify({
        type: "result",
        subtype: "success",
        usage: { input_tokens: 30, output_tokens: 7 },
        total_cost_usd: 0.42,
      }) + "\n",
    );
    const raw = JSON.stringify({
      ok: false,
      data: {
        results: [
          {
            invocationId: "invocation-1",
            status: "failed",
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
    expect(trace.transcriptAvailableForSummary).toBe(true);
    expect(traceTokenUsage(trace)).toEqual({
      inputTokens: 30,
      outputTokens: 7,
    });
    expect(traceCostUsd(trace)).toBe(0.42);
  });
});
