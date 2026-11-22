import { expect, test } from "bun:test";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { planSuite } from "../sevro-extension/suite";
import { policyProject } from "./policy-project";

// Exercise the checked-in comparison with synthetic tasks, without corpus downloads.
test("the current comparison plans passive controls and current Adaptive Goal", async () => {
  const project = await policyProject(
    {},
    {
      directory: "plugins/orchestration/darrow-adaptive-goal",
      plugin: "darrow-adaptive-goal",
      skill: "adaptive-goal",
    },
  );
  const directory = join(project.root, "evals/experiments/orchestration");
  await mkdir(join(directory, "conditions"), { recursive: true });
  for (const name of [
    "suite.yaml",
    "conditions/vanilla.md",
    "conditions/native-goal-codex.md",
    "conditions/darrow-adaptive-goal-codex.md",
  ])
    await copyFile(
      resolve(import.meta.dir, "../experiments/orchestration", name),
      join(directory, name),
    );
  await project.write({
    id: "orchestration-oss-probe",
    prompt: "Return ready.",
  });
  const adapter = join(project.root, "adapter.ts");
  await writeFile(
    adapter,
    'export default {id: "sevro.host.codex", model: "synthetic", effort: "none", async run() { throw new Error("planning must not execute"); }};',
  );
  const plan = await planSuite([
    "--suite",
    join(directory, "suite.yaml"),
    "--project-root",
    project.root,
    "--results-root",
    join(project.root, "results"),
    "--harness",
    "codex",
    "--trials",
    "1",
    "--threshold",
    "1",
    "--",
    "--adapter-module",
    adapter,
    "--model",
    "synthetic",
    "--effort",
    "medium",
  ]);
  expect(plan.cells).toHaveLength(3);
  expect(plan.manifest.cells).toEqual([]);
  expect(await Bun.file(join(project.root, "results")).exists()).toBe(false);
  for (const cell of plan.cells) expect(cell.condition).toBe("passive");
  const modes = new Map(plan.manifest.modes.map((mode) => [mode.name, mode]));
  expect(modes.get("vanilla")?.withoutSkill).toBe(true);
  expect(modes.get("native-goal")?.withoutSkill).toBe(true);
  expect(modes.get("darrow-adaptive-goal")?.withoutSkill).toBe(false);
});
