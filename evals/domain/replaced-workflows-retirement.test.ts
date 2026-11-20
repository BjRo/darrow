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

// #340: exact published adoption boundary; the manifest is the installer input.
test("marketplace publishes exactly the ten selected plugins with paired entrypoints", async () => {
  const marketplace = JSON.parse(
    await readFile(resolve(root, ".claude-plugin/marketplace.json"), "utf8"),
  );
  expect(
    marketplace.plugins.map((entry: { name: string }) => entry.name).sort(),
  ).toEqual([
    "darrow-adaptive-goal",
    "darrow-artificer",
    "darrow-explanation",
    "darrow-git",
    "darrow-information-architecture",
    "darrow-matt-pocock",
    "darrow-pstack",
    "darrow-readiness-gate",
    "darrow-review",
    "darrow-ticket-to-pr",
  ]);
  for (const entry of marketplace.plugins) {
    const claude = JSON.parse(
      await readFile(
        resolve(root, entry.source, ".claude-plugin/plugin.json"),
        "utf8",
      ),
    );
    const codex = JSON.parse(
      await readFile(
        resolve(root, entry.source, ".codex-plugin/plugin.json"),
        "utf8",
      ),
    );
    expect(claude.name).toBe(entry.name);
    expect(codex.name).toBe(entry.name);
    expect(codex.version).toBe(claude.version);
    expect(codex.skills).toBe("./skills/");
  }
});
