import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/verification-cadence.yaml",
  import.meta.url,
);

for (const scenario of [
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
    name: "missing red",
    events: ["focused pass", "final pass"],
    passes: false,
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
]) {
  test(`verification cadence: ${scenario.name}`, async () => {
    const canonical = await readFixtureCase(source);
    const check = canonical.checks.find(
      (c) => c.name === "feedback precedes final-tree verification",
    );
    if (!check) throw new Error("canonical cadence oracle is missing");
    const trace =
      scenario.events.map((event) => event.replace(" ", "\t")).join("\n") +
      "\n";
    const quoted = `'${trace.replaceAll("'", "'\\''")}'`;
    const result = await runFixtureChecks({
      source,
      checks: [
        {
          name: "record synthetic cadence trace",
          run: `printf '%s' ${quoted} >.git/fixture-state/verification-trace`,
        },
        check,
      ],
    });
    expect(result.exitCode, result.diagnostic).toBe(scenario.passes ? 0 : 1);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe(
      scenario.passes ? "passed" : "failed",
    );
    expect(result.checks[0]?.status).toBe("passed");
    expect(result.checks[1]?.status).toBe(
      scenario.passes ? "passed" : "failed",
    );
  }, 20_000);
}
