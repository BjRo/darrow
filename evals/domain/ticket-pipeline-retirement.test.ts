import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dir, "../..");

// TP-R1 and TP-R3: the repository cutover boundary, not host task evidence.
test("ticket pipeline has no executable package, benchmark cell, or CI obligation", async () => {
  const plugin = "plugins/orchestration/darrow-ticket-pipeline";
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
  expect(payload.stdout.toString(), "maintained pipeline package payload").toBe(
    "",
  );

  // Ignored developer caches may remain, but public entrypoints must not.
  for (const path of [
    `${plugin}/.claude-plugin/plugin.json`,
    `${plugin}/.codex-plugin/plugin.json`,
    `${plugin}/backend/pyproject.toml`,
    `${plugin}/backend/uv.lock`,
    `${plugin}/backend/scripts/run_locked.py`,
    ...[
      "challenge-ticket",
      "codify-ticket",
      "deliver-ticket",
      "implement-ticket",
      "qa-ticket",
      "refine-ticket",
      "review-ticket",
      "rework-ticket",
    ].map((skill) => `${plugin}/skills/${skill}/SKILL.md`),
    "evals/experiments/orchestration/conditions/darrow-ticket-pipeline.md",
  ]) {
    expect(existsSync(resolve(root, path)), path).toBe(false);
  }
  for (const path of [
    "python-packages.txt",
    ".github/workflows/python-quality.yml",
    "scripts/detect-python-quality-changes",
  ]) {
    expect(await readFile(resolve(root, path), "utf8"), path).not.toContain(
      "darrow-ticket-pipeline",
    );
  }
  const suiteDirectory = resolve(root, "evals/experiments/orchestration");
  for (const name of await readdir(suiteDirectory)) {
    if (!name.endsWith(".yaml")) continue;
    const suite = parse(await readFile(resolve(suiteDirectory, name), "utf8"));
    expect(Object.keys(suite.modes), name).not.toContain(
      "darrow-ticket-pipeline",
    );
  }
});
