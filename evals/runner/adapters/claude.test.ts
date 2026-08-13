import { describe, expect, test } from "bun:test";
import {
  claudeAdapter,
  claudeArgv,
  claudeInputTokens,
  claudeResultAccounting,
  claudeRunSucceeded,
  claudeSkillActivation,
  retainedClaudeEvidence,
} from "./claude";

test("uses Sonnet 5 as the default Claude eval model", () => {
  expect(claudeAdapter.defaultModel).toBe("claude-sonnet-5");
});

test("loads the eval-only source plugin when one is mounted", () => {
  const argv = claudeArgv(
    "Run the case.",
    "claude-sonnet-5",
    "medium",
    "/tmp/eval-plugin",
  );
  expect(argv).toContain("--plugin-dir");
  expect(argv[argv.indexOf("--plugin-dir") + 1]).toBe("/tmp/eval-plugin");
  expect(
    argv.slice(
      argv.indexOf("--output-format"),
      argv.indexOf("--output-format") + 2,
    ),
  ).toEqual(["--output-format", "stream-json"]);
  expect(argv).toContain("--verbose");
});

describe("Claude token accounting", () => {
  test("includes uncached, cache-creation, and cache-read input", () => {
    expect(
      claudeInputTokens({
        input_tokens: 7,
        cache_creation_input_tokens: 11_933,
        cache_read_input_tokens: 99_129,
      }),
    ).toBe(111_069);
  });

  test("treats omitted usage buckets as zero", () => {
    expect(claudeInputTokens({ input_tokens: 12 })).toBe(12);
    expect(claudeInputTokens(undefined)).toBe(0);
  });

  test("sums every successful result envelope while keeping the final answer", () => {
    const stream = [
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        usage: {
          input_tokens: 2,
          cache_creation_input_tokens: 3,
          cache_read_input_tokens: 5,
          output_tokens: 7,
        },
        total_cost_usd: 0.1,
        result: "Interim public result",
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        usage: {
          input_tokens: 11,
          cache_creation_input_tokens: 13,
          cache_read_input_tokens: 17,
          output_tokens: 19,
        },
        total_cost_usd: 0.2,
        result: "Final public result",
      }),
    ].join("\n");

    const result = claudeResultAccounting(stream, 0);
    expect(result).toEqual({
      ok: true,
      tokenUsageComplete: true,
      inputTokens: 51,
      outputTokens: 26,
      costUsd: expect.any(Number),
      resultText: "Final public result",
    });
    expect(result.costUsd).toBeCloseTo(0.3);
  });

  test("accounts for failed result work and makes incomplete cost unknown", () => {
    const stream = [
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        usage: { input_tokens: 2, output_tokens: 3 },
        total_cost_usd: 0.1,
        result: "Interim result",
      }),
      JSON.stringify({
        type: "result",
        subtype: "error",
        is_error: true,
        usage: { input_tokens: 5, output_tokens: 7 },
        result: "Failed final result",
      }),
    ].join("\n");

    expect(claudeResultAccounting(stream, 1)).toEqual({
      ok: false,
      tokenUsageComplete: true,
      inputTokens: 7,
      outputTokens: 10,
      costUsd: null,
      resultText: "Failed final result",
    });
    expect(claudeResultAccounting(`${stream}\nnot-json`, 1).costUsd).toBeNull();
  });

  test("marks missing or invalid result usage unknown without losing the answer", () => {
    for (const usage of [
      undefined,
      { input_tokens: "wrong", output_tokens: 2 },
    ]) {
      const stream = JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        usage,
        total_cost_usd: 0.1,
        result: "Public result",
      });
      expect(claudeResultAccounting(stream, 0)).toEqual({
        ok: true,
        tokenUsageComplete: false,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0.1,
        resultText: "Public result",
      });
    }
  });
});

describe("Claude terminal result state", () => {
  test("accepts a successful non-error result", () => {
    expect(claudeRunSucceeded(0, { subtype: "success", is_error: false })).toBe(
      true,
    );
  });

  test("rejects API errors even when Claude labels the subtype success", () => {
    expect(claudeRunSucceeded(0, { subtype: "success", is_error: true })).toBe(
      false,
    );
    expect(claudeRunSucceeded(1, { subtype: "success", is_error: false })).toBe(
      false,
    );
  });
});

describe("Claude skill activation observation", () => {
  test("normalizes direct Skill tool events from a completed stream", () => {
    const events = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Skill",
              input: { skill: "darrow-discovery:plan-implementation" },
            },
            {
              type: "tool_use",
              name: "Skill",
              input: {
                skill: "grilling",
                args: "sensitive user-supplied subject",
              },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "Done",
      }),
    ].join("\n");

    expect(claudeSkillActivation(events)).toEqual({
      source: "harness_event",
      complete: true,
      primarySkill: "plan-implementation",
      observedSkills: ["plan-implementation", "grilling"],
    });
    expect(claudeSkillActivation("").complete).toBe(false);
  });

  test("retains reduced Skill events and terminal accounting without message text", () => {
    const stream = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "private progress detail" },
            {
              type: "tool_use",
              name: "Skill",
              input: {
                skill: "grilling",
                args: "sensitive user-supplied subject",
              },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        result: "Public final answer",
      }),
    ].join("\n");
    const retained = retainedClaudeEvidence(stream);
    expect(retained).toContain('"name":"Skill"');
    expect(retained).not.toContain("Public final answer");
    expect(retained).not.toContain("private progress detail");
    expect(retained).not.toContain("sensitive user-supplied subject");
  });

  test("treats JSON primitives as malformed and retains no stderr or result text", () => {
    const stream = [
      "null",
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "sensitive interim result",
      }),
    ].join("\n");
    expect(claudeResultAccounting(stream, 0)).toEqual({
      ok: false,
      tokenUsageComplete: false,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      resultText: "sensitive interim result",
    });
    const retained = retainedClaudeEvidence(stream, {
      exitCode: 1,
      stderrPresent: true,
    });
    expect(retained).toContain('"type":"malformed_stream"');
    expect(retained).toContain('"stderr_present":true');
    expect(retained).not.toContain("sensitive interim result");
  });

  test("marks malformed nested assistant content incomplete without throwing", () => {
    for (const content of [
      [null],
      [{ type: "tool_use", name: "Skill", input: { skill: 42 } }],
    ]) {
      const stream = [
        JSON.stringify({ type: "assistant", message: { content } }),
        JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
          usage: { input_tokens: 1, output_tokens: 1 },
          total_cost_usd: 0.1,
          result: "Public result",
        }),
      ].join("\n");
      expect(claudeSkillActivation(stream).complete).toBe(false);
      expect(retainedClaudeEvidence(stream)).toContain(
        '"type":"malformed_stream"',
      );
    }
  });

  test("marks malformed terminal result fields incomplete", () => {
    const stream = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Skill",
              input: { skill: "grilling" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: "yes",
        usage: { input_tokens: 1, output_tokens: 1 },
        total_cost_usd: 0.1,
        result: "Public result",
      }),
    ].join("\n");

    expect(claudeResultAccounting(stream, 0).ok).toBe(false);
    expect(claudeSkillActivation(stream).complete).toBe(false);
    expect(retainedClaudeEvidence(stream)).toContain(
      '"type":"malformed_stream"',
    );
  });
});
