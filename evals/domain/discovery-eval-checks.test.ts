import { describe, expect, test } from "bun:test";
import { parse } from "yaml";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";

const questionSource = new URL(
  "../../plugins/capability/darrow-discovery/skills/work-through-decisions/evals/grilling-incomplete-subject.yaml",
  import.meta.url,
);
const planningRoot = new URL(
  "../../plugins/capability/darrow-discovery/skills/work-through-decisions/evals/",
  import.meta.url,
);
type PlanningCase = {
  checks: OracleCheck[];
  semantic_output_checks?: { name: string; proposition: string }[];
};

async function planningCase(name: string): Promise<PlanningCase> {
  return parse(
    await Bun.file(
      new URL(`plan-implementation-${name}.yaml`, planningRoot),
    ).text(),
  );
}

describe("discovery eval loopholes", () => {
  test("subjectless grilling accepts only the canonical question", async () => {
    const canonical = await readFixtureCase(questionSource);
    const name = "response is exactly the canonical subject question";
    const check = canonical.output_checks?.find((entry) => entry.name === name);
    if (!check) throw new Error("canonical subject-question oracle is missing");
    expect(canonical.output_checks).toEqual([
      {
        name,
        expect_regex:
          "^What subject would you like me to grill\\?\\n?(?![\\s\\S])",
      },
    ]);
    expect(canonical.checks).toEqual([
      {
        name: "subjectless request remains read-only",
        run: "git status --porcelain --untracked-files=all",
        expect_exact: "",
      },
    ]);
    const question = new RegExp(check.expect_regex!);
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
      expect(question.test(message), message).toBe(passes);
    }
    const exact = messages.at(-1)!;
    expect(question.test(`${exact}\n`)).toBe(true);
    for (const message of [
      `${exact}\n\n`,
      ` ${exact}`,
      `${exact} `,
      `${exact}\r\n`,
    ])
      expect(question.test(message), message).toBe(false);
  });

  test("subjectless grilling grades final responses through the installed CLI", async () => {
    const canonical = await readFixtureCase(questionSource);
    for (const [finalMessage, passes] of [
      ["What subject would you like me to grill?", true],
      ["What subject would you like me to grill?\n", true],
      ["What subject would you like me to grill?\n\n", false],
      ["What subject would you like me to grill?\n\nHappy to help.", false],
    ] as const) {
      const result = await runFixtureChecks({
        source: questionSource,
        checks: canonical.checks,
        outputChecks: canonical.output_checks,
        finalMessage,
      });
      expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
      expect(result.value.execution.status).toBe("completed");
      expect(result.value.grading.status).toBe("completed");
      expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
      expect(result.checks[0]?.status).toBe("passed");
    }
  }, 30_000);

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
