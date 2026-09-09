import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { runChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

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
