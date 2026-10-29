import { expect, test } from "bun:test";
import { fixtureExtensionRequest } from "./fixture-command";

const selected = await fixtureExtensionRequest<{
  cases: {
    checks: { id: string; grader: string }[];
    requiredEvidence: string[];
    extensionData: Record<string, unknown>;
  }[];
}>("resolve", {
  projectRoot: new URL("../../", import.meta.url).href,
  selectors: { caseIds: ["ticket-to-pr-composition-replacement"] },
});
const current = "1234567890abcdef1234567890abcdef12345678";
const message = (text: string) => ({
  id: "sevro.observation.final-message",
  source: "sevro.host.codex",
  completeness: "complete",
  data: { text },
});
const head = {
  id: "sevro.observation.git-head",
  source: "sevro.git-head",
  completeness: "complete",
  data: { currentRevision: current },
};

test("reported commit is compared with captured final HEAD through the public extension", async () => {
  const entry = selected.cases[0]!;
  expect(
    entry.checks.some((check) => check.grader === "darrow.evals.reported-head"),
  ).toBe(true);
  expect(entry.requiredEvidence).toContain(head.id);
  expect(entry.requiredEvidence).toContain("sevro.observation.final-message");
  for (const [text, status] of [
    [`Published commit ${current}.`, "passed"],
    [`Published commit \`${current.slice(0, 7)}\`.`, "passed"],
    ["Published commit abcdef0123456789abcdef0123456789abcdef01.", "failed"],
    ["Delivery complete without commit evidence.", "failed"],
    [`A longer unrelated token ${current}0.`, "failed"],
  ]) {
    const result = await fixtureExtensionRequest<{
      checks: { id: string; status: string }[];
    }>("evaluate", {
      extensionData: entry.extensionData,
      observations: [message(text!), head],
      configuration: { withoutSkill: true },
    });
    expect(
      result.checks.find((check) => check.id === "darrow.evals.reported-head.1")
        ?.status,
    ).toBe(status);
  }
  for (const observations of [
    [message(current)],
    [message(current), head, head],
    [message(current), { ...head, completeness: "partial" }],
    [message(current), { ...head, source: "candidate" }],
    [message(current), { ...head, data: { currentRevision: "invalid" } }],
    [{ ...message(current), completeness: "partial" }, head],
  ]) {
    const result = await fixtureExtensionRequest<{
      checks: { id: string; status: string }[];
    }>("evaluate", {
      extensionData: entry.extensionData,
      observations,
      configuration: { withoutSkill: true },
    });
    expect(
      result.checks.find((check) => check.id === "darrow.evals.reported-head.1")
        ?.status,
    ).toBe("unavailable");
  }
});
