import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

const root = await mkdtemp(join(tmpdir(), "darrow-verification-state-"));
afterAll(() => rm(root, { recursive: true, force: true }));
const runtimeConfig = pathToFileURL(join(root, "runtime.json"));
await writeFile(
  runtimeConfig,
  JSON.stringify({
    format: "sevro.runtime.v1",
    runtime: {
      artifactDirectories: [{ name: "reviews", path: ".darrow/reviews" }],
    },
  }),
);
const source = new URL(
  "../../plugins/capability/darrow-verification/skills/verify-change/evals/existing-review.yaml",
  import.meta.url,
);
const canonical = await readFixtureCase(source);
if (!canonical.fixture.setup?.startsWith("bash "))
  throw new Error("Canonical Verification setup must invoke its Bash helper");

for (const shell of ["bash", "/bin/bash"]) {
  test(`Verification prepares its Review validator and empty state: ${shell}`, async () => {
    const result = await runFixtureChecks({
      source,
      fixture: {
        ...canonical.fixture,
        setup: canonical.fixture.setup?.replace(/^bash /, `${shell} `),
      },
      fixtureAssets: new URL("../../plugins/capability/", import.meta.url),
      setupPrefix:
        'test ! -e .sevro-marketplace && test ! -e "$HOME/.darrow/reviews"',
      runtimeConfig,
      checks: [
        {
          name: "prepared validator and frozen package inputs exist",
          run: "test -s .git/eval-checks/review/src/darrow_review/result.py && test -s .git/eval-checks/review/src/darrow_review/report.py && test -s .git/eval-checks/review/pyproject.toml && test -s .git/eval-checks/review/uv.lock",
        },
        {
          name: "candidate checksum receipt is retained",
          run: "cksum config.json >.git/current-config && cmp CANDIDATE.txt .git/current-config",
        },
        {
          name: "empty provider state is readable before any report exists",
          run: 'test -d "${SEVRO_CANDIDATE_ARTIFACT_REVIEWS:?}" && test -z "$(find "$SEVRO_CANDIDATE_ARTIFACT_REVIEWS" -type f)"',
        },
      ],
    });
    expect(result.exitCode, result.diagnostic).toBe(0);
    expect(result.value.grading.status).toBe("completed");
    expect(result.checks.map((check) => check.status)).toEqual([
      "passed",
      "passed",
      "passed",
    ]);
  }, 30_000);
}
