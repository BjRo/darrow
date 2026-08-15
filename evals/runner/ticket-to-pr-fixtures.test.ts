import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { runChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const fixtures: string[] = [];
const CASES = resolve(
  import.meta.dir,
  "../../plugins/task_recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals",
);

async function loadCase(name: string): Promise<EvalCase> {
  const path = join(CASES, name);
  const value = parseYaml(await readFile(path, "utf8")) as EvalCase;
  value.skillDir = resolve(CASES, "..");
  return value;
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(destroyFixture));
});

describe("ticket-to-PR evaluation fixtures", () => {
  test("counts one PR creation independently of multiline arguments", async () => {
    const evalCase = await loadCase("tpr-e1-ready-delivery.yaml");
    const repoDir = await buildFixture({
      fixture: evalCase.fixture,
      skillDir: "",
      skillMounts: [],
    });
    fixtures.push(repoDir);
    const proc = Bun.spawn(
      [
        join(repoDir, ".git", "fixture-bin", "gh"),
        "pr",
        "create",
        "--title",
        "docs: document widget readiness",
        "--body",
        "TKT-101\n\nWhy this exists.\nWhat changed.",
      ],
      { cwd: repoDir, stdout: "ignore", stderr: "pipe" },
    );
    const error = await new Response(proc.stderr).text();
    expect(await proc.exited, error).toBe(0);
    const proposalCheck = evalCase.checks.find(
      (check) => check.name === "exactly one proposal is created",
    );
    expect(proposalCheck).toBeDefined();
    expect(await runChecks(repoDir, [proposalCheck!])).toEqual([
      expect.objectContaining({ passed: true }),
    ]);
  });
});
