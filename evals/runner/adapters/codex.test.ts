import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  codexAdapter,
  codexArgv,
  codexEvalSkillsRoot,
  codexExplicitSkillActivation,
  codexResumeArgv,
  codexRunSucceeded,
  codexSkillActivation,
  codexSpawnGuardRequested,
  codexThreadId,
  codexTokenUsage,
  retainedCodexEvidence,
} from "./codex";
import { observeCodexTicketPipelineRoutes } from "../orchestration-metrics";
import {
  fixtureStateFingerprint,
  guardCodexSpawn,
  repositoryFingerprint,
  verifiedCodexAcceptedOwner,
} from "../codex-spawn-guard";

const REPO = "/tmp/eval";
const COMPLETE_CONTRACT = [
  "Role: You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-goal or seek another owner.",
  "Outcome: Implement the requested fixture behavior.",
  "Acceptance criteria: The requested behavior and checks pass.",
  "Scope and authority: included=fixture implementation and tests; authorized=local edits and checks only; forbidden=publication; preserve=unrelated repository state",
  "Execution: workflow=implement-feature; sequence=inspect fixture, implement behavior, run checks; risk=routine; profile=routine; route=codex|openai|gpt-5.6-luna|low; capabilities=none",
  "Verification and gates: readiness=not required; review=not required; focused=run the focused test; final=run the repository gate; feedback=return the smallest complete question; blockers=return concrete evidence and the smallest next action",
  "Completion evidence: report status, files, checks, and remaining risks.",
].join("\n");

test("uses Terra as the default Codex eval model", () => {
  expect(codexAdapter.defaultModel).toBe("gpt-5.6-terra");
});

test("installs the adaptive-goal spawn guard only for relevant turns", () => {
  expect(
    codexSpawnGuardRequested("Implement the bounded refactor."),
  ).toBeFalse();
  expect(
    codexSpawnGuardRequested("Invoke adaptive-goal for this request."),
  ).toBeTrue();
  expect(
    codexSpawnGuardRequested(
      "Assess the ticket first.",
      "Now invoke adaptive-goal for the unchanged scope.",
    ),
  ).toBeTrue();
});

test("builds one persistent Codex session and one exact follow-up resume", () => {
  const initial = codexArgv({
    repoDir: REPO,
    prompt: "first",
    model: "gpt-5.5",
    effort: "medium",
    persistent: true,
  });
  expect(initial).not.toContain("--ephemeral");
  const resumed = codexResumeArgv({
    repoDir: REPO,
    threadId: "thread-123",
    prompt: "answer",
    model: "gpt-5.5",
    effort: "medium",
  });
  expect(resumed.slice(0, 5)).toEqual([
    "codex",
    "exec",
    "resume",
    "thread-123",
    "answer",
  ]);
  expect(resumed).not.toContain("--ephemeral");
});

test("requires exactly one Codex thread id before resuming", () => {
  expect(
    codexThreadId(
      [
        JSON.stringify({ type: "thread.started", thread_id: "thread-123" }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n"),
    ),
  ).toBe("thread-123");
  expect(
    codexThreadId(
      [
        JSON.stringify({ type: "thread.started", thread_id: "one" }),
        JSON.stringify({ type: "thread.started", thread_id: "two" }),
      ].join("\n"),
    ),
  ).toBeUndefined();
});

test("Codex no-skill control does not require a plugin package", async () => {
  expect(await codexEvalSkillsRoot(REPO, {})).toBe(
    `${REPO}/.git/eval-no-skills`,
  );
});

describe("Codex terminal stream state", () => {
  test("accepts a recovered reconnect error followed by completion", () => {
    const stream = [
      JSON.stringify({ type: "error", message: "Reconnecting..." }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    expect(codexRunSucceeded(0, stream)).toBe(true);
    expect(
      codexRunSucceeded(
        0,
        JSON.stringify({ type: "event_msg", msg: { type: "turn.completed" } }),
      ),
    ).toBe(true);
  });

  test("rejects terminal failure, missing completion, and nonzero exit", () => {
    expect(codexRunSucceeded(0, JSON.stringify({ type: "turn.failed" }))).toBe(
      false,
    );
    expect(
      codexRunSucceeded(
        0,
        [
          JSON.stringify({ type: "turn.completed" }),
          JSON.stringify({ type: "event_msg", msg: { type: "turn.failed" } }),
        ].join("\n"),
      ),
    ).toBe(false);
    expect(codexRunSucceeded(0, JSON.stringify({ type: "error" }))).toBe(false);
    expect(
      codexRunSucceeded(1, JSON.stringify({ type: "turn.completed" })),
    ).toBe(false);
  });
});

describe("Codex token accounting", () => {
  test("uses the last complete cumulative usage report", () => {
    const stream = [
      JSON.stringify({
        type: "turn.started",
        usage: { input_tokens: 3, output_tokens: 2 },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 11, output_tokens: 7 },
      }),
    ].join("\n");
    expect(codexTokenUsage(stream)).toEqual({
      complete: true,
      inputTokens: 11,
      outputTokens: 7,
    });
  });

  test("marks missing, partial, malformed, or invalid usage unknown", () => {
    for (const stream of [
      JSON.stringify({ type: "turn.completed" }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 4 },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: "wrong", output_tokens: 2 },
      }),
      [
        JSON.stringify({
          type: "turn.completed",
          usage: { input_tokens: 4, output_tokens: 2 },
        }),
        '{"type":"event_msg",broken',
      ].join("\n"),
    ]) {
      expect(codexTokenUsage(stream)).toEqual({
        complete: false,
        inputTokens: 0,
        outputTokens: 0,
      });
    }
  });
});

describe("Codex skill activation observation", () => {
  test("uses one explicit host invocation without requiring a skill-file read", () => {
    const stream = JSON.stringify({ type: "turn.completed" });
    expect(
      codexExplicitSkillActivation(
        stream,
        "Use $sample:grilling for this request.",
        {
          mode: "explicit",
          skill: "grilling",
          invocation: "$sample:grilling",
        },
      ),
    ).toEqual({
      source: "explicit_invocation",
      complete: true,
      primarySkill: "grilling",
      observedSkills: ["grilling"],
    });
  });

  test.each([
    [
      "missing token",
      "Use the appropriate skill.",
      '{"type":"turn.completed"}',
    ],
    [
      "duplicated token",
      "Use $sample:grilling, then $sample:grilling again.",
      '{"type":"turn.completed"}',
    ],
    [
      "malformed stream",
      "Use $sample:grilling.",
      '{"type":"item.completed",broken\n{"type":"turn.completed"}',
    ],
    ["failed turn", "Use $sample:grilling.", '{"type":"turn.failed"}'],
  ])("keeps %s explicit evidence unknown", (_label, prompt, stream) => {
    expect(
      codexExplicitSkillActivation(stream, prompt, {
        mode: "explicit",
        skill: "grilling",
        invocation: "$sample:grilling",
      }),
    ).toEqual({
      source: "explicit_invocation",
      complete: false,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("keeps a no-plugin control complete without inventing a project skill", () => {
    const stream = JSON.stringify({ type: "turn.completed" });
    expect(
      codexSkillActivation(stream, REPO, `${REPO}/.git/eval-no-skills`),
    ).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("keeps a missing implicit observation channel unknown", () => {
    expect(codexSkillActivation("", REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: false,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("uses completed mounted SKILL.md reads as an ordered controlled probe", () => {
    const stream = [
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({
        type: "item.started",
        item: {
          type: "command_execution",
          command:
            "sed -n '1,260p' /tmp/eval/.agents/skills/plan-implementation/SKILL.md",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "sed -n '1,260p' /tmp/eval/.agents/skills/plan-implementation/SKILL.md",
          aggregated_output:
            "---\nname: plan-implementation\ndescription: Plan\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            '/bin/zsh -lc "cat /tmp/eval/.agents/skills/grilling/SKILL.md && pwd"',
          aggregated_output: "---\nname: grilling\ndescription: Grill\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "plan-implementation",
      observedSkills: ["plan-implementation", "grilling"],
    });
  });

  test("observes matching mounted skill bodies across Codex read shapes", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "sed -n '1,260p' './.agents/skills/adaptive-goal/SKILL.md'",
          aggregated_output:
            "---\nname: adaptive-goal\ndescription: Orchestrate\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "/bin/zsh -lc \"lean-ctx -c 'sed -n 1,260p /tmp/eval/.agents/skills/grilling/SKILL.md'\"",
          aggregated_output: "---\nname: grilling\ndescription: Grill\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "adaptive-goal",
      observedSkills: ["adaptive-goal", "grilling"],
    });
  });

  test("observes canonical skill reads from an installed plugin cache", () => {
    const skillsRoot =
      "/tmp/eval-home/plugins/cache/darrow/darrow-discovery/0.1.0/skills";
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${skillsRoot}/plan-implementation/SKILL.md`,
          aggregated_output:
            "---\nname: plan-implementation\ndescription: Plan\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${skillsRoot}/grilling/SKILL.md`,
          aggregated_output: "---\nname: grilling\ndescription: Grill\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, skillsRoot)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "plan-implementation",
      observedSkills: ["plan-implementation", "grilling"],
    });
  });

  test("observes repository-relative reads from an installed plugin cache", () => {
    const skillsRoot = join(
      REPO,
      ".git/darrow-eval/state/codex/config/plugins/cache/darrow-eval/darrow-tickets/0.2.3/skills",
    );
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "sed -n '1,240p' .git/darrow-eval/state/codex/config/plugins/cache/darrow-eval/darrow-tickets/0.2.3/skills/list-tickets/SKILL.md",
          aggregated_output:
            "---\nname: list-tickets\ndescription: List tickets\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, skillsRoot)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "list-tickets",
      observedSkills: ["list-tickets"],
    });
    expect(
      retainedCodexEvidence(stream, REPO, undefined, skillsRoot),
    ).toContain('"skill":"list-tickets"');
  });

  test("observes project capability reads alongside an installed orchestrator", () => {
    const installedSkillsRoot =
      "/tmp/eval-home/plugins/cache/darrow/darrow-goal-loop/0.13.0/skills";
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${installedSkillsRoot}/adaptive-goal/SKILL.md`,
          aggregated_output:
            "---\nname: adaptive-goal\ndescription: Orchestrate\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command:
            "cat /tmp/eval/.agents/skills/assess-implementation-readiness/SKILL.md",
          aggregated_output:
            "---\nname: assess-implementation-readiness\ndescription: Assess\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, installedSkillsRoot)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "adaptive-goal",
      observedSkills: ["adaptive-goal", "assess-implementation-readiness"],
    });
    expect(
      retainedCodexEvidence(stream, REPO, undefined, installedSkillsRoot),
    ).toContain('"skill":"assess-implementation-readiness"');
  });

  test("observes skills from independently installed composition plugins", () => {
    const recipeRoot =
      "/tmp/eval-home/plugins/cache/darrow/recipe/0.3.0/skills";
    const goalRoot =
      "/tmp/eval-home/plugins/cache/darrow/darrow-goal-loop/0.13.1/skills";
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${recipeRoot}/ticket-to-pr/SKILL.md`,
          aggregated_output: "---\nname: ticket-to-pr\ndescription: Recipe\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${goalRoot}/adaptive-goal/SKILL.md`,
          aggregated_output: "---\nname: adaptive-goal\ndescription: Goal\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, [recipeRoot, goalRoot])).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "ticket-to-pr",
      observedSkills: ["ticket-to-pr", "adaptive-goal"],
    });
  });

  test("observes every installed skill read in one compound command", () => {
    const skillsRoot =
      "/tmp/eval-home/plugins/cache/darrow/darrow-discovery/0.1.0/skills";
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: `cat ${skillsRoot}/plan-implementation/SKILL.md && cat ${skillsRoot}/grilling/SKILL.md`,
          aggregated_output: [
            "---\nname: plan-implementation\ndescription: Plan\n",
            "---\nname: grilling\ndescription: Grill\n",
          ].join(""),
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO, skillsRoot)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: "plan-implementation",
      observedSkills: ["plan-implementation", "grilling"],
    });
  });

  test("does not treat a path existence check as reading a skill body", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "test -f /tmp/eval/.agents/skills/grilling/SKILL.md",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("marks a malformed JSON event channel incomplete", () => {
    const stream = [
      "ordinary CLI noise",
      '{"type":"item.completed",broken',
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: false,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("keeps the observation channel complete after an ordinary failed command", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "rg missing file",
          aggregated_output: "file: No such file\n",
          exit_code: 2,
          status: "failed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    expect(codexSkillActivation(stream, REPO).complete).toBe(true);
  });

  test("keeps ambiguous implicit command evidence unknown", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "cat /tmp/eval/.agents/skills/grilling/SKILL.md",
          aggregated_output: "---\nname: grilling\ndescription: Grill\n",
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: false,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("ignores decoy skill paths outside the mounted fixture root", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "cat /tmp/decoy/.agents/skills/grilling/SKILL.md",
          aggregated_output: "---\nname: grilling\ndescription: Decoy\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    expect(codexSkillActivation(stream, REPO)).toEqual({
      source: "skill_file_read_probe",
      complete: true,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("rejects command-shaped text and reads that return no skill body", () => {
    for (const command of [
      "echo cat /tmp/eval/.agents/skills/grilling/SKILL.md",
      "cat /tmp/eval/.agents/skills/grilling/SKILL.md >/dev/null",
      "head -n 0 /tmp/eval/.agents/skills/grilling/SKILL.md",
    ]) {
      const stream = [
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command,
            aggregated_output: command.startsWith("echo")
              ? "cat /tmp/eval/.agents/skills/grilling/SKILL.md\n"
              : "",
            exit_code: 0,
            status: "completed",
          },
        }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n");

      expect(codexSkillActivation(stream, REPO).primarySkill).toBeNull();
    }
  });

  test("retains bounded probe and accounting records without transcript text", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "sensitive agent narration" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "cat /tmp/eval/.agents/skills/grilling/SKILL.md",
          aggregated_output:
            "---\nname: grilling\ndescription: sensitive skill body\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 10, output_tokens: 2 },
      }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"type":"darrow.skill_read_probe"');
    expect(retained).toContain('"skill":"grilling"');
    expect(retained).toContain('"input_tokens":10');
    expect(retained).not.toContain("sensitive agent narration");
    expect(retained).not.toContain("sensitive skill body");
  });

  test("retains only collaboration fields the live Codex stream exposes", () => {
    const stream = [
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "in_progress",
          sender_thread_id: "parent-thread",
          receiver_thread_ids: ["child-1"],
          model: "gpt-5.6-sol",
          reasoning_effort: "xhigh",
          fork_turns: "none",
          prompt: "- review_axis: standards\nsensitive task context",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "completed",
          receiver_thread_ids: ["child-1"],
          prompt: [
            "sensitive task context",
            "- phase: refine",
            "- iteration: 1",
            "- stable_child_id: refine-1-run",
            "- phase_skill: $refine-ticket",
          ].join("\n"),
        },
      }),
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "in_progress",
          receiver_thread_ids: ["child-2"],
          model: "gpt-5.6-sol",
          reasoning_effort: "xhigh",
          fork_turns: "none",
          prompt:
            "- phase: adaptive-goal-runner\nsensitive copied context\n- phase: confidential-acquisition\n- stable_child_id: patient-123\n- review_axis: spec",
        },
      }),
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "wait_agent",
          status: "in_progress",
          receiver_thread_ids: ["child-1"],
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "feedbackctl answer rounding-mode",
          exit_code: 0,
          status: "completed",
          aggregated_output: "nearest\n",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"type":"item.started"');
    expect(retained).not.toContain('"model":"gpt-5.6-sol"');
    expect(retained).not.toContain('"reasoning_effort":"xhigh"');
    expect(retained).not.toContain('"fork_turns":"none"');
    expect(retained).toContain('"tool":"wait_agent"');
    expect(retained).toContain('"sender_thread_id":"parent-thread"');
    expect(retained).toContain("- review_axis: standards");
    expect(retained).toContain("- phase: adaptive-goal-runner");
    expect(retained).not.toContain("confidential-acquisition");
    expect(retained).not.toContain("patient-123");
    expect(retained).toContain(
      '"type":"darrow.human_feedback_answer","feedback_id":"rounding-mode","status":"completed"',
    );
    expect(retained).not.toContain("nearest");
    expect(retained).not.toContain("- review_axis: spec");
    expect(retained.match(/"tool":"spawn_agent"/g)).toHaveLength(3);
    expect(observeCodexTicketPipelineRoutes(retained)).toEqual([
      {
        phase: "refine",
        iteration: 1,
        childId: "refine-1-run",
        skill: "refine-ticket",
        threadId: "child-1",
      },
    ]);
    expect(retained).not.toContain("sensitive task context");
  });

  test("distinguishes authorized staging from executed parent verification", () => {
    const staging = JSON.stringify({
      type: "item.started",
      item: { id: "stage", type: "file_change", status: "in_progress" },
    });
    const command = (exitCode: number, status: "completed" | "failed") =>
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "test",
          type: "command_execution",
          command: "bash test.sh",
          exit_code: exitCode,
          status,
          aggregated_output: "",
        },
      });
    expect(retainedCodexEvidence(staging, REPO)).not.toContain(
      "darrow.parent_tool_before_goal",
    );
    expect(retainedCodexEvidence(command(0, "completed"), REPO)).toContain(
      '"type":"darrow.parent_tool_before_goal","operation":"verification"',
    );
    expect(retainedCodexEvidence(command(1, "failed"), REPO)).not.toContain(
      "darrow.parent_tool_before_goal",
    );
  });

  test("retains one verified inline owner boundary and post-owner evidence", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-codex-adapter-"));
    const ownerId = "01a04f35-c37a-74b3-baa4-961bc21b6f49";
    const objectiveRoot = await mkdtemp(
      join(tmpdir(), "darrow-codex-objective-"),
    );
    try {
      await writeFile(join(repo, "fixture.txt"), "base\n");
      await mkdir(join(repo, ".git"));
      const policy = {
        secret: "secret",
        baselineSha256: await repositoryFingerprint(repo),
        fixtureStateSha256: await fixtureStateFingerprint(repo),
        requestSha256: "4".repeat(64),
        objectiveRoot,
        goalLoopPath: "/plugin/bin/goal-loop",
        statePath: join(repo, ".git", "guard-state"),
      };
      const hook = {
        hook_event_name: "PreToolUse",
        tool_use_id: "owner-tool-use",
        turn_id: "parent-turn",
        cwd: repo,
        tool_name: "Agent",
        tool_input: {
          task_name: "adaptive_goal_fixture",
          message: "- phase: adaptive-goal-owner\n" + COMPLETE_CONTRACT,
          model: "gpt-5.6-luna",
          reasoning_effort: "low",
          fork_turns: "none",
        },
      };
      const guarded = await guardCodexSpawn(hook, policy);
      const prompt = (
        guarded?.hookSpecificOutput as {
          updatedInput: { message: string };
        }
      ).updatedInput.message;
      const acceptedOwner = await verifiedCodexAcceptedOwner(
        policy.statePath,
        policy.secret,
        ownerId,
      );

      const spawnItem = {
        id: "spawn-1",
        type: "collab_tool_call",
        tool: "spawn_agent",
        status: "completed",
        sender_thread_id: "parent-thread",
        receiver_thread_ids: [ownerId],
        prompt,
      };
      const stream = [
        JSON.stringify({ type: "item.completed", item: spawnItem }),
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "wait-1",
            type: "collab_tool_call",
            tool: "wait_agent",
            status: "completed",
            receiver_thread_ids: [ownerId],
          },
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "non-tool-error",
            type: "error",
            message: "transient host notice",
          },
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "parent-command",
            type: "command_execution",
            command: "bash test.sh",
            exit_code: 0,
            status: "completed",
            aggregated_output: "",
          },
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "feedback-answer",
            type: "command_execution",
            command: "feedbackctl answer rounding-mode",
            exit_code: 0,
            status: "completed",
            aggregated_output: "nearest\n",
          },
        }),
      ].join("\n");
      const retained = retainedCodexEvidence(stream, repo, {
        exitCode: 0,
        stderrPresent: false,
        spawnGuardSecret: "secret",
        acceptedAgentRef: ownerId,
        acceptedOwner,
      });
      expect(retained).toContain("- phase: adaptive-goal-owner");
      expect(retained).toContain('"tool":"wait_agent"');
      expect(retained).toContain('"type":"darrow.parent_tool_after_goal"');
      expect(retained.match(/darrow\.parent_tool_after_goal/g)).toHaveLength(1);
      expect(retained).toContain('"type":"darrow.human_feedback_answer"');
      expect(retained).not.toContain("goal_spawn_attestation");
      expect(retained).toContain('"type":"darrow.goal_owner_accepted"');
      expect(retained).toContain('"model":"gpt-5.6-luna"');
      expect(retained).not.toContain(
        "Implement the requested fixture behavior",
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("keeps same-owner feedback bound to the accepted owner", () => {
    const owner = "/root/adaptive_goal_fixture";
    const collaboration = (
      tool: "spawn_agent" | "wait_agent" | "followup_task",
      receiver: string,
    ) =>
      JSON.stringify({
        type: "item.completed",
        item: {
          id: tool + "-" + receiver,
          type: "collab_tool_call",
          tool,
          status: "completed",
          receiver_thread_ids: [receiver],
          task_name: tool === "spawn_agent" ? receiver : undefined,
          prompt:
            tool === "spawn_agent" ? "- phase: adaptive-goal-owner" : undefined,
        },
      });
    const retained = retainedCodexEvidence(
      [
        collaboration("spawn_agent", owner),
        collaboration("wait_agent", owner),
        collaboration("followup_task", owner),
        collaboration("followup_task", "/root/replacement_owner"),
      ].join("\n"),
      REPO,
      {
        exitCode: 0,
        stderrPresent: false,
        acceptedAgentRef: owner,
      },
    );
    expect(retained).toContain('"tool":"wait_agent"');
    expect(retained).toContain('"tool":"followup_task"');
    expect(retained).not.toContain("/root/replacement_owner");
    expect(retained.match(/darrow\.parent_tool_after_goal/g)).toHaveLength(1);
  });

  test("retains an opaque replacement spawn after owner acceptance", () => {
    const owner = "/root/adaptive_goal_fixture";
    const replacement = "/root/replacement_owner";
    const collaboration = (receiver: string, prompt: string, sender: string) =>
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "completed",
          sender_thread_id: sender,
          receiver_thread_ids: [receiver],
          task_name: receiver,
          prompt,
        },
      });
    const retained = retainedCodexEvidence(
      [
        collaboration(owner, "- phase: adaptive-goal-owner", "/root/parent"),
        collaboration(
          replacement,
          "unmarked replacement task",
          "/root/parent_followup",
        ),
      ].join("\n"),
      REPO,
      {
        exitCode: 0,
        stderrPresent: false,
        acceptedAgentRef: owner,
      },
    );
    expect(retained).toContain('"type":"darrow.parent_spawn_after_goal"');
    expect(retained).toContain('"tool":"spawn_agent"');
    expect(retained).toContain('"sender_thread_id":"/root/parent_followup"');
    expect(retained).toContain(`"agent_ref":"${replacement}"`);
    expect(retained).not.toContain("unmarked replacement task");
  });

  test("retains a failed native spawn attempt as omission evidence", () => {
    const stream = [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "failed",
          prompt: "- review_axis: standards\nsensitive failed task",
        },
      }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
    expect(retained).toContain('"tool":"spawn_agent"');
    expect(retained).toContain('"status":"failed"');
    expect(retained).toContain("- review_axis: standards");
    expect(retained).not.toContain("sensitive failed task");
  });
});
