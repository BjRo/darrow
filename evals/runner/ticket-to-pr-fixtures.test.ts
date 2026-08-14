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

  test("rejects a malformed terminal record without regex backtracking", async () => {
    const evalCase = await loadCase("tpr-e10-stopped.yaml");
    const fields = [
      "format\tdarrow-ticket-to-pr-result-v1",
      "ticket\tTKT-1012",
      "repository\tunavailable",
      "outcome\tstopped",
      "reason\treadiness needs a decision",
      "readiness\tneeds-decision",
      "branch\tunavailable",
      "base\tunavailable",
      "commits\tunavailable",
      "remote_branch\tunavailable",
      "pull_request_url\tunavailable",
      "verification\tunavailable",
      "independent_review\tunavailable",
      "local_work\tunavailable",
      "adaptive_goal\tunavailable",
      "telemetry_status\tunavailable",
      "telemetry_evidence\tunavailable",
    ].join("\n");
    const started = performance.now();
    const rejected = await runOutputChecks(
      fields,
      evalCase.output_checks!,
      evalCase.skillDir,
    );
    const durationMs = performance.now() - started;
    const accepted = await runOutputChecks(
      fields.replace(
        "telemetry_status\tunavailable",
        "telemetry_status\tdegraded",
      ),
      evalCase.output_checks!,
      evalCase.skillDir,
    );

    expect(durationMs).toBeLessThan(250);
    expect(rejected).toContainEqual(
      expect.objectContaining({
        name: "stopped carries every terminal field",
        passed: false,
      }),
    );
    expect(accepted.every((result) => result.passed)).toBe(true);
  });
});
