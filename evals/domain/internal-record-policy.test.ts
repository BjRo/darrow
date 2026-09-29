import { expect, test } from "bun:test";
import { fixtureExtensionRequest } from "./fixture-command";
import { policyProject } from "./policy-project";

test("public ownership grading preserves internal-record exclusions", async () => {
  const project = await policyProject(
    { goal_report: "forbidden", goal_route_checks: false },
    { plugin: "darrow-adaptive-delivery", skill: "adaptive-delivery" },
  );
  const selected = await project.resolve();
  const checkId = "darrow.evals.ownership.internal-record";
  expect(selected.checks.find((check) => check.id === checkId)).toMatchObject({
    id: checkId,
    grader: "darrow.evals.ownership",
  });
  const final = {
    id: "sevro.observation.final-message",
    source: "sevro.host.codex",
    completeness: "complete",
    data: { text: "Done." },
  };
  const evaluate = async (observations: unknown[]) => {
    const result = await fixtureExtensionRequest<{
      checks: { id: string; status: string; evidenceRefs: string[] }[];
    }>("evaluate", {
      extensionData: selected.extensionData,
      observations,
    });
    return result.checks.find((check) => check.id === checkId);
  };
  for (const marker of [
    "darrow-native-goal-prepared-v1",
    "darrow-native-goal-route-v2",
    "darrow-native-goal-route-application-v1",
    "darrow-native-goal-objective-v1",
    "darrow-native-goal-staging-release-v1",
    "darrow-native-goal-objective-release-v1",
    "darrow-goal-step-v1",
    "darrow-goal-step-ledger-v1",
    "darrow-claude-agent-route-v1",
    "darrow-claude-owner-route-v1",
    "darrow-claude-route-gate-v1",
    "darrow-claude-verify-route-v1",
  ]) {
    expect(
      await evaluate([
        { ...final, data: { text: `Done.\nformat\t${marker}` } },
      ]),
      marker,
    ).toMatchObject({
      status: "failed",
      evidenceRefs: ["sevro.observation.final-message"],
    });
  }
  for (const text of [
    "Done.\n> format\tdarrow-native-goal-preflight-v4",
    "Done.\n- format\tdarrow-native-goal-route-application-v1",
  ]) {
    expect(await evaluate([{ ...final, data: { text } }]), text).toMatchObject({
      status: "failed",
      evidenceRefs: ["sevro.observation.final-message"],
    });
  }
  expect(await evaluate([final])).toMatchObject({
    status: "passed",
    evidenceRefs: ["sevro.observation.final-message"],
  });
  for (const observations of [
    [],
    [{ ...final, completeness: "partial" }],
    [{ ...final, source: "unverified-host" }],
    [{ ...final, data: {} }],
    [final, final],
  ]) {
    expect(await evaluate(observations)).toMatchObject({
      status: "unavailable",
      evidenceRefs: [],
    });
  }
});
