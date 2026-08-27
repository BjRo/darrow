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
      "Explicitly invoke $sample-skill for ticket 7.",
    );
    expect(renderParticipantPrompt(template, "codex", colocatedSkill)).toBe(
      "Explicitly invoke $sample-plugin:sample-skill for ticket 7.",
    );
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
