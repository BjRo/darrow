import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

const plugin = new URL(
  "../../plugins/task-recipe/darrow-ticket-to-pr/",
  import.meta.url,
);
const source = new URL(
  "skills/ticket-to-pr/evals/composition-replacement.yaml",
  plugin,
);

for (const shell of ["bash", "/bin/bash"]) {
  test(`ticket CI fixture binds required checks to the published commit (${shell})`, async () => {
    const { fixture, checks } = await readFixtureCase(source);
    const oracle = checks.find((check) =>
      check.name.includes("required CI was observed"),
    );
    if (!oracle) throw new Error("final-commit CI oracle is missing");
    const observe = `${shell} .git/fixture-bin/fixture-ci "$(git rev-parse HEAD)"`;
    const result = await runFixtureChecks({
      source,
      fixture,
      fixtureAssets: plugin,
      checks: [
        {
          name: "unpublished local commit has no remote CI evidence",
          run: observe,
          exit_code: 1,
        },
        {
          name: "publish the intended local commit",
          run: "git push origin fix/GH-42-timeout",
        },
        ...["failure", "pending", "unavailable", "absent", "stale"].map(
          (state) => ({
            name: `${state} required checks cannot establish green CI`,
            run: `printf '%s\\n' ${state} >.git/fixture-ci-state && ${observe}`,
            exit_code: 1,
          }),
        ),
        {
          name: "old green evidence cannot establish final-commit CI",
          run: `printf '%s\\tsuccess\\n' "$(git rev-parse HEAD~)" >>.fixture-state/ci-observations && (${oracle.run})`,
          exit_code: 1,
        },
        {
          name: "passing required checks establish final-commit CI",
          run: `printf '%s\\n' success >.git/fixture-ci-state && ${observe} && (${oracle.run})`,
          expect_regex: "required-ci: success",
        },
        {
          name: "observing another commit is refused",
          run: `${shell} .git/fixture-bin/fixture-ci "$(git rev-parse HEAD~)"`,
          exit_code: 1,
        },
      ],
    });
    expect(result.exitCode, result.diagnostic).toBe(0);
    expect(result.value.task.verdict).toBe("passed");
    expect(result.checks.every((check) => check.status === "passed")).toBe(
      true,
    );
  }, 30_000);
}
