import { describe, expect, test } from "bun:test";
import { parse } from "yaml";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";

const questionSource = new URL(
  "../../plugins/capability/darrow-discovery/skills/grilling/evals/incomplete-subject.yaml",
  import.meta.url,
);
const planningRoot = new URL(
  "../../plugins/capability/darrow-discovery/skills/plan-implementation/evals/",
  import.meta.url,
);
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
type PlanningCase = {
  checks: OracleCheck[];
  semantic_output_checks?: { name: string; proposition: string }[];
};

async function planningCase(name: string): Promise<PlanningCase> {
  return parse(await Bun.file(new URL(`${name}.yaml`, planningRoot)).text());
}

describe("discovery eval loopholes", () => {
  test("subjectless grilling accepts only the canonical question", async () => {
    const canonical = await readFixtureCase(questionSource);
    const name = "response is exactly the canonical subject question";
    const check = canonical.checks.find((entry) => entry.name === name);
    if (!check) throw new Error("canonical subject-question oracle is missing");
    const messages = [
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
      "What subject would you like me to grill?",
    ];
    for (const [index, message] of messages.entries()) {
      const passes = index === messages.length - 1;
      const result = await runFixtureChecks({
        source: questionSource,
        checks: [
          {
            name: "write controlled response",
            run: `printf '%s' ${quote(message)} >.git/last-message.md`,
          },
          check,
        ],
      });
      expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
      expect(result.value.execution.status).toBe("completed");
      expect(result.value.grading.status).toBe("completed");
      expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
      expect(result.checks.map((entry) => entry.status)).toEqual([
        "passed",
        passes ? "passed" : "failed",
      ]);
    }
  }, 40_000);

  test("unresolved planning keeps prose judgment in semantic checks", async () => {
    const evalCase = await planningCase("direct-unknowns");
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
    const evalCase = await planningCase("dependency-frontier-transfer");
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
