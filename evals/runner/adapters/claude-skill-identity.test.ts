import { expect, test } from "bun:test";
import { claudeSkillActivation, retainedClaudeEvidence } from "./claude";

test("retains exact bounded Skill invocation identity without invocation arguments", () => {
  const stream = [
    ...["other-provider:code-review", "code-review"].map((skill) => ({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Skill",
            input: {
              skill,
              args: "private request",
              unrelated: "private context",
            },
          },
        ],
      },
    })),
    { type: "result", subtype: "success", is_error: false },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n");
  const retained = retainedClaudeEvidence(stream);
  expect(retained).toContain('"invocation":"other-provider:code-review"');
  expect(retained).toContain('"invocation":"code-review"');
  expect(retained).not.toContain("private");
  expect(claudeSkillActivation(stream).observedSkills).toEqual(["code-review"]);
});

test("omits unbounded or non-identifier invocation metadata", () => {
  for (const skill of ["private path/code-review", "x".repeat(257)]) {
    const stream = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "Skill", input: { skill } }],
      },
    });
    expect(retainedClaudeEvidence(stream)).not.toContain('"invocation":');
  }
});
