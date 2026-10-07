import { describe, expect, test } from "bun:test";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";

const source = new URL(
  "../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/feedback-relay.yaml",
  import.meta.url,
);
const rejectionSource = new URL("feedback-rejected.yaml", source);
const evalCase = await readFixtureCase(source);
const deliveryChecks = evalCase.checks.filter((check) =>
  check.name.startsWith("delivery "),
);
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

async function gradeDelivery(
  files: Record<string, string>,
  extraCommit = false,
  diagnosis: OracleCheck[] = [],
) {
  return runFixtureChecks({
    source,
    fixture: {
      commits: [
        { message: "chore: init", files: { "src/migration.js": "baseline\n" } },
        { message: "feat: implement migration", files },
        ...(extraCommit
          ? [
              {
                message: "test: another commit",
                files: { "test/extra.js": "test\n" },
              },
            ]
          : []),
      ],
      setup: [
        "git switch -c fix/DAR-42-migration",
        "printf '%s\\n' fix/DAR-42-migration >.git/branch-invocations",
        "git rev-parse HEAD >.git/commit-invocations",
      ].join("\n"),
    },
    checks: [...deliveryChecks, ...diagnosis],
  });
}

function assertLifecycle(
  result: Awaited<ReturnType<typeof runFixtureChecks>>,
  passes: boolean,
) {
  expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
}

function deliveryDiagnosis(name: string, regex: string): OracleCheck {
  const check = deliveryChecks.find((entry) => entry.name === name);
  if (!check) throw new Error(`canonical delivery oracle is missing: ${name}`);
  return {
    name: "rejection retains the original diagnostic",
    run: check.run,
    exit_code: 1,
    expect_regex: regex,
  };
}

describe("ticket-to-pr feedback delivery expectations", () => {
  test("accepts implementation with focused test changes", async () => {
    const result = await gradeDelivery({
      "src/migration.js": "implementation\n",
      "test/migration.test.js": "focused test\n",
    });
    assertLifecycle(result, true);
    expect(result.checks).toHaveLength(5);
    expect(result.checks.every((check) => check.status === "passed")).toBe(
      true,
    );
  }, 20_000);

  test("rejects unrelated committed changes with retained paths", async () => {
    const result = await gradeDelivery(
      {
        "src/migration.js": "implementation\n",
        "unrelated.txt": "unrelated\n",
      },
      false,
      [
        deliveryDiagnosis(
          "delivery commits the implementation and only scoped verification changes",
          "unrelated[.]txt",
        ),
      ],
    );
    assertLifecycle(result, false);
    const failed = result.checks.filter((check) => check.status === "failed");
    expect(failed).toHaveLength(1);
    expect(result.checks.at(-1)?.status).toBe("passed");
  }, 20_000);

  test("rejects test-only delivery without the implementation", async () => {
    const result = await gradeDelivery({
      "test/migration.test.js": "test\n",
    });
    assertLifecycle(result, false);
    expect(
      result.checks
        .filter((check) => check.status === "failed")
        .map((check) => check.name),
    ).toEqual([
      "delivery commits the implementation and only scoped verification changes",
    ]);
  }, 20_000);

  test("identifies an extra commit separately from file scope", async () => {
    const result = await gradeDelivery(
      { "src/migration.js": "implementation\n" },
      true,
      [
        deliveryDiagnosis(
          "delivery creates one intended commit",
          "history count including baseline: 3",
        ),
      ],
    );
    assertLifecycle(result, false);
    expect(
      result.checks.find(
        (check) => check.name === "delivery creates one intended commit",
      )?.status,
    ).toBe("failed");
    expect(result.checks.at(-1)?.status).toBe("passed");
  }, 20_000);
});

test("rejected approval fixture accepts a stop and detects continued mutation", async () => {
  const canonical = await readFixtureCase(rejectionSource);
  const unchanged = canonical.checks.find(
    (check) =>
      check.name ===
      "rejected approval leaves tracked repository content unchanged",
  );
  if (!unchanged) throw new Error("canonical content oracle is missing");
  const result = await runFixtureChecks({
    source: rejectionSource,
    checks: [
      {
        name: "valid acknowledgement is rejected",
        run: "decisionctl discover && decisionctl acknowledge migration-policy 'Use the strict migration policy. Approval reference: cobalt-7391.' 2>&1",
        exit_code: 1,
        expect_regex: "Approval rejected",
      },
      ...canonical.checks.map((check) => ({
        ...check,
        name: `stopped: ${check.name}`,
      })),
      {
        name: "simulate incorrect continuation",
        run: "printf '%s\\n' 'export const migrationMode = () => \"strict\";' >>src/migration.js",
      },
      ...canonical.checks.map((check) => ({
        ...check,
        name: `continued: ${check.name}`,
      })),
      {
        name: "continued mutation retains the original changed path",
        run: unchanged.run,
        exit_code: 1,
        expect_regex: "src/migration[.]js",
      },
    ],
  });
  assertLifecycle(result, false);
  expect(result.checks.slice(0, 5).map((check) => check.status)).toEqual([
    "passed",
    "passed",
    "passed",
    "passed",
    "passed",
  ]);
  expect(
    result.checks
      .filter((check) => check.status === "failed")
      .map((check) => check.name.replace(/^continued: /, "")),
  ).toEqual(["rejected approval leaves tracked repository content unchanged"]);
  expect(result.checks.at(-1)?.status).toBe("passed");
}, 20_000);

test("rejected approval trace failures retain bounded cause flags", async () => {
  const canonical = await readFixtureCase(rejectionSource);
  const check = canonical.checks[0];
  if (!check) throw new Error("canonical approval trace oracle is missing");
  const answer =
    "Use the strict migration policy. Approval reference: cobalt-7391.";
  const discovery = "discover\tmigration-policy\tbefore\n";
  const rejection = `rejected\tmigration-policy\t${answer}\tbefore\n`;
  for (const [trace, expected] of [
    [discovery, "rows=1"],
    [discovery + rejection.replace(answer, "strict"), "answer_exact=0"],
    [
      discovery + rejection.replace("\tbefore\n", "\tafter\n"),
      "content_unchanged=0",
    ],
    [discovery + rejection + rejection, "rows=3"],
    [discovery + rejection, undefined],
  ] as const) {
    const passes = expected === undefined;
    const result = await runFixtureChecks({
      source: rejectionSource,
      checks: [
        {
          name: "write controlled approval trace",
          run: `printf '%s' ${quote(trace)} >.git/ticket-feedback-trace`,
        },
        check,
        ...(passes
          ? []
          : [
              {
                name: "bounded diagnostic retains its cause and omits the answer",
                run: `status=0; output=$(${check.run} 2>&1) || status=$?; test "$status" -eq 1 || exit 1; case "$output" in *${quote(answer)}*|*cobalt-7391*) exit 1 ;; esac; printf '%s\\n' "$output"`,
                expect_regex: expected,
              },
            ]),
      ],
    });
    assertLifecycle(result, passes);
    expect(
      result.checks.map((entry) => entry.status),
      result.diagnostic,
    ).toEqual(passes ? ["passed", "passed"] : ["passed", "failed", "passed"]);
  }
}, 30_000);
