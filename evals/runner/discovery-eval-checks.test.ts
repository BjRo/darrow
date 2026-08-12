import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { runChecks } from "./checks";
import type { Check, EvalCase } from "./types";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function messageChecks(
  relativeCasePath: string,
  message: string,
  names: string[],
) {
  const root = await mkdtemp(join(tmpdir(), "darrow-discovery-checks-"));
  roots.push(root);
  await mkdir(join(root, ".git"));
  await writeFile(join(root, ".git", "last-message.md"), message);
  const evalCase = parseYaml(
    await readFile(
      resolve(import.meta.dir, "..", "..", relativeCasePath),
      "utf8",
    ),
  ) as EvalCase;
  const checks = evalCase.checks.filter((check) => names.includes(check.name));
  return runChecks(root, checks as Check[]);
}

describe("discovery eval loopholes", () => {
  test("subjectless grilling rejects numbered and bulleted questionnaires", async () => {
    const path =
      "plugins/darrow-discovery/skills/grilling/evals/incomplete-subject.yaml";
    const name = "response does not invent a decision tree";
    for (const message of [
      "What topic would you like grilled?\n\nQ3 — What scale?",
      "What plan should I grill?\n\n- Who uses it?\n- What scale is expected?",
      "What topic should I grill?\nWhat outcome matters?",
      "What topic should I grill? Also, what outcome matters?",
      "What topic should I grill?\n\n+ Who uses it?\n+ What scale?",
      "What topic should I grill—and what outcome matters?",
      "What topic should I grill?\nWhat outcome matters?",
      "Which plan and what outcome should I grill?",
      "What topic should I grill? Also, should I consider a desired outcome?",
      "Which topic should I grill: payments, authentication, or storage?",
      "Which topic should I grill — payments, authentication, or storage?",
      "Which topic should I grill (payments, authentication, or storage)?",
      "Which topic should I grill — payments or authentication?",
      "Which topic should I grill (payments or authentication)?",
      "What would you like me to grill — a plan, decision, design, or idea?",
      "What would you like me to grill — a plan or decision you're weighing? I need a concrete target.",
    ]) {
      const [check] = await messageChecks(path, message, [name]);
      expect(check?.passed).toBe(false);
    }
    for (const message of [
      "What subject do you want me to grill?",
      "What idea or plan would you like me to grill?",
      "- What topic should I grill?",
      "Is there a plan you would like grilled?",
      "Do you have a topic you'd like me to grill?",
      "What do you want grilled?",
      "On what?",
      "Which subject?",
      "What should we grill?",
      "What do you want grilled? Give me one concrete target.",
    ]) {
      const [natural] = await messageChecks(path, message, [name]);
      expect(natural?.passed).toBe(true);
    }
  });

  test("unresolved planning rejects a premature compatibility question", async () => {
    for (const question of [
      "Q2 — What compatibility strategy should apply during rollout?",
      "Q2 — Compatibility strategy during rollout?",
      "Q2 — Describe the compatibility strategy for rollout?",
      "Q2 — Should existing callers retain the 1000 ms fallback during rollout?",
      "Q2 — What migration policy should preserve existing request behavior?",
      "Q2 — Should DEFAULT_TIMEOUT_MS remain the default for legacy callers?",
      "Q2 — What rollout strategy should we use for\nbackward compatibility?",
      "2. What compatibility strategy should apply?",
      "**Q2** — What compatibility strategy should apply?",
      "Q2) What compatibility strategy should apply?",
      "Q02 — What compatibility strategy should apply?",
    ]) {
      const [check] = await messageChecks(
        "plugins/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
        [
          "Q1 — Should the timeout be process-wide or per request?",
          "Recommendation: Prefer per-request configuration.",
          question,
        ].join("\n"),
        ["dependent compatibility choice is not asked prematurely"],
      );
      expect(check?.passed).toBe(false);
    }
  });

  test("planning frontier accepts harmless Markdown and first-person labels", async () => {
    for (const question of [
      "**Q1. Should timeout configuration be process-wide or per request?**",
      "**1. Should timeout configuration be process-wide or per request?**",
    ]) {
      const results = await messageChecks(
        "plugins/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
        [
          question,
          "**My recommendation:** Prefer per-request configuration.",
        ].join("\n"),
        [
          "unresolved architecture uses a grilling round",
          "technical recommendations preserve user choice",
        ],
      );
      expect(results.map((check) => check.passed)).toEqual([true, true]);
    }
  });

  test("unresolved planning rejects an implementation plan after a frontier", async () => {
    const names = [
      "unresolved architecture uses a grilling round",
      "technical recommendations preserve user choice",
      "repository facts are used",
      "unresolved choices do not become a final plan",
    ];
    const results = await messageChecks(
      "plugins/darrow-discovery/skills/plan-implementation/evals/direct-unknowns.yaml",
      [
        "Q1 — Should the timeout be process-wide or per request?",
        "Recommendation: Prefer per-request configuration while preserving the current default.",
        "This follows src/config.js and DEFAULT_TIMEOUT_MS.",
        "",
        "## Implementation plan",
        "1. Add the option.",
      ].join("\n"),
      names,
    );
    expect(results.map((check) => check.passed)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});
