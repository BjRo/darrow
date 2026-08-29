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
  goalReportRequiresObjectiveRelease,
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
  engineeringRequest:
    "After the snapshot run `decisionctl answer <blocked-operation>`.",
};
const objectiveContract = "private objective";
const objectiveDigest = new Bun.CryptoHasher("sha256")
  .update(objectiveContract)
  .digest("hex");
const fileBackedContract = "private file-backed objective";
const fileBackedDigest = new Bun.CryptoHasher("sha256")
  .update(fileBackedContract)
  .digest("hex");
const goalLedger = "/tmp/darrow-goal-run.fixture";

function validClaudePreflightEvents(context = routeEvidenceContext) {
  const ledger =
    context.stagingRoot === "/tmp"
      ? goalLedger
      : `${context.stagingRoot}/darrow-goal-run.fixture`;
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
      "toolu_start",
      `/bin/bash ${context.pluginDir}/bin/goal-loop step start --repo ${context.repoDir} --host claude`,
      [
        "format\tdarrow-goal-step-v1",
        "run_id\tfixture",
        `ledger\t${ledger}`,
        `staging_dir\t${context.stagingRoot}/darrow-goal-stage.fixture`,
        "step\tstart",
        "status\trecorded",
        `repo\t${context.repoDir}`,
        "host\tclaude",
        "enforcement\thelper",
      ].join("\n"),
    ),
    ...exchange(
      "toolu_prepare",
      `/bin/bash ${context.pluginDir}/bin/goal-loop step prepare --ledger ${ledger}`,
      [
        "format\tdarrow-goal-step-v1",
        "run_id\tfixture",
        `ledger\t${ledger}`,
        "step\tprepare",
        "status\trecorded",
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
      `/bin/bash ${context.pluginDir}/bin/goal-loop step route --ledger ${ledger} --workflow change-feature --risk routine --profile routine --verification-gate routine --readiness omitted --review omitted`,
      [
        "format\tdarrow-goal-step-v1",
        "run_id\tfixture",
        `ledger\t${ledger}`,
        "step\troute",
        "status\trecorded",
        "workflow\tchange-feature",
        "risk\troutine",
        "profile\troutine",
        "verification_gate\troutine",
        "readiness_selection\tomitted",
        "review_selection\tomitted",
        "selected_route\tclaude|anthropic|claude-sonnet-5|low",
        "route_source\tpolicy",
      ].join("\n"),
    ),
    ...exchange(
      "toolu_agent_route",
      `/bin/bash ${context.pluginDir}/bin/goal-loop step runner --ledger ${ledger} --provider anthropic --model claude-sonnet-5 --effort low`,
      [
        "format\tdarrow-goal-step-v1",
        "run_id\tfixture",
        `ledger\t${ledger}`,
        "step\trunner",
        "status\trecorded",
        "format\tdarrow-claude-agent-route-v1",
        "selected_route\tclaude\tanthropic\tclaude-sonnet-5\tlow",
        "subagent_type\tdarrow-goal-loop:adaptive-goal-sonnet-5-low",
        `agent_file\t${context.pluginDir}/agents/adaptive-goal-sonnet-5-low.md`,
      ].join("\n"),
    ),
  ];
}

function boundGoalPrompt(
  objectiveFile = "/tmp/darrow-goal-stage.fixture/goal.md",
  mode: "inline" | "file-backed" = "inline",
) {
  const body =
    mode === "inline"
      ? objectiveContract
      : `- objective_file: ${objectiveFile}`;
  return ["- phase: adaptive-goal-runner", body].join("\n");
}

function provisionalActivationEvents() {
  const command =
    `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step activate --ledger ${goalLedger} ` +
    "--applied-by native-subagent --boundary native_subagent --agent-id pending " +
    "--effective-route 'claude|anthropic|claude-sonnet-5|low' --route-verified false";
  const content = [
    "format\tdarrow-goal-step-v1",
    "run_id\tfixture",
    `ledger\t${goalLedger}`,
    "step\tactivate",
    "status\trecorded",
    "agent_id\tpending",
    "effective_route\tclaude|anthropic|claude-sonnet-5|low",
    "route_verified\tfalse",
    "enforcement\thelper",
  ].join("\n");
  return [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_activate",
            input: { command },
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
            tool_use_id: "toolu_activate",
            content,
          },
        ],
      },
    }),
  ];
}

function inlineMaterializationEvents(includeActivation = true) {
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
            input: {
              file_path: "/tmp/darrow-goal-stage.fixture/goal.md",
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
            id: "toolu_register_stage",
            input: {
              command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step stage --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md`,
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
            tool_use_id: "toolu_register_stage",
            content: [
              "format\tdarrow-goal-step-v1",
              "run_id\tfixture",
              `ledger\t${goalLedger}`,
              "step\tstage",
              "status\trecorded",
              "goal_file\t/tmp/darrow-goal-stage.fixture/goal.md",
              `contract_sha256\t${objectiveDigest}`,
            ].join("\n"),
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
              command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step materialize --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md --expected-sha256 ${objectiveDigest}`,
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
            content: `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\tmaterialize\nstatus\trecorded\nformat\tdarrow-native-goal-objective-v1\nmode\tinline\ncontract_bytes\t100\ncontract_sha256\t${objectiveDigest}\ncontract_file\t/tmp/darrow-goal-stage.fixture/goal.md\nobjective_bytes\t100\nobjective_file\t/tmp/darrow-goal-stage.fixture/goal.md\nattachment_dir\tnone`,
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
              command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step release-staging --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md --expected-sha256 ${objectiveDigest}`,
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
            content: `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\trelease-staging\nstatus\trecorded\nformat\tdarrow-native-goal-staging-release-v1\nstatus\treleased\ngoal_file\t/tmp/darrow-goal-stage.fixture/goal.md`,
          },
        ],
      },
    }),
    ...(includeActivation ? provisionalActivationEvents() : []),
  ];
}

function goalReportEvents(
  enforcement = "helper",
  status: "complete" | "blocked" = "complete",
  toolUseId = "toolu_report",
) {
  return [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: toolUseId,
            input: {
              command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step report --ledger ${goalLedger} --status ${status} --human-interruptions 0`,
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
            tool_use_id: toolUseId,
            content: [
              "format: darrow-native-goal-report-v1",
              "workflow: change-feature",
              "risk: routine",
              "profile: routine",
              "harness: claude",
              "model: anthropic > claude-sonnet-5",
              "effort: low",
              "route_applied_by: native-subagent",
              "route_verified: true",
              "launch_boundary: native_subagent",
              "verification_gate: routine",
              "evaluation_child_invocations: 1",
              "evaluation_human_interruptions: 0",
              `enforcement: ${enforcement}`,
            ].join("\n"),
          },
        ],
      },
    }),
  ];
}

function goalBlockEvents() {
  return [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_block",
            input: {
              command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step block --ledger ${goalLedger} --kind decision --operation migration-policy --retry forbidden --waiver forbidden`,
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
            tool_use_id: "toolu_block",
            content:
              "format\\tdarrow-goal-step-v1\\nstep\\tblock\\nstatus\\trecorded",
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

function goalResult(
  toolUseId: string,
  agentId: string,
  childResult = "private child result",
) {
  return {
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: [
            { type: "text", text: childResult },
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

test("builds one named Claude session and one exact resume", () => {
  const initial = claudeArgv("first", "claude-sonnet-5", "medium", {
    session: { mode: "start", id: "session-123" },
  });
  expect(initial).toContain("--session-id");
  expect(initial).toContain("session-123");
  const resumed = claudeArgv("answer", "claude-sonnet-5", "medium", {
    session: { mode: "resume", id: "session-123" },
  });
  expect(resumed).toContain("--resume");
  expect(resumed).toContain("session-123");
  expect(resumed).not.toContain("--session-id");
});

test("retains file-backed goal evidence while a blocked report is resumable", () => {
  expect(goalReportRequiresObjectiveRelease("blocked")).toBe(false);
  expect(goalReportRequiresObjectiveRelease("complete")).toBe(true);
  expect(goalReportRequiresObjectiveRelease("launch-required")).toBe(true);
  expect(goalReportRequiresObjectiveRelease(undefined)).toBe(true);
});

test("loads the eval-only source plugin when one is mounted", () => {
  const argv = claudeArgv("Run the case.", "claude-sonnet-5", "medium", {
    pluginDir: "/tmp/eval-plugin",
  });
  expect(argv).toContain("--plugin-dir");
  expect(argv[argv.indexOf("--plugin-dir") + 1]).toBe("/tmp/eval-plugin");
  expect(
    argv.slice(
      argv.indexOf("--output-format"),
      argv.indexOf("--output-format") + 2,
    ),
  ).toEqual(["--output-format", "stream-json"]);
  expect(argv).toContain("--verbose");
  expect(argv).not.toContain("--no-session-persistence");
});

test("disallows scheduler tools for adaptive-goal evaluations", () => {
  const goalArgv = claudeArgv(
    "/adaptive-goal Implement the request.",
    "claude-sonnet-5",
    "medium",
  );
  expect(goalArgv.slice(goalArgv.indexOf("--disallowed-tools"))).toEqual([
    "--disallowed-tools",
    "ScheduleWakeup",
  ]);

  const ordinaryArgv = claudeArgv(
    "Implement the request.",
    "claude-sonnet-5",
    "medium",
  );
  expect(ordinaryArgv).not.toContain("--disallowed-tools");
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
      "materializations=1; goal_completions=1; route_observations=0; parent_operations=after:report-missing",
    );
  });

  test("retains only helper-rendered goal report provenance", () => {
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
          ],
        },
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal")),
      ...goalReportEvents("helper"),
    ].join("\n");
    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).toContain(
      '"type":"darrow.goal_report_rendered","status":"complete","enforcement":"helper"',
    );
    expect(retained).not.toContain('"operation":"report-missing"');
    expect(retained).not.toContain("darrow-native-goal-report-v1");
  });

  test("accepts a state-bound blocker before a resumable blocked report", () => {
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
          ],
        },
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal")),
      ...goalBlockEvents(),
      ...goalReportEvents("helper", "blocked"),
    ].join("\n");
    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).toContain(
      '"type":"darrow.goal_report_rendered","status":"blocked"',
    );
    expect(retained).not.toContain('"operation":"bash"');
    expect(retained).not.toContain('"operation":"report-missing"');
  });

  test("resumes one blocked Agent session without creating another goal owner", () => {
    const acquiredResponseEvents = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              id: "toolu_answer",
              input: { command: "decisionctl answer migration-policy" },
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
              tool_use_id: "toolu_answer",
              content: "Use the strict migration policy.",
            },
          ],
        },
      }),
    ];
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
          ],
        },
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal")),
      ...goalBlockEvents(),
      ...goalReportEvents("helper", "blocked", "toolu_blocked_report"),
      ...acquiredResponseEvents,
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "SendMessage",
              id: "toolu_goal_resume",
              input: {
                to: "agentgoal",
                summary: "Resume blocked adaptive goal with user response",
                message:
                  "- phase: blocked-goal-response\nUse the strict migration policy.",
                type: "message",
                recipient: "agentgoal",
                content: "Use the strict migration policy.",
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
              tool_use_id: "toolu_goal_resume",
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    resumedAgentId: "agentgoal",
                  }),
                },
              ],
            },
          ],
        },
      }),
      JSON.stringify({
        type: "system",
        subtype: "task_notification",
        task_id: "agentgoal",
        tool_use_id: "toolu_goal_resume",
        status: "completed",
      }),
      ...goalReportEvents("helper", "complete", "toolu_complete_report"),
    ].join("\n");
    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    const records = retained.split("\n").map((line) => JSON.parse(line));

    expect(
      records.filter(
        (record) => record.type === "darrow.goal_agent_completion",
      ),
    ).toHaveLength(1);
    expect(
      records.filter(
        (record) => record.type === "darrow.goal_objective_materialization",
      ),
    ).toHaveLength(1);
    expect(
      records.filter(
        (record) => record.type === "darrow.goal_agent_resumption",
      ),
    ).toEqual([
      expect.objectContaining({
        goal_tool_use_id: "toolu_goal",
        agent_id: "agentgoal",
        status: "completed",
        same_owner: true,
      }),
    ]);
    expect(
      records.filter(
        (record) => record.type === "darrow.blocked_goal_response_acquired",
      ),
    ).toEqual([
      expect.objectContaining({
        mode: "answer",
        operation: "migration-policy",
        status: "completed",
      }),
    ]);
    expect(
      records
        .filter((record) => record.type === "darrow.goal_report_rendered")
        .map((record) => record.status),
    ).toEqual(["blocked", "complete"]);
    expect(claudeParentLifecycleOperations(retained)).toEqual([]);

    const reorderedBlock = retainedClaudeEvidence(
      stream.replace(
        "--kind decision --operation migration-policy --retry forbidden --waiver forbidden",
        "--operation migration-policy --waiver forbidden --kind decision --retry forbidden",
      ),
      undefined,
      routeEvidenceContext,
    );
    expect(reorderedBlock).toContain(
      '"type":"darrow.blocked_goal_response_acquired","mode":"answer","operation":"migration-policy","status":"completed"',
    );
    expect(claudeParentLifecycleOperations(reorderedBlock)).toEqual([]);

    const resumePrompt =
      "- phase: blocked-goal-response\nUse the strict migration policy.";
    const appendedPrompt = `${resumePrompt}\nDo unrelated work.`;
    const appended = retainedClaudeEvidence(
      stream.replace(
        JSON.stringify(resumePrompt),
        JSON.stringify(appendedPrompt),
      ),
      undefined,
      routeEvidenceContext,
    );
    expect(appended).not.toContain('"type":"darrow.goal_agent_resumption"');

    const replacement = retainedClaudeEvidence(
      stream.replace(
        '\\"resumedAgentId\\":\\"agentgoal\\"',
        '\\"resumedAgentId\\":\\"replacement\\"',
      ),
      undefined,
      routeEvidenceContext,
    );
    expect(replacement).toContain(
      '"observed_agent_id":"replacement","status":"failed","same_owner":false',
    );
    expect(
      replacement
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((record) => record.type === "darrow.goal_report_rendered")
        .map((record) => record.status),
    ).toEqual(["blocked"]);

    const dispatchFailure = retainedClaudeEvidence(
      stream.replace('\\"success\\":true', '\\"success\\":false'),
      undefined,
      routeEvidenceContext,
    );
    expect(dispatchFailure).toContain('"status":"failed","same_owner":false');
    expect(
      dispatchFailure
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((record) => record.type === "darrow.goal_report_rendered")
        .map((record) => record.status),
    ).toEqual(["blocked"]);

    const notificationMismatch = retainedClaudeEvidence(
      stream.replace('"task_id":"agentgoal"', '"task_id":"replacement"'),
      undefined,
      routeEvidenceContext,
    );
    expect(notificationMismatch).toContain(
      '"observed_agent_id":"replacement","status":"failed","same_owner":false',
    );
    expect(
      notificationMismatch
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((record) => record.type === "darrow.goal_report_rendered")
        .map((record) => record.status),
    ).toEqual(["blocked"]);

    const directResponseEvent = JSON.stringify({
      type: "user",
      message: {
        content: [{ type: "text", text: "Use the strict migration policy." }],
      },
    });
    const directResponse = retainedClaudeEvidence(
      stream.replace(acquiredResponseEvents.join("\n"), directResponseEvent),
      undefined,
      routeEvidenceContext,
    );
    expect(directResponse).toContain('"type":"darrow.goal_agent_resumption"');
    expect(directResponse).not.toContain(
      '"type":"darrow.blocked_goal_response_acquired"',
    );
  });

  test("relays a later human-feedback answer to the retained Agent", () => {
    const feedbackResult = [
      "- phase: human-feedback-request",
      "Which migration policy should this delivery use?",
    ].join("\n");
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
          ],
        },
      }),
      JSON.stringify(goalResult("toolu_goal", "agentgoal", feedbackResult)),
      JSON.stringify({
        type: "darrow.eval.follow_up_turn",
        thread_id: "session-123",
      }),
      JSON.stringify({
        type: "user",
        message: {
          content: [{ type: "text", text: "Use the strict migration policy." }],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "SendMessage",
              id: "toolu_goal_feedback",
              input: {
                to: "agentgoal",
                summary: "Resume adaptive goal with human feedback",
                message:
                  "- phase: human-feedback-response\nUse the strict migration policy.",
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
              tool_use_id: "toolu_goal_feedback",
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    resumedAgentId: "agentgoal",
                  }),
                },
              ],
            },
          ],
        },
      }),
      JSON.stringify({
        type: "system",
        subtype: "task_notification",
        task_id: "agentgoal",
        tool_use_id: "toolu_goal_feedback",
        status: "completed",
      }),
      ...goalReportEvents("helper", "complete", "toolu_complete_report"),
    ].join("\n");
    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    const records = retained.split("\n").map((line) => JSON.parse(line));

    expect(records).toContainEqual(
      expect.objectContaining({
        type: "darrow.eval.follow_up_turn",
        thread_id: "session-123",
      }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({
        type: "darrow.human_feedback_relay",
        answer: "Use the strict migration policy.",
        agent_id: "agentgoal",
        same_owner: true,
      }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({
        type: "darrow.goal_agent_resumption",
        status: "completed",
        same_owner: true,
      }),
    );
    const noEchoStream = stream
      .split("\n")
      .filter((line) => {
        const event = JSON.parse(line);
        return !(
          event.type === "user" &&
          event.message?.content?.length === 1 &&
          event.message.content[0]?.type === "text" &&
          event.message.content[0]?.text === "Use the strict migration policy."
        );
      })
      .join("\n");
    const contextBoundAnswer = retainedClaudeEvidence(noEchoStream, undefined, {
      ...routeEvidenceContext,
      followUpPrompt: "Use the strict migration policy.",
    });
    expect(contextBoundAnswer).toContain(
      '"type":"darrow.human_feedback_relay"',
    );
    expect(contextBoundAnswer).toContain(
      '"type":"darrow.goal_agent_resumption"',
    );
    expect(claudeParentLifecycleOperations(retained)).toEqual([]);
    expect(retained).not.toContain('"operation":"report-missing"');

    const wrongSummary = retainedClaudeEvidence(
      stream.replace(
        "Resume adaptive goal with human feedback",
        "Resume blocked adaptive goal with user response",
      ),
      undefined,
      routeEvidenceContext,
    );
    expect(wrongSummary).not.toContain('"type":"darrow.human_feedback_relay"');
    expect(claudeParentLifecycleOperations(wrongSummary)).toContain(
      "after:sendmessage-summary-invalid",
    );

    const duplicateRelay = retainedClaudeEvidence(
      [
        stream,
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                name: "SendMessage",
                id: "toolu_duplicate_feedback",
                input: {
                  to: "agentgoal",
                  summary: "Resume adaptive goal with human feedback",
                  message:
                    "- phase: human-feedback-response\nUse the strict migration policy.",
                },
              },
            ],
          },
        }),
      ].join("\n"),
      undefined,
      routeEvidenceContext,
    );
    expect(claudeParentLifecycleOperations(duplicateRelay)).toContain(
      "after:sendmessage-state",
    );

    for (const malformed of [
      "Context first\n- phase: human-feedback-request\nWhich policy?",
      "- phase: human-feedback-request",
      "- phase: human-feedback-request\n   \n",
    ]) {
      const malformedEvents = stream.split("\n").map(
        (line) =>
          JSON.parse(line) as {
            message?: {
              content?: Array<{ content?: Array<{ text?: string }> }>;
            };
          },
      );
      const malformedGoalBlock = malformedEvents
        .flatMap((event) => event.message?.content ?? [])
        .find((block) =>
          Array.isArray(block.content)
            ? block.content.some((item) => item.text === feedbackResult)
            : false,
        );
      const malformedGoalText = malformedGoalBlock?.content?.find(
        (item) => item.text === feedbackResult,
      );
      if (!malformedGoalText)
        throw new Error("missing feedback result fixture");
      malformedGoalText.text = malformed;
      const malformedStream = malformedEvents
        .map((event) => JSON.stringify(event))
        .join("\n");
      const malformedEvidence = retainedClaudeEvidence(
        malformedStream,
        undefined,
        routeEvidenceContext,
      );
      expect(malformedEvidence).not.toContain(
        '"type":"darrow.human_feedback_relay"',
      );
      expect(claudeParentLifecycleOperations(malformedEvidence)).toContain(
        "after:sendmessage-state",
      );
    }
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
    expect(claudeParentLifecycleOperations(retained)).toEqual([
      "after:report-missing",
    ]);
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
      materialization[3]!,
      materialization[4]!,
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            JSON.parse(materialization[5]!).message.content[0],
            JSON.parse(goalCall(boundGoalPrompt())).message.content[0],
          ],
        },
      }),
      materialization[6]!,
      materialization[7]!,
      materialization[8]!,
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
      ...materialization.map((event, index) =>
        index === 4 ? event.replace(objectiveDigest, fileBackedDigest) : event,
      ),
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
      "after:report-missing",
    ]);
    const wrongMaterialization = materialization[5]!
      .replace("toolu_materialize", "toolu_wrong_materialize")
      .replace("/tmp/darrow-goal-stage.fixture/goal.md", "/tmp/other.md");
    const duplicateMaterialization = materialization[5]!.replace(
      "toolu_materialize",
      "toolu_duplicate_materialize",
    );
    const materializationMisuse = [
      ...preflight,
      materialization[0]!,
      materialization[1]!,
      materialization[2]!,
      materialization[3]!,
      materialization[4]!,
      wrongMaterialization,
      materialization[5]!,
      materialization[6]!,
      materialization[7]!,
      materialization[8]!,
      duplicateMaterialization,
      materialization[9]!,
      materialization[10]!,
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
      ...materialization.slice(0, 7),
      goalCall(boundGoalPrompt()),
      completion,
    ].join("\n");
    const failedCleanupResult = JSON.stringify({
      ...JSON.parse(materialization[8]!),
      message: {
        content: [
          {
            ...JSON.parse(materialization[8]!).message.content[0],
            is_error: true,
          },
        ],
      },
    });
    const failedStagingCleanup = [
      ...preflight,
      ...materialization.slice(0, 8),
      failedCleanupResult,
      goalCall(boundGoalPrompt()),
      completion,
    ].join("\n");
    for (const stream of [missingStagingCleanup, failedStagingCleanup])
      expect(
        retainedClaudeEvidence(stream, undefined, routeEvidenceContext),
      ).not.toContain("darrow.goal_agent_completion");
    const duplicateCleanup = materialization[7]!.replace(
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
        input: {
          file_path: "/tmp/darrow-goal-stage.fixture/goal.md",
          content: objectiveContract,
        },
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

  test("accepts the exact decision-gated route and terminal helper report", () => {
    const ledger = "/tmp/darrow-goal-run.fixture";
    const routeId = "toolu_decision_route";
    const reportId = "toolu_decision_report";
    const route = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: routeId,
            input: {
              command: `/bin/bash ${routeEvidenceContext.pluginDir}/bin/goal-loop step route --ledger ${ledger} --workflow decision-gated --risk high --profile none --verification-gate not-applicable --readiness omitted --review omitted`,
            },
          },
        ],
      },
    });
    const routeResult = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: routeId,
            content: [
              "format\tdarrow-goal-step-v1",
              `ledger\t${ledger}`,
              "step\troute",
              "status\trecorded",
              "workflow\tdecision-gated",
              "risk\thigh",
              "profile\tnone",
              "verification_gate\tnot-applicable",
              "review_selection\tomitted",
              "selected_route\tnone",
              "route_source\tnone",
            ].join("\n"),
          },
        ],
      },
    });
    const report = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: reportId,
            input: {
              command: `/bin/bash ${routeEvidenceContext.pluginDir}/bin/goal-loop step report --ledger ${ledger} --status launch-required --human-interruptions 1`,
            },
          },
        ],
      },
    });
    const reportResult = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: reportId,
            content: [
              "format: darrow-native-goal-report-v1",
              "workflow: decision-gated",
              "risk: high",
              "profile: none",
              "harness: none",
              "model: none > none",
              "effort: none",
              "route_applied_by: none",
              "route_verified: false",
              "launch_boundary: launch_required",
              "verification_gate: not-applicable",
              "evaluation_child_invocations: 0",
              "evaluation_human_interruptions: 1",
              "enforcement: helper",
            ].join("\n"),
          },
        ],
      },
    });
    const retained = retainedClaudeEvidence(
      [
        ...validClaudePreflightEvents().slice(0, 4),
        route,
        routeResult,
        report,
        reportResult,
      ].join("\n"),
      undefined,
      routeEvidenceContext,
    );
    expect(claudeParentLifecycleOperations(retained)).toEqual([]);
    expect(retained).toContain('"type":"darrow.goal_report_rendered"');
  });

  test("rejects materialization before runner resolution", () => {
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
    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(retained).not.toContain("darrow.goal_agent_completion");
    expect(retained).toContain("darrow.parent_repository_tool_before_goal");
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

  test("does not report hook-denied tool attempts as performed parent work", () => {
    const call = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_denied",
            input: { command: "git status --short" },
          },
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_failed",
            input: { command: "git diff --stat" },
          },
        ],
      },
    });
    const results = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_denied",
            is_error: false,
            content:
              "PreToolUse:Bash hook error: darrow goal hook: tool use is reserved for the routed goal owner",
          },
          {
            type: "tool_result",
            tool_use_id: "toolu_failed",
            is_error: true,
            content: "fatal: ordinary command failure",
          },
        ],
      },
    });
    expect(retainedClaudeEvidence([call, results].join("\n"))).not.toContain(
      '"operation":"git-status"',
    );
    expect(retainedClaudeEvidence([call, results].join("\n"))).toContain(
      '"operation":"git-diff"',
    );
  });

  test("accepts helper-owned staging without the optional temporary-root probe", () => {
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
            input: {
              file_path: "/tmp/darrow-goal-stage.fixture/goal.md",
              content: objectiveContract,
            },
          },
        ],
      },
    });
    const preflight = validClaudePreflightEvents().join("\n");
    for (const stream of [
      [preflight, write].join("\n"),
      [preflight, probe(), result(), write].join("\n"),
      [preflight, probe(), result(true), write].join("\n"),
    ])
      expect(
        retainedClaudeEvidence(stream, undefined, routeEvidenceContext),
      ).not.toContain("darrow.parent_repository_tool_before_goal");

    for (const stream of [
      [
        preflight,
        probe(),
        result(),
        probe("toolu_duplicate_probe"),
        write,
      ].join("\n"),
      [preflight, probe("toolu_tmpdir", "printenv HOME"), result(), write].join(
        "\n",
      ),
    ])
      expect(
        retainedClaudeEvidence(stream, undefined, routeEvidenceContext),
      ).toContain("darrow.parent_repository_tool_before_goal");
  });

  test("permits one exact provisional activation before the foreground owner", () => {
    const activation = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_activate",
            input: {
              command:
                `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step activate --ledger ${goalLedger} ` +
                "--applied-by native-subagent --boundary native_subagent --agent-id pending " +
                "--effective-route 'claude|anthropic|claude-sonnet-5|low' --route-verified false",
            },
          },
        ],
      },
    });
    const activationResult = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_activate",
            content: [
              "format\tdarrow-goal-step-v1",
              "run_id\tfixture",
              `ledger\t${goalLedger}`,
              "step\tactivate",
              "status\trecorded",
              "agent_id\tpending",
              "effective_route\tclaude|anthropic|claude-sonnet-5|low",
              "route_verified\tfalse",
              "enforcement\thelper",
            ].join("\n"),
          },
        ],
      },
    });
    const stream = [
      ...validClaudePreflightEvents(),
      ...inlineMaterializationEvents(false),
      activation,
      activationResult,
      activation,
    ].join("\n");
    const retained = retainedClaudeEvidence(
      stream,
      undefined,
      routeEvidenceContext,
    );
    expect(
      retained
        .split("\n")
        .filter((line) =>
          line.includes("darrow.parent_repository_tool_before_goal"),
        ),
    ).toHaveLength(1);

    const goalCall = JSON.stringify({
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
    });
    const failedActivation = JSON.parse(activationResult);
    failedActivation.message.content[0].is_error = true;
    const completion = JSON.stringify(goalResult("toolu_goal", "agentgoal"));
    for (const rejected of [
      [
        ...validClaudePreflightEvents(),
        ...inlineMaterializationEvents(false),
        goalCall,
        completion,
      ],
      [
        ...validClaudePreflightEvents(),
        ...inlineMaterializationEvents(false),
        activation,
        JSON.stringify(failedActivation),
        goalCall,
        completion,
      ],
    ])
      expect(
        retainedClaudeEvidence(
          rejected.join("\n"),
          undefined,
          routeEvidenceContext,
        ),
      ).not.toContain("darrow.goal_agent_completion");
  });

  test("binds one Write to the helper-owned path after staging release", () => {
    const root = mkdtempSync(join(tmpdir(), "darrow-claude-staging-"));
    const repo = join(root, "repo");
    const staging = join(root, "staging");
    const alias = join(root, "repo-alias");
    mkdirSync(repo);
    mkdirSync(staging);
    const canonicalStaging = realpathSync(staging);
    const goalStaging = join(canonicalStaging, "darrow-goal-stage.fixture");
    mkdirSync(goalStaging);
    symlinkSync(repo, alias, "dir");
    try {
      const context = {
        ...routeEvidenceContext,
        repoDir: repo,
        stagingRoot: canonicalStaging,
      };
      const aliasGoalStaging = goalStaging.replace(/^\/private/, "");
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
                  file_path: join(aliasGoalStaging, "goal.md"),
                  content: objectiveContract,
                },
              },
              {
                type: "tool_use",
                name: "Write",
                id: "toolu_extra_stage",
                input: {
                  file_path: join(aliasGoalStaging, "extra.md"),
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
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                name: "Bash",
                id: "toolu_register_alias_stage",
                input: {
                  command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step stage --ledger ${context.stagingRoot}/darrow-goal-run.fixture --goal-file ${join(aliasGoalStaging, "goal.md")}`,
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
                tool_use_id: "toolu_register_alias_stage",
                content: [
                  "format\tdarrow-goal-step-v1",
                  "run_id\tfixture",
                  `ledger\t${context.stagingRoot}/darrow-goal-run.fixture`,
                  "step\tstage",
                  "status\trecorded",
                  `goal_file\t${join(aliasGoalStaging, "goal.md")}`,
                  `contract_sha256\t${objectiveDigest}`,
                ].join("\n"),
              },
            ],
          },
        }),
      ].join("\n");
      rmSync(goalStaging, { recursive: true, force: true });
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
        file_path: "/tmp/darrow-goal-stage.fixture/goal.md",
        content: fileBackedContract,
      }),
      assistantTool("toolu_register_stage", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step stage --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md`,
      }),
      toolResult(
        "toolu_register_stage",
        `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\tstage\nstatus\trecorded\ngoal_file\t/tmp/darrow-goal-stage.fixture/goal.md\ncontract_sha256\t${fileBackedDigest}`,
      ),
      assistantTool("toolu_materialize", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step materialize --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md --expected-sha256 ${fileBackedDigest}`,
      }),
      toolResult(
        "toolu_materialize",
        `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\tmaterialize\nstatus\trecorded\nformat\tdarrow-native-goal-objective-v1\nmode\tfile-backed\ncontract_bytes\t5000\ncontract_sha256\t${fileBackedDigest}\ncontract_file\t/private/darrow-goal-contract.fixture/goal-contract.md\nobjective_bytes\t300\nobjective_file\t/private/darrow-goal-contract.fixture/goal-objective.txt\nattachment_dir\t/private/darrow-goal-contract.fixture`,
      ),
      assistantTool("toolu_release_staging", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step release-staging --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md --expected-sha256 ${fileBackedDigest}`,
      }),
      toolResult(
        "toolu_release_staging",
        `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\trelease-staging\nstatus\trecorded\nformat\tdarrow-native-goal-staging-release-v1\nstatus\treleased\ngoal_file\t/tmp/darrow-goal-stage.fixture/goal.md`,
      ),
      ...provisionalActivationEvents(),
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
        command: `/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low' --ledger ${goalLedger}`,
      }),
      toolResult(
        "toolu_gate",
        "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobserved_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\nconfirmation\tconfirmed",
      ),
      assistantTool("toolu_release", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step release-objective --ledger ${goalLedger} --attachment-dir /private/darrow-goal-contract.fixture --expected-sha256 ${fileBackedDigest}`,
      }),
      toolResult(
        "toolu_release",
        `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\trelease-objective\nstatus\trecorded\nformat\tdarrow-native-goal-objective-release-v1\nstatus\treleased\nattachment_dir\t/private/darrow-goal-contract.fixture`,
      ),
      assistantTool("toolu_release_again", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step release-objective --ledger ${goalLedger} --attachment-dir /private/darrow-goal-contract.fixture --expected-sha256 ${fileBackedDigest}`,
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
    ).toHaveLength(10);
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
    expect(appendedTextEvidence).not.toContain("darrow.goal_agent_completion");
    expect(appendedTextEvidence).toContain("agent-contract-body-mismatch");
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
                file_path: "/tmp/darrow-goal-stage.fixture/goal.md",
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
              id: "toolu_register_stage",
              input: {
                command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step stage --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md`,
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
              tool_use_id: "toolu_register_stage",
              content: `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\tstage\nstatus\trecorded\ngoal_file\t/tmp/darrow-goal-stage.fixture/goal.md\ncontract_sha256\t${objectiveDigest}`,
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
                command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step materialize --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md --expected-sha256 ${objectiveDigest}`,
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
              content: `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\tmaterialize\nstatus\trecorded\nformat\tdarrow-native-goal-objective-v1\nmode\tinline\ncontract_bytes\t100\ncontract_sha256\t${objectiveDigest}\ncontract_file\t/tmp/darrow-goal-stage.fixture/goal.md\nobjective_bytes\t100\nobjective_file\t/tmp/darrow-goal-stage.fixture/goal.md\nattachment_dir\tnone`,
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
                command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step release-staging --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md --expected-sha256 ${objectiveDigest}`,
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
              content: `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\trelease-staging\nstatus\trecorded\nformat\tdarrow-native-goal-staging-release-v1\nstatus\treleased\ngoal_file\t/tmp/darrow-goal-stage.fixture/goal.md`,
            },
          ],
        },
      }),
      ...provisionalActivationEvents(),
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
                command: `/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low' --ledger ${goalLedger}`,
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
        file_path: "/tmp/darrow-goal-stage.fixture/goal.md",
        content: fileBackedContract,
      }),
      toolCall("toolu_register_stage", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step stage --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md`,
      }),
      toolResult(
        "toolu_register_stage",
        `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\tstage\nstatus\trecorded\ngoal_file\t/tmp/darrow-goal-stage.fixture/goal.md\ncontract_sha256\t${digest}`,
      ),
      toolCall("toolu_materialize", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step materialize --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md --expected-sha256 ${digest}`,
      }),
      toolResult(
        "toolu_materialize",
        `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\tmaterialize\nstatus\trecorded\nformat\tdarrow-native-goal-objective-v1\nmode\tfile-backed\ncontract_bytes\t5000\ncontract_sha256\t${digest}\ncontract_file\t${attachment}/goal-contract.md\nobjective_bytes\t300\nobjective_file\t${attachment}/goal-objective.txt\nattachment_dir\t${attachment}`,
      ),
      toolCall("toolu_release_staging", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step release-staging --ledger ${goalLedger} --goal-file /tmp/darrow-goal-stage.fixture/goal.md --expected-sha256 ${digest}`,
      }),
      toolResult(
        "toolu_release_staging",
        `format\tdarrow-goal-step-v1\nrun_id\tfixture\nledger\t${goalLedger}\nstep\trelease-staging\nstatus\trecorded\nformat\tdarrow-native-goal-staging-release-v1\nstatus\treleased\ngoal_file\t/tmp/darrow-goal-stage.fixture/goal.md`,
      ),
      ...provisionalActivationEvents().map((line) => JSON.parse(line)),
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
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step release-objective --ledger ${goalLedger} --attachment-dir /private/darrow-goal-contract.wrong --expected-sha256 ${digest}`,
      }),
      toolResult("toolu_wrong_release", "private wrong release"),
      toolCall("toolu_failed_release", "Bash", {
        command: `/bin/bash /plugin/darrow-goal-loop/bin/goal-loop step release-objective --ledger ${goalLedger} --attachment-dir ${attachment} --expected-sha256 ${digest}`,
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
    expect(retained).toContain(
      '"operation":"goal-loop-unbound-release-objective"',
    );
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
        `/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id otheragent --selected 'claude|anthropic|claude-sonnet-5|low' --ledger ${goalLedger}`,
      ),
      result(
        "toolu_wrong_agent",
        "format\tdarrow-claude-route-gate-v1\nagent_id\totheragent\nobservation\tunavailable",
      ),
      bashCall(
        "toolu_wrong_route",
        `/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-opus-5|high' --ledger ${goalLedger}`,
      ),
      result(
        "toolu_wrong_route",
        "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobservation\tunavailable",
      ),
      bashCall(
        "toolu_wrong_output",
        `/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low' --ledger ${goalLedger}`,
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
        `/bin/bash /tmp/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low' --ledger ${goalLedger}`,
      ),
      result(
        "toolu_fake_path",
        "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobserved_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\nconfirmation\tconfirmed",
      ),
      bashCall(
        "toolu_wrong_repo",
        `/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /other --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low' --ledger ${goalLedger}`,
      ),
      result(
        "toolu_wrong_repo",
        "format\tdarrow-claude-route-gate-v1\nagent_id\tagentgoal\nobserved_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\nconfirmation\tconfirmed",
      ),
      bashCall(
        "toolu_retry",
        `/bin/bash /plugin/darrow-goal-loop/bin/claude-route-gate --repo /fixture --agent-id agentgoal --selected 'claude|anthropic|claude-sonnet-5|low' --ledger ${goalLedger}`,
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
    ).toHaveLength(8);
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
