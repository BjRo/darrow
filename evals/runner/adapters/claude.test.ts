import { describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claudeAdapter,
  claudeArgv,
  claudeGoalRouteEvidence,
  claudeGoalRouteEvidenceSummary,
  claudeGoalRouteReportMatches,
  hasClaudeGoalAgentEvidence,
  claudeParentLifecycleOperations,
  claudeInputTokens,
  claudeResultAccounting,
  claudeRunSucceeded,
  claudeSkillActivation,
  retainedClaudeEvidence,
} from "./claude";

const routeEvidenceContext = {
  repoDir: "/fixture",
  pluginDir: "/plugin/darrow-goal-loop",
  stagingRoot: "/tmp",
  observedRouteTrusted: true,
};
const objectiveContract = "private objective";
const objectiveDigest = new Bun.CryptoHasher("sha256")
  .update(objectiveContract)
  .digest("hex");
const fileBackedContract = "private file-backed objective";
const fileBackedDigest = new Bun.CryptoHasher("sha256")
  .update(fileBackedContract)
  .digest("hex");

function validClaudePreflightEvents(context = routeEvidenceContext) {
  const exchange = (id: string, command: string, content: string) => [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "Bash", id, input: { command } }],
      },
    }),
    JSON.stringify({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: id, content }] },
    }),
  ];
  return [
    ...exchange(
      "toolu_prepare",
      `/bin/bash ${context.pluginDir}/bin/goal-loop prepare --repo ${context.repoDir} --host claude`,
      [
        "format\tdarrow-native-goal-prepared-v1",
        `repo\t${context.repoDir}`,
        "base_revision\tfixture",
        "working_tree\tclean",
        "route\troutine\tclaude\tanthropic\tclaude-sonnet-5\tlow",
        "route_policy_source\troutine\tbundled",
        `workflow\tchange-feature\t${context.pluginDir}/skills/adaptive-goal/references/workflows/change-feature.md`,
      ].join("\n"),
    ),
    ...exchange(
      "toolu_route",
      `/bin/bash ${context.pluginDir}/bin/goal-loop route --repo ${context.repoDir} --host claude --profile routine`,
      [
        "format\tdarrow-native-goal-route-v2",
        "profile\troutine",
        "selected_route\tclaude\tanthropic\tclaude-sonnet-5\tlow",
        "route_source\tpolicy",
        "policy_route_source\tbundled",
        "fallback\tnone\tnone",
      ].join("\n"),
    ),
    ...exchange(
      "toolu_agent_route",
      `/bin/bash ${context.pluginDir}/bin/claude-agent-route --provider anthropic --model claude-sonnet-5 --effort low`,
      [
        "format\tdarrow-claude-agent-route-v1",
        "selected_route\tclaude\tanthropic\tclaude-sonnet-5\tlow",
        "subagent_type\tdarrow-goal-loop:adaptive-goal-sonnet-5-low",
        `agent_file\t${context.pluginDir}/agents/adaptive-goal-sonnet-5-low.md`,
      ].join("\n"),
    ),
  ];
}

function boundGoalPrompt(
  objectiveFile = "/tmp/goal.md",
  mode: "inline" | "file-backed" = "inline",
) {
  const body =
    mode === "inline"
      ? objectiveContract
      : `- objective_file: ${objectiveFile}`;
  return ["- phase: adaptive-goal-runner", body].join("\n");
}

function inlineMaterializationEvents() {
  return [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_tmpdir",
            input: { command: "/usr/bin/printenv TMPDIR" },
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
            tool_use_id: "toolu_tmpdir",
            content: "/tmp",
          },
        ],
      },
    }),
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Write",
            id: "toolu_stage",
            input: { file_path: "/tmp/goal.md", content: objectiveContract },
          },
        ],
      },
    }),
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_materialize",
            input: {
              command:
                "/bin/bash /plugin/darrow-goal-loop/bin/goal-loop materialize-objective --force-file-backed --repo /fixture --goal-file /tmp/goal.md",
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
            tool_use_id: "toolu_materialize",
            content: `format\tdarrow-native-goal-objective-v1\nmode\tinline\ncontract_bytes\t100\ncontract_sha256\t${objectiveDigest}\ncontract_file\t/tmp/goal.md\nobjective_bytes\t100\nobjective_file\t/tmp/goal.md\nattachment_dir\tnone`,
          },
        ],
      },
    }),
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_release_staging",
            input: {
              command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop release-staging --goal-file /tmp/goal.md --expected-sha256 ${objectiveDigest}`,
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
            tool_use_id: "toolu_release_staging",
            content:
              "format\tdarrow-native-goal-staging-release-v1\nstatus\treleased\ngoal_file\t/tmp/goal.md",
          },
        ],
      },
    }),
  ];
}

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

function goalResult(toolUseId: string, agentId: string) {
  return {
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: [
            { type: "text", text: "private child result" },
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

  test("retains a marked foreground adaptive-goal runner and its completion", () => {
    const stream = [
      ...validClaudePreflightEvents(),
      ...inlineMaterializationEvents(),
      JSON.stringify({
        type: "assistant",
        message: {
          id: "message_goal",
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_goal",
              input: {
                subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
                run_in_background: false,
                prompt: boundGoalPrompt(),
              },
            },
          ],
        },
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal")),
      JSON.stringify({ type: "result", subtype: "success", is_error: false }),
    ].join("\n");

    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).toContain(
      '"subagent_type":"darrow-goal-loop:adaptive-goal-sonnet-5-low","run_in_background":false,"prompt":"- phase: adaptive-goal-runner"',
    );
    expect(retained).toContain(
      '"type":"darrow.goal_agent_completion","tool_use_id":"toolu_goal","subagent_type":"darrow-goal-loop:adaptive-goal-sonnet-5-low","status":"completed"',
    );
    expect(retained).toContain('"agent_id":"agentgoal"');
    expect(retained).not.toContain("private objective");
    expect(retained).not.toContain("private child result");
    expect(claudeGoalRouteEvidenceSummary(retained)).toBe(
      "materializations=1; goal_completions=1; route_observations=0; parent_operations=none",
    );
  });

  test("rejects parent inspection in the same turn that starts the goal owner", () => {
    const stream = [
      ...validClaudePreflightEvents(),
      ...inlineMaterializationEvents(),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_goal",
              input: {
                subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
                run_in_background: false,
                prompt: boundGoalPrompt(),
              },
            },
            {
              type: "tool_use",
              name: "Read",
              id: "toolu_parent_read",
              input: { file_path: "/fixture/auth-config.js" },
            },
          ],
        },
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal")),
    ].join("\n");
    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).toContain("darrow.goal_agent_completion");
    expect(retained).toContain(
      '"type":"darrow.parent_repository_tool_before_goal","tool":"Read","operation":"read"',
    );
  });

  test("does not attribute nested goal-owner tools to the parent", () => {
    const childToolEvent = JSON.stringify({
      type: "assistant",
      parent_tool_use_id: "toolu_goal",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Edit",
            id: "toolu_child_edit",
            input: { file_path: "/fixture/auth-config.js" },
          },
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_child_test",
            input: { command: "bash test.sh" },
          },
          {
            type: "tool_use",
            name: "Skill",
            id: "toolu_child_review",
            input: { skill: "independent-code-review" },
          },
        ],
      },
    });
    const stream = [
      ...validClaudePreflightEvents(),
      ...inlineMaterializationEvents(),
      JSON.stringify({
        type: "assistant",
        parent_tool_use_id: null,
        message: {
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_goal",
              input: {
                subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
                run_in_background: false,
                prompt: boundGoalPrompt(),
              },
            },
          ],
        },
      }),
      childToolEvent,
      JSON.stringify({
        ...goalResult("toolu_goal", "agentgoal"),
        parent_tool_use_id: null,
      }),
      childToolEvent,
    ].join("\n");

    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).toContain("darrow.goal_agent_completion");
    expect(retained).toContain('"skill":"independent-code-review"');
    expect(retained).not.toContain("darrow.parent_repository_tool_before_goal");
    expect(retained).not.toContain("darrow.parent_repository_tool_after_goal");
    expect(claudeParentLifecycleOperations(retained)).toEqual([]);
  });

  test("does not accept an unmarked call as an adaptive-goal completion", () => {
    const stream = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_goal",
              input: {
                subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
                run_in_background: false,
                prompt: "private objective",
              },
            },
          ],
        },
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal")),
    ].join("\n");

    const retained = retainedClaudeEvidence(stream);
    expect(retained).toContain('"prompt_marker":"invalid"');
    expect(retained).not.toContain("darrow.goal_agent_completion");
  });

  test("requires completed materialization and its exact objective before Agent start", () => {
    const preflight = validClaudePreflightEvents();
    const materialization = inlineMaterializationEvents();
    const goalCall = (prompt: string) =>
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_goal",
              input: {
                subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
                run_in_background: false,
                prompt,
              },
            },
          ],
        },
      });
    const completion = JSON.stringify(goalResult("toolu_goal", "agentgoal"));
    const sameTurn = [
      ...preflight,
      materialization[0]!,
      materialization[1]!,
      materialization[2]!,
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            JSON.parse(materialization[3]!).message.content[0],
            JSON.parse(goalCall(boundGoalPrompt())).message.content[0],
          ],
        },
      }),
      materialization[4]!,
      materialization[5]!,
      materialization[6]!,
      completion,
    ].join("\n");
    const wrongProof = [
      ...preflight,
      ...materialization,
      goalCall("- phase: adaptive-goal-runner\nwrong objective"),
      completion,
    ].join("\n");
    const proofOnly = [
      ...preflight,
      ...materialization,
      goalCall("- phase: adaptive-goal-runner"),
      completion,
    ].join("\n");
    const wrongStagedDigest = [
      ...preflight,
      materialization[0]!,
      materialization[1]!,
      materialization[2]!,
      materialization[3]!,
      materialization[4]!.replace(objectiveDigest, fileBackedDigest),
      materialization[5]!,
      materialization[6]!,
      goalCall(boundGoalPrompt()),
      completion,
    ].join("\n");
    const parentWork = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Edit",
              id: "toolu_parent_edit",
              input: {
                file_path: "/fixture/auth-config.js",
                old_string: 'sameSite: "lax"',
                new_string: 'sameSite: "strict"',
              },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_parent_test",
              input: { command: "bash test.sh" },
            },
          ],
        },
      }),
      ...preflight,
      ...materialization,
      goalCall(boundGoalPrompt()),
      completion,
    ].join("\n");

    for (const stream of [sameTurn, wrongProof, proofOnly, wrongStagedDigest]) {
      expect(
        retainedClaudeEvidence(stream, undefined, routeEvidenceContext),
      ).not.toContain("darrow.goal_agent_completion");
    }
    expect(
      retainedClaudeEvidence(wrongProof, undefined, routeEvidenceContext),
    ).toContain('"operation":"agent-contract-body-mismatch"');
    const parentWorkEvidence = retainedClaudeEvidence(
      parentWork,
      undefined,
      routeEvidenceContext,
    );
    expect(parentWorkEvidence).toContain("darrow.goal_agent_completion");
    expect(parentWorkEvidence).toContain(
      '"type":"darrow.parent_repository_tool_before_goal","tool":"Edit","operation":"edit"',
    );
    expect(claudeParentLifecycleOperations(parentWorkEvidence)).toEqual([
      "before:edit",
      "before:test-bash",
    ]);
    const wrongMaterialization = materialization[3]!
      .replace("toolu_materialize", "toolu_wrong_materialize")
      .replace("/tmp/goal.md", "/tmp/other.md");
    const duplicateMaterialization = materialization[3]!.replace(
      "toolu_materialize",
      "toolu_duplicate_materialize",
    );
    const materializationMisuse = [
      ...preflight,
      materialization[0]!,
      materialization[1]!,
      materialization[2]!,
      wrongMaterialization,
      materialization[3]!,
      materialization[4]!,
      materialization[5]!,
      materialization[6]!,
      duplicateMaterialization,
      goalCall(boundGoalPrompt()),
      completion,
    ].join("\n");
    const misuseEvidence = retainedClaudeEvidence(
      materializationMisuse,
      undefined,
      routeEvidenceContext,
    );
    expect(misuseEvidence).toContain("darrow.goal_agent_completion");
    expect(
      misuseEvidence
        .split("\n")
        .filter((line) =>
          line.includes("darrow.parent_repository_tool_before_goal"),
        ),
    ).toHaveLength(2);
    const missingStagingCleanup = [
      ...preflight,
      ...materialization.slice(0, 5),
      goalCall(boundGoalPrompt()),
      completion,
    ].join("\n");
    const failedCleanupResult = JSON.stringify({
      ...JSON.parse(materialization[6]!),
      message: {
        content: [
          {
            ...JSON.parse(materialization[6]!).message.content[0],
            is_error: true,
          },
        ],
      },
    });
    const failedStagingCleanup = [
      ...preflight,
      ...materialization.slice(0, 6),
      failedCleanupResult,
      goalCall(boundGoalPrompt()),
      completion,
    ].join("\n");
    for (const stream of [missingStagingCleanup, failedStagingCleanup])
      expect(
        retainedClaudeEvidence(stream, undefined, routeEvidenceContext),
      ).not.toContain("darrow.goal_agent_completion");
    const duplicateCleanup = materialization[5]!.replace(
      "toolu_release_staging",
      "toolu_duplicate_release_staging",
    );
    const duplicateCleanupStream = [
      ...preflight,
      ...materialization,
      duplicateCleanup,
      goalCall(boundGoalPrompt()),
      completion,
    ].join("\n");
    const duplicateCleanupEvidence = retainedClaudeEvidence(
      duplicateCleanupStream,
      undefined,
      routeEvidenceContext,
    );
    expect(duplicateCleanupEvidence).toContain("darrow.goal_agent_completion");
    expect(duplicateCleanupEvidence).toContain(
      "darrow.parent_repository_tool_before_goal",
    );
  });

  test("requires successful ordered preflight before staging", () => {
    const calls = [
      {
        type: "tool_use",
        name: "Bash",
        id: "toolu_tmpdir",
        input: { command: "/usr/bin/printenv TMPDIR" },
      },
      {
        type: "tool_use",
        name: "Read",
        id: "toolu_read",
        input: { file_path: "/fixture/auth-config.js" },
      },
      {
        type: "tool_use",
        name: "Write",
        id: "toolu_stage",
        input: { file_path: "/tmp/goal.md", content: objectiveContract },
      },
      {
        type: "tool_use",
        name: "Bash",
        id: "toolu_prepare",
        input: {
          command:
            "/bin/bash /plugin/darrow-goal-loop/bin/goal-loop prepare --repo /fixture --host claude",
        },
      },
      {
        type: "tool_use",
        name: "Bash",
        id: "toolu_route",
        input: {
          command:
            "/bin/bash /plugin/darrow-goal-loop/bin/goal-loop route --repo /fixture --host claude --profile routine",
        },
      },
      {
        type: "tool_use",
        name: "Bash",
        id: "toolu_agent_route",
        input: {
          command:
            "/bin/bash /plugin/darrow-goal-loop/bin/claude-agent-route --provider anthropic --model claude-sonnet-5 --effort low",
        },
      },
    ];
    const stream = [
      JSON.stringify({
        type: "assistant",
        message: { content: [calls[0]] },
      }),
      JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_tmpdir",
              content: "/tmp",
            },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: { content: calls.slice(1) },
      }),
    ].join("\n");
    expect(
      retainedClaudeEvidence(stream, undefined, routeEvidenceContext),
    ).toContain("darrow.parent_repository_tool_before_goal");

    const valid = [
      ...validClaudePreflightEvents(),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            calls[1],
            {
              type: "tool_use",
              name: "ToolSearch",
              id: "toolu_search",
              input: { query: "select:Glob" },
            },
            calls[0],
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_tmpdir",
              content: "/tmp",
            },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: { content: [calls[2]] },
      }),
    ].join("\n");
    expect(
      retainedClaudeEvidence(valid, undefined, routeEvidenceContext),
    ).not.toContain("darrow.parent_repository_tool_before_goal");

    const failedPrepare = validClaudePreflightEvents();
    failedPrepare[1] = failedPrepare[1]!.replace(
      '"type":"tool_result"',
      '"type":"tool_result","is_error":true',
    );
    expect(
      retainedClaudeEvidence(
        failedPrepare.join("\n"),
        undefined,
        routeEvidenceContext,
      ),
    ).toContain("darrow.parent_repository_tool_before_goal");
  });

  test("permits runner resolution after materialization but before Agent", () => {
    const preflight = validClaudePreflightEvents();
    const stream = [
      ...preflight.slice(0, 4),
      ...inlineMaterializationEvents(),
      ...preflight.slice(4),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_goal",
              input: {
                subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
                run_in_background: false,
                prompt: boundGoalPrompt(),
              },
            },
          ],
        },
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal")),
    ].join("\n");
    expect(
      retainedClaudeEvidence(stream, undefined, routeEvidenceContext),
    ).toContain("darrow.goal_agent_completion");
  });

  test("rejects Bash inspection while ignoring an exact inert true", () => {
    const repoDir = mkdtempSync(join(tmpdir(), "darrow-claude-inspect-"));
    const context = { ...routeEvidenceContext, repoDir: realpathSync(repoDir) };
    try {
      const safe = JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_find",
              input: { command: "find . -maxdepth 2 -type f 2>/dev/null" },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_ls",
              input: { command: "ls -la . >/dev/null 2>&1 || true" },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_find_list",
              input: {
                command:
                  "find . -maxdepth 2 -type f 2>/dev/null; echo files; find . -maxdepth 1 -type f | sort",
              },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_find_head",
              input: { command: "find . -maxdepth 2 -type f | head -n 20" },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_true",
              input: { command: "true" },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_option_first_find",
              input: { command: "find -L /etc -maxdepth 1 -type f" },
            },
          ],
        },
      });
      expect(
        retainedClaudeEvidence(safe, undefined, context)
          .split("\n")
          .filter((line) =>
            line.includes("darrow.parent_repository_tool_before_goal"),
          ),
      ).toHaveLength(5);

      const unsafe = JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_escape",
              input: { command: "find .. -maxdepth 1 -type f 2>/dev/null" },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_delete",
              input: { command: "find . -type f -delete" },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_redirect",
              input: { command: "ls . 2>/tmp/ls-errors" },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_compound_mutation",
              input: { command: "ls . && touch changed" },
            },
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_head_external",
              input: { command: "head /etc/passwd" },
            },
          ],
        },
      });
      expect(
        claudeParentLifecycleOperations(
          retainedClaudeEvidence(unsafe, undefined, context),
        ),
      ).toEqual([
        "before:mutation-redirect-find",
        "before:mutation-find",
        "before:mutation-redirect-ls",
        "before:mutation-touch",
        "before:inspect-head",
      ]);
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  test("rejects pre-goal shell inspection, tests, redirects, and node writes", () => {
    const stream = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_baseline",
            input: { command: "bash test.sh" },
          },
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_duplicate_baseline",
            input: { command: "./test.sh" },
          },
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_mutating_inspection",
            input: { command: "sed -i backup /fixture/auth-config.js" },
          },
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_compound_read",
            input: { command: "bytes=$(wc -c < /fixture/auth-config.js)" },
          },
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_write_redirect",
            input: { command: "wc -c /fixture/auth-config.js > /tmp/count" },
          },
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_node_write",
            input: {
              command:
                'node -e \'require("node:fs").writeFileSync("/fixture/auth-config.js", "changed")\'',
            },
          },
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_shadow_cat",
            input: { command: "./cat /fixture/auth-config.js" },
          },
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_awk_system",
            input: { command: "awk 'BEGIN { system(\"touch changed\") }'" },
          },
        ],
      },
    });
    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(claudeParentLifecycleOperations(retained)).toEqual([
      "before:test-bash",
      "before:test-test.sh",
      "before:mutation-sed",
      "before:inspect-bytes",
      "before:mutation-redirect-wc",
      "before:other-node",
      "before:other-cat",
      "before:inspect-awk",
    ]);
  });

  test("requires one successful temporary-root probe before staging", () => {
    const probe = (id = "toolu_tmpdir", command = "/usr/bin/printenv TMPDIR") =>
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              id,
              input: { command },
            },
          ],
        },
      });
    const result = (isError = false) =>
      JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_tmpdir",
              content: "/tmp",
              is_error: isError,
            },
          ],
        },
      });
    const write = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Write",
            id: "toolu_stage",
            input: { file_path: "/tmp/goal.md", content: objectiveContract },
          },
        ],
      },
    });
    const streams = [
      write,
      [probe(), result(true), write].join("\n"),
      [probe(), result(), probe("toolu_duplicate_probe"), write].join("\n"),
      [probe("toolu_tmpdir", "printenv HOME"), result(), write].join("\n"),
    ];
    for (const stream of streams)
      expect(
        retainedClaudeEvidence(stream, undefined, routeEvidenceContext),
      ).toContain("darrow.parent_repository_tool_before_goal");
  });

  test("canonicalizes staging paths and permits one runner-controlled Write", () => {
    const root = mkdtempSync(join(tmpdir(), "darrow-claude-staging-"));
    const repo = join(root, "repo");
    const staging = join(root, "staging");
    const alias = join(root, "repo-alias");
    mkdirSync(repo);
    mkdirSync(staging);
    symlinkSync(repo, alias, "dir");
    const canonicalStaging = realpathSync(staging);
    try {
      const context = {
        ...routeEvidenceContext,
        repoDir: repo,
        stagingRoot: canonicalStaging,
      };
      const stream = [
        ...validClaudePreflightEvents(context),
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                name: "Bash",
                id: "toolu_tmpdir",
                input: { command: "printenv TMPDIR" },
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
                tool_use_id: "toolu_tmpdir",
                content: canonicalStaging,
              },
            ],
          },
        }),
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                name: "Write",
                id: "toolu_stage",
                input: {
                  file_path: join(canonicalStaging, "goal.md"),
                  content: objectiveContract,
                },
              },
              {
                type: "tool_use",
                name: "Write",
                id: "toolu_extra_stage",
                input: {
                  file_path: join(staging, "extra.md"),
                  content: "extra",
                },
              },
              {
                type: "tool_use",
                name: "Write",
                id: "toolu_alias_write",
                input: {
                  file_path: join(alias, "auth-config.js"),
                  content: "parent implementation",
                },
              },
            ],
          },
        }),
      ].join("\n");
      const retained = retainedClaudeEvidence(stream, undefined, context);
      expect(
        retained
          .split("\n")
          .filter((line) =>
            line.includes("darrow.parent_repository_tool_before_goal"),
          ),
      ).toHaveLength(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("retains route observation and confirmation only after goal completion", () => {
    const assistantTool = (
      id: string,
      name: string,
      input: Record<string, unknown>,
    ) =>
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "tool_use", name, id, input }],
        },
      });
    const toolResult = (toolUseId: string, content: string) =>
      JSON.stringify({
        type: "user",
        message: {
          content: [{ type: "tool_result", tool_use_id: toolUseId, content }],
        },
      });
    const stream = [
      ...validClaudePreflightEvents(),
      assistantTool("toolu_tmpdir", "Bash", {
        command: "/usr/bin/printenv TMPDIR",
      }),
      toolResult("toolu_tmpdir", "/tmp"),
      assistantTool("toolu_stage", "Write", {
        file_path: "/tmp/goal.md",
        content: fileBackedContract,
      }),
      assistantTool("toolu_materialize", "Bash", {
        command:
          "/bin/bash /plugin/darrow-goal-loop/bin/goal-loop materialize-objective --force-file-backed --repo /fixture --goal-file /tmp/goal.md",
      }),
      toolResult(
        "toolu_materialize",
        `format\tdarrow-native-goal-objective-v1\nmode\tfile-backed\ncontract_bytes\t5000\ncontract_sha256\t${fileBackedDigest}\ncontract_file\t/private/darrow-goal-contract.fixture/goal-contract.md\nobjective_bytes\t300\nobjective_file\t/private/darrow-goal-contract.fixture/goal-objective.txt\nattachment_dir\t/private/darrow-goal-contract.fixture`,
      ),
      assistantTool("toolu_release_staging", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop release-staging --goal-file /tmp/goal.md --expected-sha256 ${fileBackedDigest}`,
      }),
      toolResult(
        "toolu_release_staging",
        "format\tdarrow-native-goal-staging-release-v1\nstatus\treleased\ngoal_file\t/tmp/goal.md",
      ),
      assistantTool("toolu_goal", "Agent", {
        subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
        run_in_background: false,
        prompt: boundGoalPrompt(
          "/private/darrow-goal-contract.fixture/goal-objective.txt",
          "file-backed",
        ),
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal")),
      assistantTool("toolu_gate", "Bash", {
        command:
          "/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low'",
      }),
      toolResult(
        "toolu_gate",
        "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobserved_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\nconfirmation\tconfirmed",
      ),
      assistantTool("toolu_release", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop release-objective --attachment-dir /private/darrow-goal-contract.fixture --expected-sha256 ${fileBackedDigest}`,
      }),
      toolResult(
        "toolu_release",
        "format\tdarrow-native-goal-objective-release-v1\nstatus\treleased\nattachment_dir\t/private/darrow-goal-contract.fixture",
      ),
      assistantTool("toolu_release_again", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop release-objective --attachment-dir /private/darrow-goal-contract.fixture --expected-sha256 ${fileBackedDigest}`,
      }),
      toolResult("toolu_release_again", "private duplicate cleanup result"),
      assistantTool("toolu_search", "ToolSearch", { query: "route gate" }),
      assistantTool("toolu_compute", "Bash", {
        command: "printf '%s' route-result",
      }),
      toolResult("toolu_compute", "private compute result"),
      assistantTool("toolu_status", "Bash", { command: "git status --short" }),
      toolResult("toolu_status", "private status result"),
      assistantTool("toolu_diff", "Bash", { command: "git diff --stat" }),
      toolResult("toolu_diff", "private diff result"),
      assistantTool("toolu_test", "Bash", { command: "bash test.sh" }),
      toolResult("toolu_test", "private test result"),
      assistantTool("toolu_agent", "Agent", {
        subagent_type: "general-purpose",
        prompt: "private follow-up",
      }),
      toolResult("toolu_agent", "private agent result"),
      assistantTool("toolu_sed", "Bash", { command: "sed -i '' file" }),
      toolResult("toolu_sed", "private sed result"),
      assistantTool("toolu_touch", "Bash", { command: "touch unexpected" }),
      toolResult("toolu_touch", "private touch result"),
      assistantTool("toolu_node", "Bash", { command: "node custom-check.js" }),
      toolResult("toolu_node", "private node result"),
      JSON.stringify({ type: "result", subtype: "success", is_error: false }),
    ].join("\n");

    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).toContain(
      '"type":"darrow.claude_route_observation","tool_use_id":"toolu_gate","goal_tool_use_id":"toolu_goal","agent_id":"agentgoal","status":"observed","harness":"claude","provider":"anthropic","model":"claude-sonnet-5","effort":"low"',
    );
    expect(retained).toContain(
      '"type":"darrow.claude_route_confirmation","tool_use_id":"toolu_gate","goal_tool_use_id":"toolu_goal","agent_id":"agentgoal","status":"confirmed","selectedModel":"claude-sonnet-5","selectedEffort":"low","effectiveModel":"claude-sonnet-5","effectiveEffort":"low"',
    );
    expect(retained).not.toContain("private/transcript");
    expect(retained).not.toContain("private child result");
    expect(retained).not.toContain("private cleanup result");
    expect(retained).not.toContain("private compute result");
    expect(retained).not.toContain("private status result");
    expect(retained).not.toContain("private diff result");
    expect(retained).toContain('"tool":"Bash","operation":"other-printf"');
    expect(retained).toContain('"tool":"Agent","operation":"agent"');
    expect(retained).toContain('"tool":"Bash","operation":"git-status"');
    expect(retained).toContain('"tool":"Bash","operation":"git-diff"');
    expect(retained).not.toContain("private test result");
    expect(retained).toContain(
      '"type":"darrow.parent_repository_tool_after_goal","goal_tool_use_id":"toolu_goal","tool":"Bash","operation":"test-bash"',
    );
    expect(
      retained
        .split("\n")
        .filter((line) =>
          line.includes("darrow.parent_repository_tool_after_goal"),
        ),
    ).toHaveLength(9);
    expect(hasClaudeGoalAgentEvidence(retained)).toBe(true);
    expect(claudeGoalRouteEvidence(retained)).toEqual({
      goalToolUseId: "toolu_goal",
      agentId: "agentgoal",
      subagentType: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
      observation: {
        status: "observed",
        harness: "claude",
        provider: "anthropic",
        model: "claude-sonnet-5",
        effort: "low",
      },
      confirmation: {
        status: "confirmed",
        selectedModel: "claude-sonnet-5",
        selectedEffort: "low",
        effectiveModel: "claude-sonnet-5",
        effectiveEffort: "low",
      },
    });
    const boundedPrompt = boundGoalPrompt(
      "/private/darrow-goal-contract.fixture/goal-objective.txt",
      "file-backed",
    );
    const completeContractPrompt = [
      "- phase: adaptive-goal-runner",
      fileBackedContract,
    ].join("\n");
    const completeContractEvidence = retainedClaudeEvidence(
      stream.replace(
        JSON.stringify(boundedPrompt).slice(1, -1),
        JSON.stringify(completeContractPrompt).slice(1, -1),
      ),
      undefined,
      routeEvidenceContext,
    );
    expect(completeContractEvidence).not.toContain(
      "darrow.goal_agent_completion",
    );
    expect(completeContractEvidence).toContain("agent-contract-body-mismatch");
    const appendedTextEvidence = retainedClaudeEvidence(
      stream.replace(
        JSON.stringify(boundedPrompt).slice(1, -1),
        JSON.stringify(`${boundedPrompt}\nnon-authoritative host note`).slice(
          1,
          -1,
        ),
      ),
      undefined,
      routeEvidenceContext,
    );
    expect(appendedTextEvidence).toContain("darrow.goal_agent_completion");
    const displacedReferenceEvidence = retainedClaudeEvidence(
      stream.replace(
        JSON.stringify(boundedPrompt).slice(1, -1),
        JSON.stringify(
          `- phase: adaptive-goal-runner\nnon-authoritative host note\n- objective_file: /private/darrow-goal-contract.fixture/goal-objective.txt`,
        ).slice(1, -1),
      ),
      undefined,
      routeEvidenceContext,
    );
    expect(displacedReferenceEvidence).not.toContain(
      "darrow.goal_agent_completion",
    );
    const routeEvidence = claudeGoalRouteEvidence(retained)!;
    expect(
      claudeGoalRouteReportMatches(
        {
          harness: "claude",
          model: "anthropic > claude-sonnet-5",
          effort: "low",
          route_applied_by: "native-subagent",
          route_verified: "true",
          launch_boundary: "native_subagent",
          evaluation_child_invocations: "1",
        },
        routeEvidence,
        { model: "claude-sonnet-5", effort: "low" },
      ),
    ).toBe(true);
  });

  test("retains an unavailable route observation without command or result text", () => {
    const stream = [
      ...validClaudePreflightEvents(),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_tmpdir",
              input: { command: "/usr/bin/printenv TMPDIR" },
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
              tool_use_id: "toolu_tmpdir",
              content: "/tmp",
            },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Write",
              id: "toolu_stage",
              input: {
                file_path: "/tmp/goal.md",
                content: objectiveContract,
              },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_materialize",
              input: {
                command:
                  "/bin/bash /plugin/darrow-goal-loop/bin/goal-loop materialize-objective --force-file-backed --repo /fixture --goal-file /tmp/goal.md",
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
              tool_use_id: "toolu_materialize",
              content: `format\tdarrow-native-goal-objective-v1\nmode\tinline\ncontract_bytes\t100\ncontract_sha256\t${objectiveDigest}\ncontract_file\t/tmp/goal.md\nobjective_bytes\t100\nobjective_file\t/tmp/goal.md\nattachment_dir\tnone`,
            },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_release_staging",
              input: {
                command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop release-staging --goal-file /tmp/goal.md --expected-sha256 ${objectiveDigest}`,
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
              tool_use_id: "toolu_release_staging",
              content:
                "format\tdarrow-native-goal-staging-release-v1\nstatus\treleased\ngoal_file\t/tmp/goal.md",
            },
          ],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_goal",
              input: {
                subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
                run_in_background: false,
                prompt: boundGoalPrompt(),
              },
            },
          ],
        },
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal")),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_gate",
              input: {
                command:
                  "/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low'",
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
              tool_use_id: "toolu_gate",
              content:
                "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobservation\tunavailable",
            },
          ],
        },
      }),
    ].join("\n");

    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).toContain(
      '"type":"darrow.claude_route_observation","tool_use_id":"toolu_gate","goal_tool_use_id":"toolu_goal","agent_id":"agentgoal","status":"unavailable"',
    );
    expect(retained).toContain(
      '"type":"darrow.goal_objective_materialization","status":"inline"',
    );
    expect(retained).not.toContain("claude-route-gate-v1");
    const routeEvidence = claudeGoalRouteEvidence(retained)!;
    expect(
      claudeGoalRouteEvidence(
        retained
          .split("\n")
          .filter(
            (line) => !line.includes("darrow.goal_objective_materialization"),
          )
          .join("\n"),
      ),
    ).toBeUndefined();
    expect(
      claudeGoalRouteReportMatches(
        {
          harness: "claude",
          model: "anthropic > unknown",
          effort: "unknown",
          route_applied_by: "native-subagent",
          route_verified: "false",
          launch_boundary: "launch_required",
          evaluation_child_invocations: "1",
        },
        routeEvidence,
        { model: "claude-sonnet-5", effort: "low" },
      ),
    ).toBe(true);
    expect(
      claudeGoalRouteReportMatches(
        {
          harness: "claude",
          model: "anthropic > unknown",
          effort: "unknown",
          route_applied_by: "native-subagent",
          route_verified: "false",
          launch_boundary: "launch_required",
          evaluation_child_invocations: "1",
        },
        { ...routeEvidence, confirmation: { status: "rejected" } },
        { model: "claude-sonnet-5", effort: "low" },
      ),
    ).toBe(false);
    expect(
      claudeGoalRouteReportMatches(
        {
          harness: "claude",
          model: "anthropic > claude-sonnet-5",
          effort: "low",
          route_applied_by: "native-subagent",
          route_verified: "false",
          launch_boundary: "launch_required",
          evaluation_child_invocations: "1",
        },
        routeEvidence,
        { model: "claude-sonnet-5", effort: "low" },
      ),
    ).toBe(false);
  });

  test("requires release to match materialization and complete successfully", () => {
    const toolCall = (
      id: string,
      name: string,
      input: Record<string, unknown>,
    ) => ({
      type: "assistant",
      message: { content: [{ type: "tool_use", name, id, input }] },
    });
    const toolResult = (id: string, content: string, isError = false) => ({
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: id, content, is_error: isError },
        ],
      },
    });
    const digest = fileBackedDigest;
    const attachment = "/private/darrow-goal-contract.fixture";
    const stream = [
      ...validClaudePreflightEvents().map((line) => JSON.parse(line)),
      toolCall("toolu_tmpdir", "Bash", {
        command: "/usr/bin/printenv TMPDIR",
      }),
      toolResult("toolu_tmpdir", "/tmp"),
      toolCall("toolu_stage", "Write", {
        file_path: "/tmp/goal.md",
        content: fileBackedContract,
      }),
      toolCall("toolu_materialize", "Bash", {
        command:
          "/bin/bash /plugin/darrow-goal-loop/bin/goal-loop materialize-objective --force-file-backed --repo /fixture --goal-file /tmp/goal.md",
      }),
      toolResult(
        "toolu_materialize",
        `format\tdarrow-native-goal-objective-v1\nmode\tfile-backed\ncontract_bytes\t5000\ncontract_sha256\t${digest}\ncontract_file\t${attachment}/goal-contract.md\nobjective_bytes\t300\nobjective_file\t${attachment}/goal-objective.txt\nattachment_dir\t${attachment}`,
      ),
      toolCall("toolu_release_staging", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop release-staging --goal-file /tmp/goal.md --expected-sha256 ${digest}`,
      }),
      toolResult(
        "toolu_release_staging",
        "format\tdarrow-native-goal-staging-release-v1\nstatus\treleased\ngoal_file\t/tmp/goal.md",
      ),
      toolCall("toolu_goal", "Agent", {
        subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
        run_in_background: false,
        prompt: boundGoalPrompt(
          "/private/darrow-goal-contract.fixture/goal-objective.txt",
          "file-backed",
        ),
      }),
      goalResult("toolu_goal", "agentgoal"),
      toolCall("toolu_wrong_release", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop release-objective --attachment-dir /private/darrow-goal-contract.wrong --expected-sha256 ${digest}`,
      }),
      toolResult("toolu_wrong_release", "private wrong release"),
      toolCall("toolu_failed_release", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop release-objective --attachment-dir ${attachment} --expected-sha256 ${digest}`,
      }),
      toolResult("toolu_failed_release", "private failed release", true),
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");

    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).toContain('"operation":"goal-loop-unbound"');
    expect(retained).toContain('"operation":"release-failed"');
    expect(retained).toContain('"operation":"release-missing"');
    expect(retained).not.toContain("private failed release");
  });

  test("rejects unbound, wrong-route, and compound lifecycle commands", () => {
    const event = (value: unknown) => JSON.stringify(value);
    const bashCall = (id: string, command: string) => ({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "Bash", id, input: { command } }],
      },
    });
    const result = (id: string, content: string) => ({
      type: "user",
      message: {
        content: [{ type: "tool_result", tool_use_id: id, content }],
      },
    });
    const stream = [
      ...validClaudePreflightEvents().map((line) => JSON.parse(line)),
      ...inlineMaterializationEvents().map((line) => JSON.parse(line)),
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Agent",
              id: "toolu_goal",
              input: {
                subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
                run_in_background: false,
                prompt: boundGoalPrompt(),
              },
            },
          ],
        },
      },
      goalResult("toolu_goal", "agentgoal"),
      bashCall(
        "toolu_wrong_agent",
        "/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id otheragent --selected 'claude|anthropic|claude-sonnet-5|low'",
      ),
      result(
        "toolu_wrong_agent",
        "format\tdarrow-claude-route-gate-v1\nagent_id\totheragent\nobservation\tunavailable",
      ),
      bashCall(
        "toolu_wrong_route",
        "/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-opus-5|high'",
      ),
      result(
        "toolu_wrong_route",
        "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobservation\tunavailable",
      ),
      bashCall(
        "toolu_wrong_output",
        "/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low'",
      ),
      result(
        "toolu_wrong_output",
        "format\tdarrow-claude-route-gate-v1\nagent_id\totheragent\nobservation\tunavailable",
      ),
      bashCall(
        "toolu_spoof",
        "printf '%s' 'claude-route-gate --repo /fixture --agent-id agentgoal'; git diff --stat",
      ),
      result("toolu_spoof", "private spoof result"),
      bashCall(
        "toolu_compound_release",
        "/bin/bash /plugin/darrow-goal-loop/bin/goal-loop release-objective --attachment-dir /private/attachment --expected-sha256 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa && bash test.sh",
      ),
      result("toolu_compound_release", "private compound result"),
      bashCall(
        "toolu_fake_path",
        "/bin/bash /tmp/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low'",
      ),
      result(
        "toolu_fake_path",
        "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobserved_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\nconfirmation\tconfirmed",
      ),
      bashCall(
        "toolu_wrong_repo",
        "/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /other --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low'",
      ),
      result(
        "toolu_wrong_repo",
        "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobserved_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\nconfirmation\tconfirmed",
      ),
      bashCall(
        "toolu_retry",
        "/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low'",
      ),
      result(
        "toolu_retry",
        "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobserved_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\nconfirmation\tconfirmed",
      ),
    ]
      .map(event)
      .join("\n");

    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).not.toContain('"type":"darrow.claude_route_observation"');
    expect(retained).toContain('"operation":"git-diff"');
    expect(retained).toContain('"operation":"test-bash+bash"');
    expect(
      retained
        .split("\n")
        .filter((line) =>
          line.includes("darrow.parent_repository_tool_after_goal"),
        ),
    ).toHaveLength(7);
    expect(retained).not.toContain("private spoof result");
    expect(retained).not.toContain("private compound result");
  });

  test("requires confirmation for every observed route", () => {
    const retained = [
      JSON.stringify({
        type: "darrow.goal_agent_completion",
        tool_use_id: "toolu_goal",
        subagent_type: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
        status: "completed",
        agent_id: "agentgoal",
      }),
      JSON.stringify({
        type: "darrow.claude_route_observation",
        tool_use_id: "toolu_gate",
        goal_tool_use_id: "toolu_goal",
        agent_id: "agentgoal",
        status: "observed",
        harness: "claude",
        provider: "anthropic",
        model: "claude-opus-5",
        effort: "high",
      }),
    ].join("\n");
    expect(claudeGoalRouteEvidence(retained)).toBeUndefined();
  });

  test("a mismatched observed route must be reported exactly and unverified", () => {
    const evidence = {
      goalToolUseId: "toolu_goal",
      agentId: "agentgoal",
      subagentType: "darrow-goal-loop:adaptive-goal-sonnet-5-low",
      observation: {
        status: "observed" as const,
        harness: "claude",
        provider: "anthropic",
        model: "claude-opus-5",
        effort: "high",
      },
      confirmation: {
        status: "rejected" as const,
        selectedModel: "claude-sonnet-5",
        selectedEffort: "low",
        effectiveModel: "claude-opus-5",
        effectiveEffort: "high",
      },
    };
    const base = {
      harness: "claude",
      route_applied_by: "native-subagent",
      route_verified: "false",
      launch_boundary: "launch_required",
      evaluation_child_invocations: "1",
    };
    expect(
      claudeGoalRouteReportMatches(
        {
          ...base,
          model: "anthropic > claude-opus-5",
          effort: "high",
        },
        evidence,
        { model: "claude-sonnet-5", effort: "low" },
      ),
    ).toBe(true);
    expect(
      claudeGoalRouteReportMatches(
        {
          ...base,
          model: "anthropic > claude-sonnet-5",
          effort: "low",
        },
        evidence,
        { model: "claude-sonnet-5", effort: "low" },
      ),
    ).toBe(false);
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
