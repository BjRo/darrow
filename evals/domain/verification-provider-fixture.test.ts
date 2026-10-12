import { test } from "bun:test";
import { runFixtureChecks } from "./fixture-command";

test("Verification prepares its declared Review validator before marketplace mounting", async () => {
  await runFixtureChecks({
    source: new URL(
      "../../plugins/capability/darrow-verification/skills/verify-change/evals/existing-review.yaml",
      import.meta.url,
    ),
    fixtureAssets: new URL("../../plugins/capability/", import.meta.url),
    setupPrefix: "test ! -e .sevro-marketplace",
    checks: [
      {
        name: "prepared validator and frozen package inputs exist",
        run: "test -s .git/eval-checks/review/src/darrow_review/result.py && test -s .git/eval-checks/review/src/darrow_review/report.py && test -s .git/eval-checks/review/pyproject.toml && test -s .git/eval-checks/review/uv.lock",
      },
      {
        name: "candidate checksum receipt is retained",
        run: "cksum config.json >.git/current-config && cmp CANDIDATE.txt .git/current-config",
      },
    ],
  });
}, 30_000);
