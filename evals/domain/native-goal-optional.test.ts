import { expect, test } from "bun:test";
import { fixtureExtensionRequest } from "./fixture-command";
import { policyProject } from "./policy-project";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

test.each(["goal-cross-turn-feedback-answer", "goal-placement-repair-reuse"])(
  "%s cannot finish with an active goal despite a completion claim",
  async (id) => {
    const { cases } = await fixtureExtensionRequest<{
      cases: { extensionData: unknown }[];
    }>("resolve", {
      projectRoot: pathToFileURL(resolve(import.meta.dir, "../..")).href,
      selectors: { caseIds: [id] },
    });
    for (const state of ["complete", "active"]) {
      const result = await fixtureExtensionRequest<{
        checks: { id: string; status: string }[];
      }>("evaluate", {
        extensionData: cases[0]!.extensionData,
        observations: [
          {
            id: "sevro.host.native-goal",
            source: "sevro.host.codex",
            completeness: "complete",
            data: {
              threadId: "original",
              goals: [{ status: state, characters: 120 }],
              goalStatus: state,
            },
          },
          {
            id: "sevro.observation.final-message",
            source: "sevro.host.codex",
            completeness: "complete",
            data: {
              text: "Complete. Checks passed and the repair is verified.",
            },
          },
        ],
      });
      expect(
        result.checks.find((check) => check.id === "darrow.evals.native-goal")
          ?.status,
      ).toBe(state === "complete" ? "passed" : "failed");
    }
  },
);

test("optional native goal accepts observed activation or absence", async () => {
  const project = await policyProject(
    {
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

test("completed delivery requires native completion rather than activation or a claim", async () => {
  const project = await policyProject(
    {
      native_goal: "complete",
    },
    { plugin: "darrow-adaptive-goal", skill: "adaptive-goal" },
  );
  const selected = await project.resolve();
  for (const host of ["codex", "claude"]) {
    for (const [state, completeness, expected] of [
      ["complete", "complete", "passed"],
      ["active", "complete", "failed"],
      ["blocked", "complete", "failed"],
      ["complete", "partial", "unavailable"],
    ]) {
      const result = await fixtureExtensionRequest<{
        checks: { id: string; status: string }[];
      }>("evaluate", {
        extensionData: selected.extensionData,
        observations: [
          {
            id: "sevro.host.native-goal",
            source: "sevro.host." + host,
            completeness,
            data: {
              threadId: "original",
              goals: [{ status: state, characters: 120 }],
              goalStatus: state,
            },
          },
          {
            id: "sevro.observation.final-message",
            source: "sevro.host." + host,
            completeness: "complete",
            data: { text: "The goal is complete." },
          },
        ],
      });
      expect(
        result.checks.find((check) => check.id === "darrow.evals.native-goal")
          ?.status,
      ).toBe(expected);
    }
  }
});
