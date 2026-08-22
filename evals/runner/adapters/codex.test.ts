import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  codexEvalSkillsRoot,
  codexRunSucceeded,
  codexSkillActivation,
  codexTokenUsage,
  retainedCodexEvidence,
} from "./codex";
import { observeCodexTicketPipelineRoutes } from "../orchestration-metrics";
import {
  fixtureStateFingerprint,
  guardCodexSpawn,
  repositoryFingerprint,
  verifiedCodexSpawnAttestation,
} from "../codex-spawn-guard";

const REPO = "/tmp/eval";
const COMPLETE_CONTRACT = [
  "Outcome: Implement the requested fixture behavior.",
  "Acceptance criteria: The requested behavior and checks pass.",
  "Scope: The fixture implementation and tests.",
  "Non-goals: No unrelated refactor.",
  "Preserved work: Preserve user-owned changes.",
  "Permissions: Local edits and checks only.",
  "Workflow sequence: Change feature, feedback, then final checks.",
  "Feedback checks: Run the focused behavior check after edits.",
  "Final-tree checks: Run the repository test script.",
  "Independent review: omitted — routine local work needs no review.",
  "Stopping budget: No user-specified numeric limit.",
  "Human feedback: Pause for the smallest material question.",
  "Completion report: Begin with the canonical report.",
  "format\tdarrow-native-goal-preflight-v4",
  "workflow\tchange-feature",
  "risk\troutine",
  "profile\troutine",
  "selected_route\tcodex\topenai\tgpt-5.6-luna\tlow",
  "effective_route\tcodex\topenai\tgpt-5.6-luna\tlow",
  "route_applied_by\tnative-subagent",
  "route_verified\ttrue",
  "launch_boundary\tnative_subagent",
  "verification_gate\troutine",
  "evaluation_child_invocations\t1",
  "evaluation_human_interruptions\t0",
].join("\n");

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

  test("requires structurally complete successful command evidence", () => {
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

  test("retains only verified spawn attestation and later parent-tool evidence", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-codex-adapter-"));
    const objectiveRoot = await mkdtemp(
      join(tmpdir(), "darrow-codex-objective-"),
    );
    try {
      await writeFile(join(repo, "fixture.txt"), "base\n");
      await mkdir(join(repo, ".git"));
      const guarded = await guardCodexSpawn(
        {
          cwd: repo,
          turn_id: "parent-turn",
          tool_name: "Agent",
          tool_input: {
            message: `- phase: adaptive-goal-runner\n${COMPLETE_CONTRACT}`,
            model: "gpt-5.6-luna",
            reasoning_effort: "low",
            fork_turns: "none",
          },
        },
        {
          secret: "secret",
          baselineSha256: await repositoryFingerprint(repo),
          fixtureStateSha256: await fixtureStateFingerprint(repo),
          requestSha256: "4".repeat(64),
          objectiveRoot,
          goalLoopPath: "/plugin/bin/goal-loop",
          statePath: join(repo, ".git", "guard-state"),
        },
      );
      const prompt = (
        guarded?.hookSpecificOutput as {
          updatedInput: { message: string };
        }
      ).updatedInput.message;
      const spawnItem = {
        id: "spawn-1",
        type: "collab_tool_call",
        tool: "spawn_agent",
        sender_thread_id: "parent-thread",
        receiver_thread_ids: ["goal-thread"],
        prompt,
      };
      const stream = [
        JSON.stringify({
          type: "item.started",
          item: { ...spawnItem, status: "in_progress" },
        }),
        JSON.stringify({
          type: "item.completed",
          item: { ...spawnItem, status: "completed" },
        }),
        JSON.stringify({
          type: "item.started",
          item: {
            id: "parent-command",
            type: "command_execution",
            command: "bash test.sh",
            status: "in_progress",
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
      });
      expect(retained).toContain('"goal_spawn_attestation"');
      expect(retained).toContain('"model":"gpt-5.6-luna"');
      expect(retained).toContain('"type":"darrow.parent_tool_after_goal"');
      expect(retained).toContain('"type":"darrow.human_feedback_answer"');
      expect(retained.match(/darrow\.parent_tool_after_goal/g)).toHaveLength(1);
      expect(retained).not.toContain(
        "Implement the requested fixture behavior",
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
  });

  test("exempts only a successful release bound to the attested attachment", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-codex-adapter-"));
    const objectiveRoot = await mkdtemp(
      join(tmpdir(), "darrow-codex-objective-"),
    );
    try {
      await mkdir(join(repo, ".git"));
      await writeFile(join(repo, "fixture.txt"), "base\n");
      const attachmentDir = join(objectiveRoot, "darrow-goal-contract.bound");
      await mkdir(attachmentDir);
      const contractFile = join(attachmentDir, "goal-contract.md");
      const digest = createHash("sha256")
        .update(COMPLETE_CONTRACT)
        .digest("hex");
      await writeFile(contractFile, COMPLETE_CONTRACT);
      const bounded = [
        "Before doing any work, read the complete goal contract at:",
        contractFile,
        `Expected SHA-256: ${digest}`,
        "Verify the file digest before following the contract.",
        "If the file is missing, unreadable, or does not match, stop and report the evidence gap.",
        "This accepted ownership-marked task already makes you the sole goal owner; execute the contract directly even when no inner goal-control tool exists.",
        "Follow that complete contract through terminal completion.",
        "",
      ].join("\n");
      const objectiveFile = join(attachmentDir, "goal-objective.txt");
      await writeFile(objectiveFile, bounded);
      const guarded = await guardCodexSpawn(
        {
          cwd: repo,
          turn_id: "parent-turn",
          tool_name: "Agent",
          tool_input: {
            message: `- phase: adaptive-goal-runner\n- objective_file: ${objectiveFile}`,
            model: "gpt-5.6-luna",
            reasoning_effort: "low",
            fork_turns: "none",
          },
        },
        {
          secret: "secret",
          baselineSha256: await repositoryFingerprint(repo),
          fixtureStateSha256: await fixtureStateFingerprint(repo),
          requestSha256: "4".repeat(64),
          objectiveRoot,
          goalLoopPath: "/plugin/bin/goal-loop",
          statePath: join(repo, ".git", "guard-state"),
        },
      );
      const prompt = (
        guarded?.hookSpecificOutput as { updatedInput: { message: string } }
      ).updatedInput.message;
      expect(verifiedCodexSpawnAttestation(prompt, "secret")).toMatchObject({
        objectiveMode: "file-backed",
        attachmentDir,
        contractSha256: digest,
        forkTurns: "none",
      });
      const spawn = (type: "item.started" | "item.completed") =>
        JSON.stringify({
          type,
          item: {
            id: "spawn-1",
            type: "collab_tool_call",
            tool: "spawn_agent",
            status: type === "item.started" ? "in_progress" : "completed",
            sender_thread_id: "parent-thread",
            receiver_thread_ids: type === "item.started" ? [] : ["goal-thread"],
            prompt,
          },
        });
      const goalLoopPath = "/plugin/bin/goal-loop";
      const release = JSON.stringify({
        type: "item.completed",
        item: {
          id: "release-1",
          type: "command_execution",
          command:
            `/bin/bash ${goalLoopPath} release-objective ` +
            `--attachment-dir ${attachmentDir} --expected-sha256 ${digest}`,
          exit_code: 0,
          status: "completed",
          aggregated_output: [
            "format\tdarrow-native-goal-objective-release-v1",
            "status\treleased",
            `attachment_dir\t${attachmentDir}`,
          ].join("\n"),
        },
      });
      const retained = retainedCodexEvidence(
        [spawn("item.started"), spawn("item.completed"), release].join("\n"),
        repo,
        {
          exitCode: 0,
          stderrPresent: false,
          spawnGuardSecret: "secret",
          goalLoopPath,
        },
      );
      expect(retained).toContain('"type":"darrow.objective_release"');
      expect(retained).not.toContain("darrow.parent_tool_after_goal");
      const wrong = retainedCodexEvidence(
        [
          spawn("item.started"),
          spawn("item.completed"),
          release.replace(
            `--expected-sha256 ${digest}`,
            `--expected-sha256 ${"0".repeat(64)}`,
          ),
        ].join("\n"),
        repo,
        {
          exitCode: 0,
          stderrPresent: false,
          spawnGuardSecret: "secret",
          goalLoopPath,
        },
      );
      expect(wrong).toContain("darrow.parent_tool_after_goal");
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(objectiveRoot, { recursive: true, force: true });
    }
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
