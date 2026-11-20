import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dir, "../..");

// TP-R1 and TP-R3: the repository cutover boundary, not host task evidence.
test("ticket pipeline has no executable package, benchmark cell, or CI obligation", async () => {
  for (const path of [
    "plugins/orchestration/darrow-ticket-pipeline",
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
