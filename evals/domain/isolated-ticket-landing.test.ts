import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

for (const kind of ["conflict", "stale-tip"]) {
  const source = new URL(
    `../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/isolated-ticket-${kind}-decision.yaml`,
    import.meta.url,
  );
  const selected = parse(readFileSync(source, "utf8")) as {
    fixture: { commits: { files: Record<string, string> }[]; setup: string };
    checks: { run: string }[];
  };
  const initial = selected.fixture.commits[0];
  const check = selected.checks[0];
  assert.ok(initial);
  assert.ok(check);
  for (const effect of ["preserved", "user-edit", "index-edit"]) {
    test(`${kind} decision oracle rejects ${effect} state changes`, () => {
      const root = mkdtempSync(join(tmpdir(), "darrow-landing-oracle-"));
      const git = (...args: string[]) => {
        const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      };
      try {
        git("init", "-b", "main");
        git("config", "user.name", "Fixture");
        git("config", "user.email", "fixture@example.invalid");
        for (const [name, value] of Object.entries(initial.files))
          writeFileSync(join(root, name), value);
        git("add", ".");
        git("commit", "-m", "chore: initial");
        const setup = spawnSync(
          "/bin/sh",
          ["-eu", "-c", selected.fixture.setup],
          {
            cwd: root,
            encoding: "utf8",
          },
        );
        assert.equal(setup.status, 0, setup.stderr);
        if (effect === "user-edit")
          writeFileSync(join(root, "PERSONAL.md"), "lost\n");
        if (effect === "index-edit") git("rm", "--cached", "-f", "shared.txt");
        const result = spawnSync("/bin/sh", ["-c", check.run], {
          cwd: root,
          encoding: "utf8",
        });
        assert.equal(
          result.status === 0,
          effect === "preserved",
          result.stderr,
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
}
