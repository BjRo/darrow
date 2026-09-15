import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { parse } from "yaml";
import { runChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/real-create-commit-composition.yaml",
  import.meta.url,
);
const commitSource = new URL(
  "../../plugins/capability/darrow-git/skills/create-commit/scripts/commit.sh",
  import.meta.url,
);
const notes = "# Notes\nReal commit capability composes.\n";
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
const reviewCheck =
  "review clears the final uncommitted candidate before commit";

async function publish(repo: string) {
  await writeFile(
    `${repo}/.git/real-commit.sh`,
    await Bun.file(commitSource).text(),
    { mode: 0o755 },
  );
  await Bun.write(`${repo}/NOTES.md`, notes);
  const checks = await runChecks(repo, [
    { name: "current check", run: "bash check.sh" },
    { name: "actual review", run: "independent-review-protocol" },
    {
      name: "real helper records hook failure",
      run: "bash .git/real-commit.sh commit -m 'docs: add real-commit note' NOTES.md",
      exit_code: 4,
    },
  ]);
  expect(checks.every((result) => result.passed)).toBe(true);
  const remediation = await runChecks(repo, [
    {
      name: "real helper executes the authorized guarded remediation",
      run: `bash .git/real-commit.sh remediate --after-hook-failure --command ${quote("grep -Fx 'Real commit capability composes.' NOTES.md >/dev/null")} --refresh-staged NOTES.md -m 'docs: add real-commit note'`,
    },
  ]);
  expect(remediation[0]?.passed).toBe(true);
  const publication = await runChecks(repo, [
    {
      name: "publish and inspect fixture PR",
      run: "git push -u origin HEAD && gh pr create --title 'Add note' --body 'Add requested note' --base main --head fix/real-create-commit-composition && gh repo view fixture/repository && gh pr list --repo fixture/repository",
    },
  ]);
  expect(publication[0]?.passed).toBe(true);
}

for (const scenario of [
  "normal",
  "help",
  "missing",
  "duplicate",
  "stale",
] as const) {
  test(`real commit composition review evidence: ${scenario}`, async () => {
    const entry = parse(await Bun.file(source).text()) as EvalCase;
    const repo = await buildFixture({
      fixture: entry.fixture,
      skillDir: "",
      skillMounts: [],
    });
    try {
      if (scenario === "help") {
        const [help] = await runChecks(repo, [
          {
            name: "read-only help before implementation",
            run: "independent-review-protocol --help",
          },
        ]);
        expect(help?.passed).toBe(true);
      }
      await publish(repo);
      const log = `${repo}/.git/fixture-state/composition-events`;
      const events = await Bun.file(log).text();
      if (scenario === "missing")
        await Bun.write(log, events.replace(/^review\t.*\n/gm, ""));
      if (scenario === "duplicate")
        await Bun.write(log, events.replace(/^(review\t.*\n)/m, "$1$1"));
      if (scenario === "stale")
        await Bun.write(
          log,
          events.replace(/^review\t.*$/m, "review\tWORKTREE@stale"),
        );
      const results = await runChecks(repo, entry.checks);
      if (scenario === "normal" || scenario === "help") {
        expect(results.every((result) => result.passed)).toBe(true);
      } else {
        const result = results.find((value) => value.name === reviewCheck);
        expect(result?.passed).toBe(false);
        expect(result?.detail).toContain(
          {
            missing: "Expected one review record; observed 0",
            duplicate: "Expected one review record; observed 2",
            stale: "Expected reviewed target:",
          }[scenario],
        );
      }
    } finally {
      await destroyFixture(repo);
    }
  });
}

for (const [arg, exitCode] of [
  ["--help", 0],
  ["-h", 0],
  ["unexpected", 2],
] as const) {
  test(`real commit reviewer ${arg} has no assessment effects`, async () => {
    const entry = parse(await Bun.file(source).text()) as EvalCase;
    const repo = await buildFixture({
      fixture: entry.fixture,
      skillDir: "",
      skillMounts: [],
    });
    try {
      const results = await runChecks(repo, [
        {
          name: "usage",
          run: `independent-review-protocol ${arg}`,
          exit_code: exitCode,
        },
        {
          name: "no assessment or mutation",
          run: 'test ! -e .git/fixture-state/composition-events && test ! -e .git/fixture-state/pull-requests && test "$(git rev-list --count HEAD)" -eq 1 && test -z "$(git status --porcelain)"',
        },
      ]);
      expect(results.every((result) => result.passed)).toBe(true);
    } finally {
      await destroyFixture(repo);
    }
  });
}

for (const scenario of [
  "correct",
  "wrong-content",
  "failed-check",
  "extra-file",
] as const) {
  test(`real commit reviewer checks current acceptance: ${scenario}`, async () => {
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
        scenario === "wrong-content" ? "# Notes\nWrong line.\n" : notes,
      );
      if (scenario === "extra-file")
        await Bun.write(`${repo}/unrelated.txt`, "Unrequested content\n");
      const [result] = await runChecks(repo, [
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
      ]);
      expect(result?.passed).toBe(true);
      const events = await Bun.file(
        `${repo}/.git/fixture-state/composition-events`,
      )
        .text()
        .catch(() => "");
      expect(/^review\t/m.test(events)).toBe(scenario === "correct");
    } finally {
      await destroyFixture(repo);
    }
  });
}
