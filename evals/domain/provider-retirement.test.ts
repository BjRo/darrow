import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

// #339's repository cutover boundary. This does not claim native host outcomes.
test.each([
  [
    "capability/darrow-tickets",
    [
      "create-ticket",
      "read-ticket",
      "update-ticket",
      "list-tickets",
      "install-ticket-templates",
    ],
  ],
  ["foundation/darrow-decisions", ["capture-decision", "list-decisions"]],
  [
    "foundation/darrow-skill-authoring",
    ["create-agent-skill", "audit-agent-skill"],
  ],
] as const)(
  "retired provider %s has no maintained payload or execution obligation",
  async (relative, skills) => {
    const plugin = `plugins/${relative}`;
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
    expect(payload.stdout.toString(), "maintained provider payload").toBe("");
    // Local ignored caches may remain; an executable public package may not.
    for (const path of [
      ".claude-plugin/plugin.json",
      ".codex-plugin/plugin.json",
      "backend/pyproject.toml",
      "backend/uv.lock",
      "backend/scripts/run_locked.py",
      "hooks/hooks.json",
      ...skills.map((skill) => `skills/${skill}/SKILL.md`),
    ])
      expect(existsSync(resolve(root, plugin, path)), path).toBe(false);
    for (const path of [
      "python-packages.txt",
      ".github/workflows/python-quality.yml",
      "scripts/detect-python-quality-changes",
      "evals/experiments/orchestration/prepare-value.ts",
    ])
      expect(await readFile(resolve(root, path), "utf8"), path).not.toContain(
        relative.split("/")[1]!,
      );
  },
);

test("ordinary decision maintenance has no provider-specific validator command", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  expect(packageJson.scripts).not.toHaveProperty("check:decisions");
  expect(
    existsSync(resolve(root, "evals/sevro-extension/runtime-tickets.json")),
  ).toBe(false);
});
