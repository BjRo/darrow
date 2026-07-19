import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  installMatchedPolicy,
  matchedPolicyPrompt,
  usesMatchedPolicy,
  validateMatchedPolicyEvidence,
} from "../src/policy";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("matched delivery-policy diagnostic", () => {
  test("installs identical evaluator-owned evidence inputs outside the patch", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-policy-test-"));
    roots.push(repo);
    await mkdir(join(repo, ".git", "info"), { recursive: true });
    const pluginRoot = resolve(import.meta.dir, "..", "..", "..", "plugins");
    const policy = await installMatchedPolicy(repo, pluginRoot);
    expect(await Bun.file(policy.evidenceScript).exists()).toBe(true);
    expect(await Bun.file(policy.outputSchema).exists()).toBe(true);
    expect(
      await Bun.file(join(repo, ".git", "info", "exclude")).text(),
    ).toContain("/.evaluation/");
    expect(
      JSON.stringify(await Bun.file(policy.outputSchema).json()),
    ).not.toContain("uniqueItems");
    const prompt = matchedPolicyPrompt("return the supplied instant", policy);
    expect(prompt).toContain("meaningful behavioral red");
    expect(prompt).toContain("exactly the same focused command");
    expect(prompt).toContain("regression");
    expect(prompt).toContain(policy.evidenceScript);
    expect(await validateMatchedPolicyEvidence(repo, policy)).toBe(false);
  });

  test("identifies only evaluator-only matched-policy cells", () => {
    expect(usesMatchedPolicy("native-matched-policy")).toBe(true);
    expect(usesMatchedPolicy("plugins-matched-policy")).toBe(true);
    expect(usesMatchedPolicy("native")).toBe(false);
    expect(usesMatchedPolicy("plugins")).toBe(false);
    expect(usesMatchedPolicy("cli")).toBe(false);
  });
});
