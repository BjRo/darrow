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

async function loadCase(relativeCasePath: string): Promise<EvalCase> {
  return parseYaml(
    await readFile(
      resolve(import.meta.dir, "..", "..", relativeCasePath),
      "utf8",
    ),
  ) as EvalCase;
}

async function messageChecks(
  relativeCasePath: string,
  message: string,
  names: string[],
) {
  const root = await mkdtemp(join(tmpdir(), "darrow-discovery-checks-"));
  roots.push(root);
  await mkdir(join(root, ".git"));
  await writeFile(join(root, ".git", "last-message.md"), message);
  const evalCase = await loadCase(relativeCasePath);
  const checks = evalCase.checks.filter((check) => names.includes(check.name));
  return runChecks(root, checks as Check[]);
}

describe("discovery eval loopholes", () => {
  test("subjectless grilling accepts only the canonical question", async () => {
    const path =
      "plugins/capability/darrow-discovery/skills/work-through-decisions/evals/grilling-incomplete-subject.yaml";
    const name = "response is exactly the canonical subject question";
    for (const message of [
      "What subject would you like me to grill?\n\nHappy to help.",
      "What topic would you like grilled?\n\nQ3 — What scale?",
      "What plan should I grill?\n\n- Who uses it?\n- What scale is expected?",
      "What topic should I grill?\nWhat outcome matters?",
      "What topic should I grill? Also, what outcome matters?",
      "Which topic should I grill: payments, authentication, or storage?",
      "What would you like me to grill — a plan, decision, design, or idea?",
      "What subject do you want me to grill?",
      "What idea or plan would you like me to grill?",
      "- What topic should I grill?",
      "What do you want grilled?",
      "On what?",
      "Which subject?",
      "What should we grill?",
    ]) {
      const [check] = await messageChecks(path, message, [name]);
      expect(check?.passed).toBe(false);
    }

    const [canonical] = await messageChecks(
      path,
      "What subject would you like me to grill?",
      [name],
    );
    expect(canonical?.passed).toBe(true);
  }, 20_000);

  test("unresolved planning keeps prose judgment in semantic checks", async () => {
    const evalCase = await loadCase(
      "plugins/capability/darrow-discovery/skills/work-through-decisions/evals/plan-implementation-direct-unknowns.yaml",
    );

    expect(evalCase.checks.map((check) => check.name)).toEqual([
      "planning conversation is read-only",
    ]);
    expect(evalCase.semantic_output_checks?.map((check) => check.name)).toEqual(
      [
        "configuration scope is the sole current frontier",
        "dependent timeout choices remain deferred",
        "repository facts inform the timeout frontier",
      ],
    );
    expect(evalCase.checks.some((check) => /awk|grep/.test(check.run))).toBe(
      false,
    );
  });

  test("planning transfer keeps missing-policy authority in semantic checks", async () => {
    const evalCase = await loadCase(
      "plugins/capability/darrow-discovery/skills/work-through-decisions/evals/plan-implementation-dependency-frontier-transfer.yaml",
    );
    const name = "repository absence is not promoted to greenfield authority";
    const semanticCheck = evalCase.semantic_output_checks?.find(
      (check) => check.name === name,
    );

    expect(evalCase.checks.some((check) => check.name === name)).toBe(false);
    expect(semanticCheck?.proposition).toContain(
      "sparse or missing implementation",
    );
    expect(semanticCheck?.proposition).toContain("greenfield");
  });
});
