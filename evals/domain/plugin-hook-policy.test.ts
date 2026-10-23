import { expect, test } from "bun:test";
import { fixtureExtensionRequest } from "./fixture-command";
import { policyProject, preparePolicy } from "./policy-project";

test("required plugin hooks install the native package without explicit dispatch", async () => {
  const project = await policyProject({
    required_plugin_hook: "sample",
    activation: "positive",
  });
  const selected = await project.resolve();
  expect(selected.prompt).toBe("Grill this plan.");
  expect(
    selected.checks.find((check) => check.id === "darrow.evals.plugin-hook"),
  ).toMatchObject({
    id: "darrow.evals.plugin-hook",
    grader: "darrow.evals.plugin-hook",
  });
  const mounted = await preparePolicy(selected);
  expect(mounted.codexMarketplace).toMatchObject({ pluginNames: ["sample"] });
  expect(mounted.codexSkillInvocation).toBeUndefined();
});

test("required plugin hook checks distinguish execution failures from unknown evidence", async () => {
  const observation = {
    id: "sevro.host.hooks",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      plugins: [
        {
          name: "sample",
          allowed: true,
          sourceDigest: "a".repeat(64),
          effectiveDigest: "b".repeat(64),
        },
      ],
      executions: [{ status: "completed", pid: 123, exitCode: 0 }],
    },
  };
  const grade = async (observations: unknown[]) => {
    const result = await fixtureExtensionRequest<{
      checks: { id: string; status: string }[];
    }>("evaluate", {
      configuration: {},
      extensionData: { "darrow.case": { requiredPluginHook: "sample" } },
      observations,
    });
    return result.checks.find(
      (check) => check.id === "darrow.evals.plugin-hook",
    )?.status;
  };
  expect(await grade([observation])).toBe("passed");
  expect(await grade([])).toBe("unavailable");
  expect(await grade([observation, observation])).toBe("unavailable");
  expect(await grade([{ ...observation, source: "other.host" }])).toBe(
    "unavailable",
  );
  expect(await grade([{ ...observation, completeness: "partial" }])).toBe(
    "unavailable",
  );
  expect(
    await grade([
      { ...observation, data: { ...observation.data, executions: [] } },
    ]),
  ).toBe("failed");
  expect(
    await grade([
      {
        ...observation,
        data: {
          ...observation.data,
          plugins: [{ ...observation.data.plugins[0], allowed: false }],
        },
      },
    ]),
  ).toBe("failed");
  expect(
    await grade([
      {
        ...observation,
        data: {
          ...observation.data,
          executions: [{ status: "completed", pid: 123, exitCode: 1 }],
        },
      },
    ]),
  ).toBe("failed");
  expect(
    await grade([
      {
        ...observation,
        data: {
          ...observation.data,
          plugins: [
            ...observation.data.plugins,
            { ...observation.data.plugins[0], name: "other" },
          ],
        },
      },
    ]),
  ).toBe("unavailable");
  expect(
    await grade([
      {
        ...observation,
        data: {
          ...observation.data,
          executions: [{ status: "running", pid: 123 }],
        },
      },
    ]),
  ).toBe("unavailable");
});
