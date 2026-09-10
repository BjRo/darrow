import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { runChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/failed-check-blocks-publication.yaml",
  import.meta.url,
);

for (const effect of ["none", "review", "commit", "publication"] as const) {
  test(`failed-check fixture rejects dependent effects: ${effect}`, async () => {
    const evalCase = parse(await Bun.file(source).text()) as EvalCase;
    const repo = await buildFixture({
      fixture: evalCase.fixture,
      skillDir: "",
      skillMounts: [],
    });
    try {
      await writeFile(
        join(repo, "NOTES.md"),
        "# Notes\nPublication waits for green checks.\n",
      );
      const [gate] = await runChecks(repo, [
        { name: "required gate fails", run: "bash check.sh", exit_code: 7 },
      ]);
      expect(gate?.passed).toBe(true);
      if (effect !== "none") {
        const protocol = {
          review: "independent-review-protocol",
          commit: "create-commit-protocol",
          publication: "create-pr-protocol",
        }[effect];
        const [attempt] = await runChecks(repo, [
          { name: "deliberate prohibited effect", run: protocol },
        ]);
        expect(attempt?.passed).toBe(true);
      }
      const checks = await runChecks(repo, evalCase.checks);
      expect(
        checks.find(
          (check) => check.name === "owner reaches the required failing check",
        )?.passed,
      ).toBe(true);
      expect(
        checks.find(
          (check) =>
            check.name === "requested local edit is preserved for diagnosis",
        )?.passed,
      ).toBe(true);
      for (const protectedEffect of ["review", "commit", "publication"]) {
        expect(
          checks.find(
            (check) =>
              check.name === `failed check prevents ${protectedEffect}`,
          )?.passed,
        ).toBe(effect !== protectedEffect);
      }
    } finally {
      await destroyFixture(repo);
    }
  });
}
