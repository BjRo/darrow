import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { runChecks, runOutputChecks } from "./checks";
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

async function emit(repoDir: string, payload: string): Promise<void> {
  const proc = Bun.spawn(
    [join(repoDir, ".git", "fixture-bin", "telemetry-adapter"), "emit"],
    { cwd: repoDir, stdin: "pipe", stdout: "ignore", stderr: "pipe" },
  );
  proc.stdin.write(payload);
  proc.stdin.end();
  const error = await new Response(proc.stderr).text();
  expect(await proc.exited, error).toBe(0);
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(destroyFixture));
});

describe("ticket-to-PR evaluation fixtures", () => {
  test("retains every telemetry emission so duplicates and earlier secrets fail", async () => {
    for (const name of ["tpr-e11-telemetry.yaml", "tpr-e12-privacy.yaml"]) {
      const evalCase = await loadCase(name);
      const repoDir = await buildFixture({
        fixture: evalCase.fixture,
        skillDir: "",
        skillMounts: [],
      });
      fixtures.push(repoDir);
      await emit(repoDir, "token ghp_seededSecret123\n");
      await emit(repoDir, "parser regression\n");
      const results = await runChecks(repoDir, evalCase.checks);
      expect(results[0]).toEqual(expect.objectContaining({ passed: false }));
      expect(
        await readFile(join(repoDir, ".git", "telemetry-lifecycle"), "utf8"),
      ).toContain("ghp_seededSecret123");
    }
  });

  test("rejects duplicate fields in a terminal record", async () => {
    const evalCase = await loadCase("tpr-e10-stopped.yaml");
    const cardinality = evalCase.output_checks![0]!;
    const fields = [
      "format\tdarrow-ticket-to-pr-result-v1",
      "ticket\tTKT-1012",
      "repository\t/tmp/repo",
      "outcome\tstopped",
      "outcome\tblocked",
      "reason\treadiness needs a decision",
      "readiness\tneeds-decision",
      "branch\tunavailable",
      "base\tmain/abc",
      "commits\tunavailable",
      "remote_branch\tunavailable",
      "pull_request_url\tunavailable",
      "verification\tunavailable",
      "independent_review\tomitted",
      "local_work\tnone",
      "adaptive_goal\tunavailable",
      "telemetry_status\tdegraded",
      "telemetry_evidence\tunavailable",
    ].join("\n");
    expect(
      await runOutputChecks(fields, [cardinality], evalCase.skillDir),
    ).toEqual([expect.objectContaining({ passed: false })]);
  });
});
