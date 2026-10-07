import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runFixtureChecks } from "./fixture-command";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("Darrow commits case scaffolding and preserves exact local ticket round trips", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-ticket-domain-"));
  roots.push(root);
  const assets = join(root, "case");
  await mkdir(assets);
  await writeFile(join(assets, "marker.txt"), "prepared\n");
  const source = join(assets, "ticket.yaml");
  await writeFile(
    source,
    JSON.stringify({
      id: "ticket-round-trip",
      fixture: {
        commits: [
          {
            message: "Initial commit",
            files: { "README.md": "fixture\n" },
          },
        ],
        files: { "AGENTS.md": "evaluation guidance\n" },
        commit_files: true,
        ticket: {
          id: "17",
          title: "Implement the benchmark task",
          body: "Original ticket body\n",
        },
        setup: 'cp "{{case_dir}}/marker.txt" .git/setup-marker.txt',
      },
      checks: [],
    }),
  );
  const result = await runFixtureChecks({
    source: pathToFileURL(source),
    fixtureAssets: pathToFileURL(assets),
    checks: [
      {
        name: "scaffolding is committed and clean",
        run: 'test -z "$(git status --porcelain)" && git ls-files --error-unmatch AGENTS.md README.md',
      },
      {
        name: "setup reads its case asset",
        run: "printf 'prepared\\n' >.git/expected-marker.txt && cmp .git/setup-marker.txt .git/expected-marker.txt",
      },
      {
        name: "ticket body, alias, and ordered events remain exact",
        run: `set -eu
ticketctl get 17 --body-file .git/ticket-body.md >.git/ticket-get.txt
printf 'id: 17\\nstate: open\\ntitle: Implement the benchmark task\\n' >.git/expected-get.txt
cmp .git/ticket-get.txt .git/expected-get.txt
printf 'Original ticket body\\n' >.git/expected-original.md
cmp .git/ticket-body.md .git/expected-original.md
printf 'Updated ticket body\\n' >.git/replacement.md
ticketctl describe 17 --body-file .git/replacement.md
ticketctl get 17 --body-file .git/ticket-body.md >/dev/null
cmp .git/ticket-body.md .git/replacement.md
test -L .git/ticketctl.log
test "$(readlink .git/ticketctl.log)" = fixture-state/ticketctl.log
printf 'get 17\\ndescribe 17\\nget 17\\n' >.git/expected-ticket.log
cmp .git/fixture-state/ticketctl.log .git/expected-ticket.log
cmp .git/ticketctl.log .git/expected-ticket.log`,
      },
    ],
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((check) => check.status)).toEqual([
    "passed",
    "passed",
    "passed",
  ]);
}, 20_000);
