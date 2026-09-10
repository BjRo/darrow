import { describe, expect, test } from "bun:test";
import { renderParticipantPrompt } from "./prompt";

const colocatedSkill = {
  skillDir:
    "/workspace/plugins/orchestration/sample-plugin/skills/sample-skill",
  owningSkillName: "sample-skill",
};

describe("participant prompt rendering", () => {
  test("renders the owning skill's host-native explicit invocation", () => {
    const template = "Explicitly invoke {{skill_invocation}} for ticket 7.";

    expect(renderParticipantPrompt(template, "claude", colocatedSkill)).toBe(
      "Explicitly invoke /sample-skill for ticket 7.",
    );
    expect(renderParticipantPrompt(template, "codex", colocatedSkill)).toBe(
      "Explicitly invoke $sample-plugin:sample-skill for ticket 7.",
    );
  });

  test("renders a composition case through its packaged source plugin", () => {
    expect(
      renderParticipantPrompt("Use {{skill_invocation}}.", "codex", {
        skillDir:
          "/repo/plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr",
        owningSkillName: "ticket-to-pr",
        source_plugin: "plugins/orchestration/darrow-adaptive-delivery",
      }),
    ).toBe("Use $darrow-adaptive-delivery:ticket-to-pr.");
  });

  test("leaves prompts without the placeholder unchanged", () => {
    expect(
      renderParticipantPrompt("Use the appropriate capability.", "codex", {
        skillDir: "",
      }),
    ).toBe("Use the appropriate capability.");
  });

  test("rejects placeholder use without a colocated owning skill", () => {
    expect(() =>
      renderParticipantPrompt("Invoke {{skill_invocation}}.", "codex", {
        skillDir: "",
      }),
    ).toThrow("skill_invocation requires a colocated owning skill");
  });
});
