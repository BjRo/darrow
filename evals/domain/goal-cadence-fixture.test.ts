import { expect, test } from "bun:test";
import {
  type OracleCheck,
  readFixtureCase,
  runFixtureChecks,
} from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/verification-cadence.yaml",
  import.meta.url,
);

const scenarios = [
  {
    name: "red green final",
    events: ["focused fail", "focused pass", "final pass"],
    passes: true,
  },
  {
    name: "repeated final confirmation",
    events: ["focused fail", "focused pass", "final pass", "final pass"],
    passes: true,
  },
  {
    name: "repaired final check",
    events: [
      "focused fail",
      "focused pass",
      "final fail",
      "focused pass",
      "final pass",
    ],
    passes: true,
  },
  {
    name: "successful feedback without a manufactured failure",
    events: ["focused pass", "final pass"],
    passes: true,
  },
  {
    name: "missing green",
    events: ["focused fail", "final pass"],
    passes: false,
  },
  {
    name: "baseline gate followed by final verification",
    events: ["final pass", "focused fail", "focused pass", "final pass"],
    passes: true,
  },
  {
    name: "baseline gate does not replace final verification",
    events: ["final pass", "focused fail", "focused pass"],
    passes: false,
  },
  {
    name: "last final failed",
    events: ["focused fail", "focused pass", "final pass", "final fail"],
    passes: false,
  },
  {
    name: "later focused failure",
    events: ["focused fail", "focused pass", "final pass", "focused fail"],
    passes: false,
  },
  {
    name: "redundant focused confirmation",
    events: ["focused fail", "focused pass", "final pass", "focused pass"],
    passes: true,
  },
  { name: "no evidence", events: [], passes: false },
];

test("verification cadence preserves successful order without requiring red", async () => {
  const canonical = await readFixtureCase(source);
  const check = canonical.checks.find(
    (c) => c.name === "feedback precedes final-tree verification",
  );
  if (!check) throw new Error("canonical cadence oracle is missing");
  const checks: OracleCheck[] = [];
  for (const scenario of scenarios) {
    const trace =
      scenario.events.map((event) => event.replace(" ", "\t")).join("\n") +
      "\n";
    const quoted = `'${trace.replaceAll("'", "'\\''")}'`;
    checks.push(
      {
        name: `record ${scenario.name}`,
        run: `printf '%s' ${quoted} >.fixture-state/verification-trace`,
      },
      { ...check, name: scenario.name, exit_code: scenario.passes ? 0 : 1 },
    );
  }
  const result = await runFixtureChecks({
    source,
    fixtureAssets: new URL(
      "../../plugins/orchestration/darrow-adaptive-goal/",
      import.meta.url,
    ),
    fixtureAssetFiles: ["backend/tests/evals/verification_cadence.py"],
    checks,
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((entry) => entry.status)).toEqual(
    checks.map(() => "passed"),
  );
}, 60_000);
