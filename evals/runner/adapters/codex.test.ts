import { describe, expect, test } from "bun:test";
import {
  codexRunSucceeded,
  codexSkillActivation,
  codexTokenUsage,
  retainedCodexEvidence,
} from "./codex";
import { observeCodexTicketPipelineRoutes } from "../orchestration-metrics";

const REPO = "/tmp/eval";

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

  test("retains the reduced collaboration records used by route verification", () => {
    const stream = [
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
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");

    const retained = retainedCodexEvidence(stream, REPO);
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
});
