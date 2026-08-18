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

function reviewCall(
  axis: "standards" | "spec",
  prompt = `- review_axis: ${axis}\nsensitive task`,
  inputOverrides: Record<string, unknown> = {},
) {
  return {
    type: "assistant",
    message: {
      id: "message_parallel_review",
      content: [
        {
          type: "tool_use",
          name: "Agent",
          id: `toolu_${axis}`,
          input: {
            subagent_type: "darrow-review:review-reader-claude-opus-5-xhigh",
            run_in_background: false,
            prompt,
            ...inputOverrides,
          },
        },
      ],
    },
  };
}

function reviewResult(axis: "standards" | "spec") {
  const agentId = `${axis}one`;
  return {
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: `toolu_${axis}`,
          content: [
            {
              type: "text",
              text: `agentId: ${agentId} (use SendMessage with to: '${agentId}', summary: '<5-10 word recap>' to continue this agent)\n<usage>subagent_tokens: 10</usage>`,
            },
          ],
        },
      ],
    },
  };
}

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
          id: "message_parallel_review",
          content: [
            {
              type: "tool_use",
              name: "Skill",
              input: { skill: "darrow-discovery:plan-implementation" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          id: "message_parallel_review",
          content: [
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

  test("retains route fields for parallel review Agent calls without task text", () => {
    const stream = [
      JSON.stringify({
        type: "assistant",
        message: {
          id: "message_parallel_review",
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_standards",
              input: {
                subagent_type:
                  "darrow-review:review-reader-claude-opus-5-xhigh",
                run_in_background: false,
                prompt: "- review_axis: standards\nsensitive standards task",
              },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          id: "message_parallel_review",
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_spec",
              input: {
                subagent_type:
                  "darrow-review:review-reader-claude-opus-5-xhigh",
                run_in_background: false,
                prompt: "- review_axis: spec\nsensitive spec task",
              },
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
              tool_use_id: "toolu_standards",
              content: [
                { type: "text", text: "private standards result" },
                {
                  type: "text",
                  text: "agentId: standardsone (use SendMessage with to: 'standardsone', summary: '<5-10 word recap>' to continue this agent)\n<usage>subagent_tokens: 10</usage>",
                },
              ],
            },
            {
              type: "tool_result",
              tool_use_id: "toolu_spec",
              content: [
                { type: "text", text: "private spec result" },
                {
                  type: "text",
                  text: "agentId: specone (use SendMessage with to: 'specone', summary: '<5-10 word recap>' to continue this agent)\n<usage>subagent_tokens: 12</usage>",
                },
              ],
            },
          ],
        },
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "private final result",
      }),
    ].join("\n");

    const retained = retainedClaudeEvidence(stream);
    const agentEvent = retained
      .split("\n")
      .find((line) => line.includes('"name":"Agent"'));
    expect(agentEvent).toContain(
      '"subagent_type":"darrow-review:review-reader-claude-opus-5-xhigh"',
    );
    expect(agentEvent).not.toContain('"model"');
    expect(agentEvent).toContain("- review_axis: standards");
    expect(agentEvent).toContain("- review_axis: spec");
    expect(retained).toContain(
      '"type":"darrow.review_agent_launch","tool_use_id":"toolu_standards","agent_id":"standardsone","review_axis":"standards"',
    );
    expect(retained).toContain(
      '"type":"darrow.review_agent_launch","tool_use_id":"toolu_spec","agent_id":"specone","review_axis":"spec"',
    );
    expect(retained.match(/"batch":1/g)).toHaveLength(2);
    expect(retained).not.toContain("sensitive standards task");
    expect(retained).not.toContain("private final result");
  });

  test("does not coalesce a repeated message id after a child result", () => {
    const stream = [
      reviewCall("standards"),
      reviewResult("standards"),
      reviewCall("spec"),
      reviewResult("spec"),
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");

    const retained = retainedClaudeEvidence(stream);
    expect(retained.match(/"batch":1/g)).toHaveLength(1);
    expect(retained.match(/"batch":2/g)).toHaveLength(1);
    expect(
      retained.split("\n").filter((line) => line.includes('"name":"Agent"')),
    ).toHaveLength(2);
  });

  test("retains an exact reader call but rejects a non-leading axis marker", () => {
    const stream = JSON.stringify(
      reviewCall("standards", "review context\n- review_axis: standards"),
    );
    const retained = retainedClaudeEvidence(stream);
    expect(retained).toContain('"name":"Agent"');
    expect(retained).toContain('"prompt_marker":"invalid"');
    expect(retained).not.toContain("- review_axis: standards");
  });

  test("retains an ineligible Agent call as opaque omission evidence", () => {
    const stream = JSON.stringify(
      reviewCall("spec", "unmarked task", {
        subagent_type: "general-purpose",
        run_in_background: true,
        model: "sonnet",
      }),
    );
    const retained = retainedClaudeEvidence(stream);
    expect(retained).toContain('"name":"Agent"');
    expect(retained).toContain('"subagent_type":"general-purpose"');
    expect(retained).toContain('"run_in_background":true');
    expect(retained).toContain('"model":"sonnet"');
    expect(retained).toContain('"prompt_marker":"invalid"');
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
