import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import { runChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

test("composition records only successful UV publication", async () => {
  const path = resolve(
    import.meta.dir,
    "../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/composition-existing-pr.yaml",
  );
  const entry = parse(await readFile(path, "utf8")) as EvalCase;
  const repo = await buildFixture({
    fixture: entry.fixture,
    caseDir: dirname(path),
    skillDir: resolve(
      import.meta.dir,
      "../../plugins/capability/darrow-git/skills/create-pr",
    ),
    skillMounts: [],
    sourceClaudePlugin: true,
  });
  const command =
    "uv run --quiet --frozen --no-dev --project .git/eval-plugin/backend darrow-create-pr";
  try {
    const results = await runChecks(repo, [
      {
        name: "inspection is not publication",
        run: `${command} inspect && test ! -e .git/builtin-publications`,
      },
      {
        name: "stale remote refuses verification",
        run: `${command} verify --expected-head "$(git rev-parse HEAD)"`,
        exit_code: 4,
      },
      {
        name: "failure is not evidence",
        run: "test ! -e .git/builtin-publications",
      },
      {
        name: "publish current commit",
        run: `${command} publish-existing --expected-head "$(git rev-parse HEAD)"`,
      },
      {
        name: "verify current commit",
        run: `${command} verify --expected-head "$(git rev-parse HEAD)"`,
      },
      {
        name: "exact successful observations",
        run: 'test "$(wc -l < .git/builtin-publications | tr -d " ")" = 2 && test "$(sort -u .git/builtin-publications)" = "$(git rev-parse HEAD)" && test ! -e .git/forbidden-forge-effects',
      },
    ]);
    expect(results.filter((result) => !result.passed)).toEqual([]);
  } finally {
    await destroyFixture(repo);
  }
}, 30000);

test("ticket-to-pr options oracle preserves a stricter caller repair limit", async () => {
  const path = resolve(
    import.meta.dir,
    "../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/explicit-options-delegation.yaml",
  );
  const evalCase = parse(await readFile(path, "utf8")) as EvalCase;
  const repoDir = await buildFixture({
    skillDir: "",
    skillMounts: [],
    fixture: { commits: evalCase.fixture.commits, bin: evalCase.fixture.bin },
  });
  try {
    const record =
      "record-ticket-to-pr-options https://example.invalid/tickets/99 release/2.x draft";
    const results = await runChecks(repoDir, [
      { name: "missing repair limit is rejected", run: record, exit_code: 1 },
      {
        name: "default cannot replace explicit limit",
        run: `${record} 2 && (${evalCase.checks[0]!.run})`,
        exit_code: 1,
      },
      {
        name: "omitted caller limit fails the oracle",
        run: `${record} unspecified && (${evalCase.checks[0]!.run})`,
        exit_code: 1,
      },
      { name: "explicit limit is accepted", run: `${record} 1` },
      evalCase.checks[0]!,
      {
        name: "changed receipt fails the oracle",
        run: `printf '%s\\t%s\\t%s\\t%s\\n' https://example.invalid/tickets/99 release/2.x draft 2 >.git/ticket-to-pr-options && (${evalCase.checks[0]!.run})`,
        exit_code: 1,
      },
    ]);
    expect(results.filter((result) => !result.passed)).toEqual([]);
  } finally {
    await destroyFixture(repoDir);
  }
});

for (const variant of ["existing-pr", "replacement"]) {
  test(`composition ${variant} ticket and oracle agree on trailing newlines`, async () => {
    const path = resolve(
      import.meta.dir,
      `../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/composition-${variant}.yaml`,
    );
    const evalCase = parse(await readFile(path, "utf8")) as EvalCase;
    const repoDir = await buildFixture({
      skillDir: "",
      skillMounts: [],
      fixture: { commits: evalCase.fixture.commits, bin: evalCase.fixture.bin },
    });
    try {
      const results = await runChecks(repoDir, [
        {
          name: "ticket states the oracle's newline policy",
          run: "fetch-work-item https://example.invalid/tickets/42",
          expect_regex: "Trailing newlines are insignificant",
        },
        {
          name: "exact content without a newline passes",
          run: `printf '%s' '{"timeoutMs":2500}' >config.json && bash check.sh`,
        },
        {
          name: "exact content with trailing newlines passes",
          run: `printf '%s\\n\\n' '{"timeoutMs":2500}' >config.json && bash check.sh`,
        },
        {
          name: "wrong value remains rejected",
          run: `printf '%s\\n' '{"timeoutMs":2501}' >config.json && bash check.sh`,
          exit_code: 1,
        },
        {
          name: "extra content remains rejected",
          run: `printf '%s\\n' '{"timeoutMs":2500}' 'extra' >config.json && bash check.sh`,
          exit_code: 1,
        },
      ]);
      expect(results.filter((result) => !result.passed)).toEqual([]);
    } finally {
      await destroyFixture(repoDir);
    }
  });
}
