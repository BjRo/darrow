import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

const plugin = new URL(
  "../../plugins/capability/darrow-tickets/",
  import.meta.url,
);
const source = new URL(
  "skills/create-ticket/evals/bug-regression-template.yaml",
  plugin,
);
const runtimeConfig = new URL(
  "../sevro-extension/runtime-repository-skills.json",
  import.meta.url,
);

for (const [variant, body, expected] of [
  [
    "valid incident and regression evidence",
    "TypeError: missing header. Expected: validation error. Reproduce with bun test csv-import --case empty-header. Require regression coverage, before original failure evidence, and after passing result evidence.\n",
    "passed",
  ],
  ["missing incident and reproducer", "Fix the import bug.\n", "failed"],
] as const) {
  test(`ticket bug-fix oracle grades ${variant} from excluded tracker state`, async () => {
    const canonical = await readFixtureCase(source);
    const quoted = `'${body.replaceAll("'", "'\\''")}'`;
    const result = await runFixtureChecks({
      source,
      runtimeConfig,
      fixture: {
        commits: canonical.fixture.commits,
      },
      checks: [
        {
          name: "fixture supplies an independent tracker outcome",
          run: `mkdir -p .fixture-state/gh
printf '%s' ${quoted} >.fixture-state/gh/created-body
printf '99\n' >.fixture-state/gh/created-ids
printf 'bug\n' >.fixture-state/gh/created-labels
test ! -d .git/fixture-gh`,
        },
        ...canonical.checks,
        {
          name: "mock tracker state remains excluded from product changes",
          run: "git status --porcelain --untracked-files=all -- .fixture-state",
          expect_exact: "",
        },
      ],
    });
    expect(result.value.execution.status, result.diagnostic).toBe("completed");
    expect(result.value.grading.status, result.diagnostic).toBe("completed");
    expect(result.checks[0]?.status, result.diagnostic).toBe("passed");
    expect(result.checks[2]?.status, result.diagnostic).toBe(expected);
    expect(result.checks[3]?.status, result.diagnostic).toBe(expected);
    expect(result.checks.at(-1)?.status, result.diagnostic).toBe("passed");
    expect(result.exitCode, result.diagnostic).toBe(
      expected === "passed" ? 0 : 1,
    );
  }, 120_000);
}
