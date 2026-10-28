import { expect, test } from "bun:test";
import { fixtureExtensionRequest } from "./fixture-command";
import { policyProject } from "./policy-project";

test("optional native goal accepts observed activation or absence", async () => {
  const project = await policyProject(
    {
      goal_report: "forbidden",
      goal_route_checks: false,
      native_goal: "optional",
    },
    { plugin: "darrow-adaptive-goal", skill: "adaptive-goal" },
  );
  const selected = await project.resolve();
  const status = async (data: unknown) => {
    const result = await fixtureExtensionRequest<{
      checks: { id: string; status: string }[];
    }>("evaluate", {
      extensionData: selected.extensionData,
      observations: [
        {
          id: "sevro.host.native-goal",
          source: "sevro.host.codex",
          completeness: "complete",
          data,
        },
        {
          id: "sevro.observation.final-message",
          source: "sevro.host.codex",
          completeness: "complete",
          data: { text: "Which branch should I prepare?" },
        },
      ],
    });
    return result.checks.find(
      (check) => check.id === "darrow.evals.native-goal",
    )?.status;
  };
  expect(
    await status({
      threadId: "t",
      goals: [{ status: "blocked", characters: 120 }],
      goalStatus: "blocked",
    }),
  ).toBe("passed");
  expect(await status({ threadId: "t", goals: [], goalStatus: null })).toBe(
    "passed",
  );
  expect(await status({ threadId: "t", goals: [], goalStatus: "active" })).toBe(
    "unavailable",
  );
  expect(await status(null)).toBe("unavailable");
});
