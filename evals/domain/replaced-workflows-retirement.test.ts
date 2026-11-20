import { expect, test } from "bun:test";
import { existsSync, lstatSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

// #338: maintained package and repository execution surfaces, not host outcomes.
test("replaced workflows have no maintained payload or execution obligations", async () => {
  for (const name of ["discovery", "tdd", "principles", "verification"]) {
    const plugin = `plugins/capability/darrow-${name}`;
    const payload = Bun.spawnSync(
      [
        "git",
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        plugin,
      ],
      { cwd: root },
    );
    expect(payload.exitCode, payload.stderr.toString()).toBe(0);
    const maintained = payload.stdout
      .toString()
      .split("\0")
      .filter(
        (path) =>
          path && lstatSync(resolve(root, path), { throwIfNoEntry: false }),
      );
    // Ignore local caches, and allow this oracle to run before deletion is committed.
    expect(maintained, `${name}: maintained payload`).toEqual([]);
    for (const path of [
      ".claude-plugin/plugin.json",
      ".codex-plugin/plugin.json",
      "hooks/hooks.json",
      "hooks/codex-hooks.json",
      "backend/pyproject.toml",
      "backend/uv.lock",
      "backend/scripts/run_locked.py",
      "skills/work-through-decisions/SKILL.md",
      "skills/work-through-decisions/backend/pyproject.toml",
      "skills/work-through-decisions/backend/scripts/run_locked.py",
      "skills/tdd/SKILL.md",
      "skills/principles-first/SKILL.md",
      "skills/setup-principles/SKILL.md",
      "skills/verify-change/SKILL.md",
    ])
      expect(existsSync(resolve(root, plugin, path)), `${name}: ${path}`).toBe(
        false,
      );
    for (const path of [
      "python-packages.txt",
      ".github/workflows/python-quality.yml",
      "scripts/detect-python-quality-changes",
    ])
      expect(await readFile(resolve(root, path), "utf8"), path).not.toContain(
        `darrow-${name}`,
      );
  }
  expect(
    existsSync(resolve(root, "evals/sevro-extension/runtime-tdd.json")),
  ).toBe(false);
  for (const name of ["discovery", "tdd"]) {
    const directory = resolve(root, "evals/experiments", name);
    const files = existsSync(directory) ? await readdir(directory) : [];
    expect(
      files.filter((file) => file.endsWith(".yaml")),
      `${name}: active suites`,
    ).toEqual([]);
  }
});
