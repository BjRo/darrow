import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { runChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { Check, EvalCase } from "./types";

const casePath = resolve(
  import.meta.dir,
  "../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/feedback-relay.yaml",
);
const evalCase = parse(await readFile(casePath, "utf8")) as { checks: Check[] };
const deliveryChecks = evalCase.checks.filter((check) =>
  check.name.startsWith("delivery "),
);

async function gradeDelivery(
  files: Record<string, string>,
  extraCommit = false,
) {
  const repoDir = await buildFixture({
    skillDir: "",
    skillMounts: [],
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
  });
  try {
    return await runChecks(repoDir, deliveryChecks);
  } finally {
    await destroyFixture(repoDir);
  }
}

describe("ticket-to-pr feedback delivery expectations", () => {
  test("accepts implementation with focused test changes", async () => {
    const results = await gradeDelivery({
      "src/migration.js": "implementation\n",
      "test/migration.test.js": "focused test\n",
    });
    expect(results).toHaveLength(5);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  test("rejects unrelated committed changes with retained paths", async () => {
    const results = await gradeDelivery({
      "src/migration.js": "implementation\n",
      "unrelated.txt": "unrelated\n",
    });
    const failed = results.filter((result) => !result.passed);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.detail).toContain("unrelated.txt");
  });

  test("rejects test-only delivery without the implementation", async () => {
    const results = await gradeDelivery({ "test/migration.test.js": "test\n" });
    expect(
      results.filter((result) => !result.passed).map((result) => result.name),
    ).toEqual([
      "delivery commits the implementation and only scoped verification changes",
    ]);
  });

  test("identifies an extra commit separately from file scope", async () => {
    const results = await gradeDelivery(
      { "src/migration.js": "implementation\n" },
      true,
    );
    const count = results.find(
      (result) => result.name === "delivery creates one intended commit",
    );
    expect(count?.passed).toBe(false);
    expect(count?.detail).toContain("history count including baseline: 3");
  });
});

test("rejected approval fixture accepts a stop and detects continued mutation", async () => {
  const rejectionCase = parse(
    await readFile(
      casePath.replace("feedback-relay.yaml", "feedback-rejected.yaml"),
      "utf8",
    ),
  ) as EvalCase;
  const repoDir = await buildFixture({
    skillDir: "",
    skillMounts: [],
    fixture: rejectionCase.fixture,
  });
  try {
    const [rejection] = await runChecks(repoDir, [
      {
        name: "valid acknowledgement is rejected",
        run: "decisionctl discover && decisionctl acknowledge migration-policy 'Use the strict migration policy. Approval reference: cobalt-7391.' 2>&1",
        exit_code: 1,
        expect_regex: "Approval rejected",
      },
    ]);
    expect(rejection?.passed).toBe(true);
    const stopped = await runChecks(repoDir, rejectionCase.checks);
    expect(stopped.every((check) => check.passed)).toBe(true);
    const [mutation] = await runChecks(repoDir, [
      {
        name: "simulate incorrect continuation",
        run: "printf '%s\\n' 'export const migrationMode = () => \"strict\";' >>src/migration.js",
      },
    ]);
    expect(mutation?.passed).toBe(true);
    const continued = await runChecks(repoDir, rejectionCase.checks);
    const failed = continued.filter((check) => !check.passed);
    expect(failed.map((check) => check.name)).toEqual([
      "rejected approval leaves tracked repository content unchanged",
    ]);
    expect(failed[0]?.detail).toContain("src/migration.js");
  } finally {
    await destroyFixture(repoDir);
  }
});
