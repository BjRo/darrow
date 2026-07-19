import { describe, expect, test } from "bun:test";
import { matchedPolicyPrompt, usesMatchedPolicy } from "../src/policy";

describe("matched delivery-policy diagnostic", () => {
  test("adds identical portable TDD instructions without evaluator machinery", () => {
    const prompt = matchedPolicyPrompt("return the supplied instant");
    expect(prompt).toContain("meaningful red");
    expect(prompt).toContain("identical focused test");
    expect(prompt).toContain("regression suite");
    expect(prompt).toContain("public or otherwise observable seam");
    expect(prompt).not.toContain("evidence");
    expect(prompt).not.toContain("output schema");
  });

  test("identifies only evaluator-only matched-policy cells", () => {
    expect(usesMatchedPolicy("native-matched-policy")).toBe(true);
    expect(usesMatchedPolicy("plugins-matched-policy")).toBe(true);
    expect(usesMatchedPolicy("native")).toBe(false);
    expect(usesMatchedPolicy("plugins")).toBe(false);
    expect(usesMatchedPolicy("cli")).toBe(false);
  });
});
