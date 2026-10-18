import { expect, test } from "bun:test";
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";
import { policyProject, runPolicyPrompt } from "./policy-project";

for (const name of ["default-branch-refuse", "dup-stop"]) {
  test(`PR absence detects title-free creation: ${name}`, async () => {
    const source = new URL(
      `../../plugins/capability/darrow-git/skills/create-pr/evals/${name}.yaml`,
      import.meta.url,
    );
    const canonical = await readFixtureCase(source);
    const absence = canonical.checks.find(
      (check) =>
        check.name === "no PR created" || check.name === "no second PR created",
    );
    if (!absence)
      throw new Error("missing canonical publication absence check");
    const result = await runFixtureChecks({
      source,
      fixture: canonical.fixture,
      checks: [
        { ...absence, name: "pristine state" },
        {
          ...absence,
          name: "help stays read-only",
          run: `gh pr create --help >.fixture-state/absence-help-output\n${absence.run}`,
        },
        {
          ...absence,
          name: "title-free creation cannot pass absence",
          run: `gh pr create --fill >.fixture-state/absence-create-output\n${absence.run}`,
        },
      ],
    });
    expect(result.value.execution.status, result.diagnostic).toBe("completed");
    expect(result.value.grading.status, result.diagnostic).toBe("completed");
    expect(
      result.checks.map((check) => check.status),
      result.diagnostic,
    ).toEqual(["passed", "passed", "failed"]);
  }, 120_000);
}

test("PR fixture help stays read-only while creation records the action", async () => {
  const directory = new URL(
    "../../plugins/capability/darrow-git/skills/create-pr/evals/",
    import.meta.url,
  );
  const cases = [];
  for (const name of (await readdir(directory)).sort()) {
    if (!name.endsWith(".yaml")) continue;
    const canonical = await readFixtureCase(new URL(name, directory));
    const script = canonical.fixture.bin?.gh;
    if (script?.includes('"pr create")'))
      cases.push({ id: canonical.id, script });
  }
  expect(cases.length).toBeGreaterThan(0);
  const result = await runFixtureChecks({
    source: new URL("template-fill.yaml", directory),
    fixture: {
      commits: [
        { message: "chore: init", files: { "README.md": "fixture\n" } },
      ],
      files: Object.fromEntries(
        cases.map(({ id, script }) => [
          `.fixture-state/gh-help-cases/${id}.sh`,
          script,
        ]),
      ),
    },
    checks: cases.map(({ id }) => ({
      name: `${id} preserves help and creation behavior`,
      run: [
        "set -eu",
        "for shell in sh bash /bin/bash; do",
        "rm -rf .fixture-state/gh .fixture-state/gh-created",
        "for flag in --help -h; do",
        `  "$shell" .fixture-state/gh-help-cases/${id}.sh pr create "$flag" >.fixture-state/gh-help-output`,
        "  test ! -e .fixture-state/gh",
        "  test ! -e .fixture-state/gh-created",
        "  grep -q 'Usage:' .fixture-state/gh-help-output",
        "  ! grep -q 'https://github.com/.*/pull/' .fixture-state/gh-help-output",
        "done",
        `"$shell" .fixture-state/gh-help-cases/${id}.sh pr create --title 'feat: probe' --body 'probe body' --base main --head feat/probe >.fixture-state/gh-create-output`,
        "test -d .fixture-state/gh",
        "if test -f .fixture-state/gh/body; then",
        "test \"$(cat .fixture-state/gh/body)\" = 'probe body'",
        'test "$(cat .fixture-state/gh/head)" = feat/probe',
        "else test -f .fixture-state/gh/created; fi",
        "grep -Eq '^https://github.com/fixture/repo/pull/[0-9]+$' .fixture-state/gh-create-output",
        "done",
      ].join("\n"),
    })),
  });
  expect(result.value.execution.status, result.diagnostic).toBe("completed");
  expect(result.value.grading.status, result.diagnostic).toBe("completed");
  expect(
    result.checks.map((check) => check.status),
    result.diagnostic,
  ).toEqual(cases.map(() => "passed"));
}, 120_000);

test("correlated-branch guard accounts for declared mounts without accepting ignore changes", async () => {
  const source = new URL(
    "../../plugins/capability/darrow-git/skills/prepare-task-branch/evals/guard-correlated-creation.yaml",
    import.meta.url,
  );
  const canonical = await readFixtureCase(source);
  const preservation = canonical.checks.find(
    (check) =>
      check.name === "dirty work and ignore configuration remain unchanged",
  );
  if (!preservation) throw new Error("missing canonical preservation oracle");
  const mutations = [
    [
      "extra user rule",
      "printf '/unexpected-user-rule/\\n' >>.git/info/exclude",
    ],
    [
      "undeclared mount rule",
      "printf '/.agents/undeclared.dat\\n' >>.git/info/exclude",
    ],
    [
      "changed original configuration",
      'python3 -c \'from pathlib import Path; p=Path(".git/info/exclude"); p.write_bytes(b"# changed baseline\\n"+p.read_bytes())\'',
    ],
    [
      "repeated mount rule",
      'python3 -c \'from pathlib import Path; p=Path(".git/info/exclude"); line=next(x for x in p.read_bytes().splitlines() if x.startswith(b"/.agents/")); p.write_bytes(p.read_bytes()+line+b"\\n")\'',
    ],
  ];
  const project = await policyProject({
    prompt: "Return ready.",
    fixture: canonical.fixture,
    checks: [
      preservation,
      ...mutations.map(([name, mutation]) => ({
        ...preservation,
        name,
        run: [
          "set -eu",
          "cp .git/info/exclude .fixture-state/oracle-exclude-backup",
          "trap 'cp .fixture-state/oracle-exclude-backup .git/info/exclude' EXIT",
          mutation,
          preservation.run,
        ].join("\n"),
      })),
    ],
  });
  await writeFile(
    join(project.root, "plugins/capability/sample/skills/grilling/read me.txt"),
    "literal mount path with a space\n",
  );
  const result = await runPolicyPrompt(project, "codex", "Return ready.");
  expect(result.value.execution.status, result.diagnostic).toBe("completed");
  expect(result.value.grading.status, result.diagnostic).toBe("completed");
  expect(
    result.value.cases[0]?.trials[0]?.checks.map((check) => check.status),
    result.diagnostic,
  ).toEqual(["passed", "failed", "failed", "failed", "failed", "passed"]);
}, 30_000);

test("PR motivation oracle accepts a leading failure word and rejects placeholder content", async () => {
  const source = new URL(
    "../../plugins/capability/darrow-git/skills/create-pr/evals/template-fill.yaml",
    import.meta.url,
  );
  const canonical = await readFixtureCase(source);
  const motivation = canonical.checks.find(
    (check) => check.name === "Why section filled with the motivation",
  );
  if (!motivation) throw new Error("missing canonical motivation oracle");
  const result = await runFixtureChecks({
    source,
    fixture: {
      commits: [{ message: "Initial", files: { "README.md": "fixture\n" } }],
      files: {
        ".fixture-state/valid-body.md":
          "  ## Why\n\nFailed HTTP requests need another opportunity to succeed after transient errors. Refs DAR-123; no ticket URL was supplied.\n\n  ## What Changed\n\nAdd bounded retries with exponential backoff.\n",
        ".fixture-state/placeholder-body.md":
          "  ## Why\n\nN/A\n\n  ## What Changed\n\nAdd bounded retries with exponential backoff.\n",
      },
    },
    checks: [
      {
        ...motivation,
        name: "retained valid motivation beginning with Failed",
        run:
          "mkdir -p .fixture-state/gh && cp .fixture-state/valid-body.md .fixture-state/gh/body\n" +
          motivation.run,
      },
      {
        ...motivation,
        name: "placeholder motivation remains rejected",
        run:
          "cp .fixture-state/placeholder-body.md .fixture-state/gh/body\n" +
          motivation.run,
      },
    ],
  });
  expect(result.value.execution.status, result.diagnostic).toBe("completed");
  expect(result.value.grading.status, result.diagnostic).toBe("completed");
  expect(result.checks.map((check) => check.status)).toEqual([
    "passed",
    "failed",
  ]);
}, 120_000);
