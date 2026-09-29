import { describe, expect, test } from "bun:test";
import { policyProject, runPolicyPrompt } from "./policy-project";

async function assertPrompt(
  project: Awaited<ReturnType<typeof policyProject>>,
  host: "codex" | "claude",
  expected: string,
) {
  const result = await runPolicyPrompt(project, host, expected);
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.format).toBe("sevro.cli-result.v1");
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.value.cases.map((selected) => selected.caseId)).toEqual([
    project.definition.id,
  ]);
  expect(result.value.cases[0]!.trials[0]!.checks).toMatchObject([
    { status: "passed" },
  ]);
}

describe("public participant prompt policy", () => {
  test("uses unnamespaced native tokens for repository skill cases", async () => {
    const project = await policyProject(
      { prompt: "Use {{skill_invocation}}." },
      { repository: true, skill: "darrow-guide" },
    );
    await assertPrompt(project, "codex", "Use $darrow-guide.");
    const inline = await runPolicyPrompt(
      project,
      "claude",
      "Use /darrow-guide.",
    );
    expect(inline.exitCode, inline.diagnostic).toBe(64);
    expect(inline.value.execution.status).toBe("not_run");
    expect(inline.value.grading.status).toBe("not_requested");
    expect(inline.value.task.verdict).toBe("not_assessed");
    expect(inline.value.diagnostic?.message).toBe(
      "invalid Claude repository skill invocation declaration",
    );
    await project.write({
      prompt: "{{skill_invocation}} Use this capability.",
    });
    await assertPrompt(project, "claude", "/darrow-guide Use this capability.");
  });

  test("renders the owning skill's host-native explicit invocation", async () => {
    const project = await policyProject(
      { prompt: "Explicitly invoke {{skill_invocation}} for ticket 7." },
      { plugin: "sample-plugin", skill: "sample-skill" },
    );
    await assertPrompt(
      project,
      "claude",
      "Explicitly invoke /sample-plugin:sample-skill for ticket 7.",
    );
    await assertPrompt(
      project,
      "codex",
      "Explicitly invoke $sample-plugin:sample-skill for ticket 7.",
    );
  });

  test("renders a composition case through its packaged source plugin", async () => {
    const project = await policyProject(
      { prompt: "Use {{skill_invocation}}." },
      {
        plugin: "darrow-adaptive-delivery",
        directory: "plugins/task-recipe/darrow-ticket-to-pr",
        skill: "ticket-to-pr",
      },
    );
    await assertPrompt(
      project,
      "codex",
      "Use $darrow-adaptive-delivery:ticket-to-pr.",
    );
    await project.write({
      source_plugin: "plugins/orchestration/darrow-adaptive-delivery",
    });
    await expect(project.resolve()).rejects.toThrow(/source_plugin/);
  });

  test("leaves prompts without the placeholder unchanged", async () => {
    const project = await policyProject(
      { prompt: "Use the appropriate capability." },
      { skillless: true },
    );
    await assertPrompt(project, "codex", "Use the appropriate capability.");
    await assertPrompt(project, "claude", "Use the appropriate capability.");
  });

  test("rejects placeholder use without a colocated owning skill", async () => {
    const project = await policyProject(
      { prompt: "Invoke {{skill_invocation}}." },
      { skillless: true },
    );
    await expect(project.resolve()).rejects.toThrow(
      /skill invocation requires a plugin-local case/,
    );
  });
});
