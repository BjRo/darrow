import { expect, test } from "bun:test";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/real-create-commit-composition.yaml",
  import.meta.url,
);
const gitPlugin = new URL(
  "../../plugins/capability/darrow-git/",
  import.meta.url,
);
const notes = "# Notes\nReal commit capability composes.\n";
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const reviewCheck =
  "review clears the final uncommitted candidate before commit";
const commit =
  "uv run --quiet --frozen --no-dev --project .git/eval-plugin/backend darrow-create-commit";

async function realCommitFixture() {
  const { fixture } = await readFixtureCase(source);
  const runtime = await prepareUvFixtureRuntime();
  const files: Record<string, string> = {};
  const backend = new URL("backend/", gitPlugin);
  for (const name of ["pyproject.toml", "uv.lock", "scripts/run_locked.py"])
    files[`.fixture-plugin/backend/${name}`] = await Bun.file(
      new URL(name, backend),
    ).text();
  for await (const name of new Bun.Glob("src/**/*.{py,typed,md}").scan(
    backend.pathname,
  ))
    files[`.fixture-plugin/backend/${name}`] = await Bun.file(
      new URL(name, backend),
    ).text();
  for (const manifest of [
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
  ])
    files[`.fixture-plugin/${manifest}`] = await Bun.file(
      new URL(manifest, gitPlugin),
    ).text();
  fixture.files = { ...fixture.files, ...files };
  fixture.bin = { ...fixture.bin, ...runtime.bin };
  fixture.setup = `${runtime.setupPrefix}\n${fixture.setup ?? ""}\nmv .fixture-plugin .git/eval-plugin\nuv sync --quiet --frozen --no-dev --project .git/eval-plugin/backend`;
  return fixture;
}

function publicationActions(): OracleCheck[] {
  return [
    {
      name: "write requested note",
      run: `printf '%s' ${quote(notes)} >NOTES.md`,
    },
    { name: "current check", run: "bash check.sh" },
    { name: "actual review", run: "independent-review-protocol" },
    {
      name: "real helper records hook failure",
      run: `${commit} commit -m 'docs: add real-commit note' NOTES.md`,
      exit_code: 4,
    },
    {
      name: "real helper executes the authorized guarded remediation",
      run: `${commit} remediate --after-hook-failure --command ${quote("grep -Fx 'Real commit capability composes.' NOTES.md >/dev/null")} --refresh-staged NOTES.md -m 'docs: add real-commit note'`,
    },
    {
      name: "publish and inspect fixture PR",
      run: "git push -u origin HEAD && gh pr create --title 'Add note' --body 'Add requested note' --base main --head fix/real-create-commit-composition && gh repo view fixture/repository && gh pr list --repo fixture/repository",
    },
  ];
}

for (const scenario of [
  "normal",
  "help",
  "missing",
  "duplicate",
  "stale",
] as const) {
  test(`real commit composition review evidence: ${scenario}`, async () => {
    const canonical = await readFixtureCase(source);
    const check = canonical.checks.find((entry) => entry.name === reviewCheck);
    if (!check)
      throw new Error("canonical composition review oracle is missing");
    const actions = publicationActions();
    if (scenario === "help")
      actions.unshift({
        name: "read-only help before implementation",
        run: "independent-review-protocol --help",
      });
    const log = ".git/fixture-state/composition-events";
    const alteration = {
      normal: "true",
      help: "true",
      missing: `awk -F '\\t' '$1 != "review" { print }' ${log} >.git/altered-events && mv .git/altered-events ${log}`,
      duplicate: `awk -F '\\t' '{ print; if ($1 == "review" && !duplicated++) print }' ${log} >.git/altered-events && mv .git/altered-events ${log}`,
      stale: `awk -F '\\t' '$1 == "review" { print "review\\tWORKTREE@stale"; next } { print }' ${log} >.git/altered-events && mv .git/altered-events ${log}`,
    }[scenario];
    actions.push({
      name: "select review evidence counterexample",
      run: alteration,
    });
    const passes = scenario === "normal" || scenario === "help";
    const diagnosis: OracleCheck[] = passes
      ? []
      : [
          {
            name: "rejection explains the review evidence defect",
            run: check.run,
            exit_code: 1,
            expect_regex: {
              missing: "Expected one review record; observed 0",
              duplicate: "Expected one review record; observed 2",
              stale: "Expected reviewed target:",
            }[scenario],
          },
        ];
    const result = await runFixtureChecks({
      source,
      fixture: await realCommitFixture(),
      checks: [...actions, ...canonical.checks, ...diagnosis],
    });
    expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
    expect(
      result.checks.slice(0, actions.length).map((entry) => entry.status),
    ).toEqual(actions.map(() => "passed"));
    if (passes)
      expect(result.checks.every((entry) => entry.status === "passed")).toBe(
        true,
      );
    else {
      expect(
        result.checks.find((entry) => entry.name === reviewCheck)?.status,
      ).toBe("failed");
      expect(result.checks.at(-1)?.status).toBe("passed");
    }
  }, 30_000);
}

for (const [arg, exitCode] of [
  ["--help", 0],
  ["-h", 0],
  ["unexpected", 2],
] as const) {
  test(`real commit reviewer ${arg} has no assessment effects`, async () => {
    const result = await runFixtureChecks({
      source,
      checks: [
        {
          name: "usage",
          run: `independent-review-protocol ${arg}`,
          exit_code: exitCode,
        },
        {
          name: "no assessment or mutation",
          run: 'test ! -e .git/fixture-state/composition-events && test ! -e .git/fixture-state/pull-requests && test "$(git rev-list --count HEAD)" -eq 1 && test -z "$(git status --porcelain)"',
        },
      ],
    });
    expect(result.exitCode, result.diagnostic).toBe(0);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe("passed");
    expect(result.checks.map((entry) => entry.status)).toEqual([
      "passed",
      "passed",
    ]);
  }, 30_000);
}

for (const scenario of [
  "correct",
  "wrong-content",
  "failed-check",
  "extra-file",
] as const) {
  test(`real commit reviewer checks current acceptance: ${scenario}`, async () => {
    const canonical = await readFixtureCase(source);
    if (scenario === "failed-check") {
      const files = canonical.fixture.commits?.[0]?.files;
      if (!files) throw new Error("canonical initial files are missing");
      files["check.sh"] = "#!/usr/bin/env bash\nexit 7\n";
    }
    const contents =
      scenario === "wrong-content" ? "# Notes\nWrong line.\n" : notes;
    const recorded = `awk -F '\\t' '$1 == "review" { found = 1 } END { exit !found }' .git/fixture-state/composition-events`;
    const result = await runFixtureChecks({
      source,
      fixture: canonical.fixture,
      checks: [
        {
          name: "prepare current candidate",
          run: `printf '%s' ${quote(contents)} >NOTES.md${scenario === "extra-file" ? " && printf '%s\\n' 'Unrequested content' >unrelated.txt" : ""}`,
        },
        {
          name: "current independent evidence",
          run: "independent-review-protocol",
          ...(scenario === "correct"
            ? {
                expect_regex:
                  "Acceptance evidence:[\\s\\S]+Standards evidence:[\\s\\S]+Check evidence: bash check.sh passed",
              }
            : { exit_code: 1 }),
        },
        {
          name: "review record matches acceptance",
          run:
            scenario === "correct"
              ? recorded
              : `if test -f .git/fixture-state/composition-events; then ! ${recorded}; fi`,
        },
      ],
    });
    expect(result.exitCode, result.diagnostic).toBe(0);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe("passed");
    expect(result.checks.map((entry) => entry.status)).toEqual([
      "passed",
      "passed",
      "passed",
    ]);
  }, 30_000);
}
