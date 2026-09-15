import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { runChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const src = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/verification-incomplete-blocks-publication.yaml",
  import.meta.url,
);

for (const protocol of [
  "inspect-delivery-protocol",
  "assess-delivery-protocol",
  "create-commit-protocol",
  "create-pr-protocol",
]) {
  for (const [argument, exitCode] of [
    ["--help", 0],
    ["-h", 0],
    ["unexpected", 2],
  ] as const) {
    test(`${protocol} ${argument} performs no effects`, async () => {
      const evalCase = parse(await Bun.file(src).text()) as EvalCase;
      const repo = await buildFixture({
        fixture: evalCase.fixture,
        skillDir: "",
        skillMounts: [],
      });
      try {
        await writeFile(
          join(repo, "NOTES.md"),
          "# Notes\nVerification precedes publication.\n",
        );
        const results = await runChecks(repo, [
          {
            name: "protocol usage",
            run: `${protocol} ${argument}`,
            exit_code: exitCode,
          },
          {
            name: "usage has no effects",
            run: 'test ! -e .git/fixture-state/gate-events && test ! -e .git/fixture-state/pull-request && test "$(git rev-list --count HEAD)" -eq 1 && test -z "$(git --git-dir=.git/fixture-remote.git for-each-ref --format=\'%(refname)\' refs/heads)"',
          },
        ]);
        expect(results[0]?.passed).toBe(true);
        expect(results[1]?.passed).toBe(true);
      } finally {
        await destroyFixture(repo);
      }
    });
  }
}

for (const effect of ["none", "commit", "publication"] as const) {
  test(`incomplete verification rejects dependent effects: ${effect}`, async () => {
    const evalCase = parse(await Bun.file(src).text()) as EvalCase;
    const repo = await buildFixture({
      fixture: evalCase.fixture,
      skillDir: "",
      skillMounts: [],
    });
    try {
      await writeFile(
        join(repo, "NOTES.md"),
        "# Notes\nVerification precedes publication.\n",
      );
      const setup = await runChecks(repo, [
        { name: "successful local check", run: "bash check.sh" },
        {
          name: "zero-exit incomplete assessment",
          run: "assess-delivery-protocol",
        },
      ]);
      expect(setup.every((check) => check.passed)).toBe(true);
      if (effect !== "none") {
        const [attempt] = await runChecks(repo, [
          {
            name: "deliberate prohibited effect remains executable",
            run:
              effect === "commit"
                ? "create-commit-protocol"
                : "create-pr-protocol",
          },
        ]);
        expect(attempt?.passed).toBe(true);
      }
      const checks = await runChecks(repo, evalCase.checks);
      expect(checks[0]?.passed).toBe(true);
      expect(checks[1]?.passed).toBe(true);
      for (const protectedEffect of ["commit", "publication"]) {
        expect(
          checks.find(
            (check) =>
              check.name ===
              `incomplete verification prevents ${protectedEffect}`,
          )?.passed,
        ).toBe(effect !== protectedEffect);
      }
    } finally {
      await destroyFixture(repo);
    }
  });
}

test("direct review without the verification operation cannot satisfy the observation", async () => {
  const evalCase = parse(await Bun.file(src).text()) as EvalCase;
  const repo = await buildFixture({
    fixture: evalCase.fixture,
    skillDir: "",
    skillMounts: [],
  });
  try {
    await writeFile(
      join(repo, "NOTES.md"),
      "# Notes\nVerification precedes publication.\n",
    );
    const setup = await runChecks(repo, [
      { name: "check", run: "bash check.sh" },
      { name: "direct review", run: "inspect-delivery-protocol" },
    ]);
    expect(setup.every((check) => check.passed)).toBe(true);
    const [observation] = await runChecks(repo, [evalCase.checks[0]!]);
    expect(observation?.passed).toBe(false);
  } finally {
    await destroyFixture(repo);
  }
});
