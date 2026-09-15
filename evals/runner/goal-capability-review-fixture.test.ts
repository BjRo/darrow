import { expect, test } from "bun:test";
import { parse } from "yaml";
import { runChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/file-backed-capability-routing.yaml",
  import.meta.url,
);
const correctNotes =
  "# Notes\nCapability routing survives file-backed goals.\n";

for (const scenario of [
  "correct",
  "wrong-content",
  "failed-check",
  "extra-file",
] as const) {
  test(`capability review supplies current evidence: ${scenario}`, async () => {
    const entry = parse(await Bun.file(source).text()) as EvalCase;
    if (scenario === "failed-check")
      entry.fixture.commits![0]!.files!["check.sh"] =
        "#!/usr/bin/env bash\nexit 7\n";
    const repo = await buildFixture({
      fixture: entry.fixture,
      skillDir: "",
      skillMounts: [],
    });
    try {
      await Bun.write(
        `${repo}/NOTES.md`,
        scenario === "wrong-content" ? "# Notes\nWrong line.\n" : correctNotes,
      );
      if (scenario === "extra-file")
        await Bun.write(`${repo}/unrelated.txt`, "Unrequested content\n");
      const [result] = await runChecks(repo, [
        {
          name: "current independent evidence",
          run: "independent-review-protocol independent-review-skill-contract-v1",
          ...(scenario === "correct"
            ? {
                expect_regex:
                  "Acceptance evidence:[\\s\\S]+Standards evidence:[\\s\\S]+Check evidence: bash check.sh passed",
              }
            : { exit_code: 1 }),
        },
      ]);
      expect(result?.passed).toBe(true);
      expect(
        await Bun.file(
          `${repo}/.git/fixture-state/independent-review-invocations`,
        ).exists(),
      ).toBe(scenario === "correct");
    } finally {
      await destroyFixture(repo);
    }
  });
}

for (const scenario of ["current", "missing", "duplicate", "stale"] as const) {
  test(`capability review oracle diagnoses ${scenario} evidence`, async () => {
    const entry = parse(await Bun.file(source).text()) as EvalCase;
    const repo = await buildFixture({
      fixture: entry.fixture,
      skillDir: "",
      skillMounts: [],
    });
    try {
      await Bun.write(`${repo}/NOTES.md`, correctNotes);
      const setup = await runChecks(repo, [
        {
          name: "review and commit",
          run: 'independent-review-protocol independent-review-skill-contract-v1 && create-commit-protocol NOTES.md "docs: add routing note" create-commit-skill-contract-v1',
        },
      ]);
      expect(setup[0]?.passed).toBe(true);
      const path = `${repo}/.git/fixture-state/independent-review-invocations`;
      const record = await Bun.file(path).text();
      if (scenario === "missing") await Bun.write(path, "");
      if (scenario === "duplicate") await Bun.write(path, record + record);
      if (scenario === "stale")
        await Bun.write(path, "WORKTREE@stale\tclear\tcomprehensive\n");
      const check = entry.checks.find(
        (value) =>
          value.name ===
          "selected independent review remains composed before publication",
      )!;
      const [result] = await runChecks(repo, [check]);
      expect(result?.passed).toBe(scenario === "current");
      if (scenario !== "current") {
        const message = {
          missing: "Missing independent review evidence",
          duplicate: "Expected one review record; observed 2",
          stale: "Expected reviewed target:",
        }[scenario];
        expect(result?.detail).toContain(message);
      }
    } finally {
      await destroyFixture(repo);
    }
  });
}
