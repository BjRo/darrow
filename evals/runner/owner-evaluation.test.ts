import { expect, test } from "bun:test";
import {
  codexSpawnGuardEnabled,
  codexUsageCoversExecution,
  codexTokenUsage,
} from "./adapters/codex";
import { claudeArgv } from "./adapters/claude";

const request = {
  repoDir: "/tmp/fixture",
  prompt: "$adaptive-goal Implement the bounded request",
  model: "gpt-5.6-terra",
  effort: "medium",
};

test("passive mode disables all adaptive spawn enforcement even for composition", () => {
  expect(codexSpawnGuardEnabled(request)).toBe(true);
  expect(
    codexSpawnGuardEnabled({
      ...request,
      control: { ownerEvaluationMode: "passive", expectGoalOwner: true },
    }),
  ).toBe(false);
  expect(
    codexSpawnGuardEnabled({
      ...request,
      prompt: "Read NOTES.md",
      control: {
        ownerEvaluationMode: "passive",
        followUpPrompt: "$adaptive-goal Continue",
      },
    }),
  ).toBe(false);
  expect(codexSpawnGuardEnabled({ ...request, prompt: "Read NOTES.md" })).toBe(
    false,
  );
});

test("passive Claude trials do not add product-policy tool exclusions", () => {
  const argv = claudeArgv("$adaptive-goal Work", "claude-sonnet-5", "low", {
    expectGoalOwner: true,
    ownerEvaluationMode: "passive",
  });
  expect(argv).not.toContain("--disallowed-tools");
  expect(argv).toContain("--strict-mcp-config");
});

test("unreconciled native child and resumed-turn usage cannot claim savings", () => {
  expect(codexUsageCoversExecution(true, "")).toBe(true);
  expect(codexUsageCoversExecution(false, "")).toBe(false);
  expect(
    codexUsageCoversExecution(
      true,
      JSON.stringify({ type: "darrow.codex_native_single_agent_accepted" }),
    ),
  ).toBe(false);
  expect(
    codexTokenUsage(
      [
        {
          type: "turn.completed",
          usage: { input_tokens: 100, output_tokens: 10 },
        },
        { type: "darrow.eval.follow_up_turn" },
        {
          type: "turn.completed",
          usage: { input_tokens: 70, output_tokens: 5 },
        },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n"),
    ).complete,
  ).toBe(false);
});
