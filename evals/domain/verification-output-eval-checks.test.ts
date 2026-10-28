import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import {
  readFixtureCase,
  runFixtureChecks,
  type OutputOracleCheck,
} from "./fixture-command";

const cases = new URL(
  "../../plugins/capability/darrow-verification/skills/verify-change/evals/",
  import.meta.url,
);
const fixture = {
  commits: [{ message: "chore: fixture", files: { "README.md": "fixture\n" } }],
};

async function outputChecks(name: string): Promise<OutputOracleCheck[]> {
  const canonical = await readFixtureCase(new URL(name, cases));
  if (!canonical.output_checks?.length)
    throw new Error(`Current response checks are missing from ${name}`);
  return canonical.output_checks;
}

test("Verification shell checks have no retired response-file dependency", async () => {
  for (const name of await readdir(cases)) {
    if (!name.endsWith(".yaml")) continue;
    const canonical = await readFixtureCase(new URL(name, cases));
    for (const check of canonical.checks)
      expect(check.run, `${name}: ${check.name}`).not.toContain(
        ".git/last-message.md",
      );
  }
});

test("current output checks require an absolute final report handoff", async () => {
  const source = new URL("existing-review.yaml", cases);
  const checks = await outputChecks("existing-review.yaml");
  const footer =
    "Complete provider result: [report](</tmp/reviews/run/review.md>)";
  const examples: [string, boolean][] = [
    [`Assessment: progress.\n\n${footer}\n\n`, true],
    ["Assessment: progress.", false],
    ["Complete provider result: [report](<review.md>)", false],
    [footer.replace("review.md", "other.md"), false],
    [`${footer}\nMore assessment text.`, false],
    [footer.replace("[report]", "[evidence]"), false],
  ];
  for (const [finalMessage, passes] of examples) {
    const result = await runFixtureChecks({
      source,
      fixture,
      checks: [],
      outputChecks: checks,
      finalMessage,
    });
    expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
    expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
  }
}, 90_000);

test("current follow-up output checks preserve the report and advisory identity", async () => {
  const source = new URL("followup-regression.yaml", cases);
  const checks = await outputChecks("followup-regression.yaml");
  const footer =
    "Complete provider result: [report](</tmp/candidate/.fixture-state/inspect-candidate-report.md>)";
  const examples: [string, boolean][] = [
    [`F1 resolved; A1 remains a nonblocking advisory.\n\n${footer}\n`, true],
    [`F1 resolved.\n\n${footer}`, false],
    [`A10 remains.\n\n${footer}`, false],
    ["A1 remains a nonblocking advisory.", false],
  ];
  for (const [finalMessage, passes] of examples) {
    const result = await runFixtureChecks({
      source,
      fixture,
      checks: [],
      outputChecks: checks,
      finalMessage,
    });
    expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
    expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
  }
}, 90_000);
