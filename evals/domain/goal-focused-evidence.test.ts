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
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

test("focused evidence accepts data-driven assertions and rejects uncovered inputs", async () => {
  const canonical = await readFixtureCase(source);
  const evidence = canonical.checks.find(
    (check) => check.name === "focused evidence is durable",
  );
  if (!evidence) throw new Error("focused evidence oracle is missing");
  const checks: OracleCheck[] = [
    {
      name: "prepare public API implementation",
      run: `printf '%s' ${quote("export const identity = value => value;\nexport const isEven = value => Number.isInteger(value) && value % 2 === 0;\n")} >src/math.js`,
    },
  ];
  for (const [name, values, assertions, valid] of [
    ["data-driven evidence", [0, -2, 2, 1, -3, 2.5], true, true],
    ["zero missing", [-2, 2, 1, -3], true, false],
    ["negative even missing", [0, 2, 1, -3], true, false],
    ["odd missing", [0, -2, 2], true, false],
    ["calls without assertions", [0, -2, 1], false, false],
  ] as const) {
    const body = `import test from "node:test";
import assert from "node:assert/strict";
import { isEven } from "../src/math.js";
test("isEven inputs", () => {
  for (const value of ${JSON.stringify(values)}) {
    ${assertions ? "assert.equal(isEven(value), Number.isInteger(value) && value % 2 === 0);" : "isEven(value);"}
  }
});
`;
    checks.push(
      {
        name: `prepare ${name}`,
        run: `printf '%s' ${quote(body)} >test/math.test.js`,
      },
      { ...evidence, name, exit_code: valid ? 0 : 1 },
    );
  }
  const result = await runFixtureChecks({
    source,
    fixtureAssets: new URL(
      "../../plugins/orchestration/darrow-adaptive-goal/",
      import.meta.url,
    ),
    fixtureAssetFiles: ["backend/tests/evals/verification_cadence.py"],
    runtimeConfig: new URL(
      "../sevro-extension/runtime-repository-skills.json",
      import.meta.url,
    ),
    checks,
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.checks.map((check) => check.status)).toEqual(
    checks.map(() => "passed"),
  );
}, 60_000);
