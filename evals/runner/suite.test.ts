import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("evaluation suite ablation", () => {
  test("runs a declared no-skill baseline and writes a matched report", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-suite-"));
    roots.push(root);
    const suite = join(root, "suite.yaml");
    const output = join(root, "output");
    await writeFile(
      suite,
      [
        "version: 1",
        "experiment: discovery-test",
        "case_filter: grilling-incomplete-subject",
        "modes:",
        "  without-skill:",
        "    without_skill: true",
        "  candidate: {}",
        "ablations:",
        "  - name: discovery-value",
        "    baseline: without-skill",
        "    candidate: candidate",
      ].join("\n"),
    );

    const proc = Bun.spawn(
      [
        "bun",
        resolve(import.meta.dir, "suite.ts"),
        "--suite",
        suite,
        "--harness",
        "codex",
        "--trials",
        "1",
        "--dry",
        "--no-judge",
        "--output",
        output,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(`${stdout}\n${stderr}`).toContain("codex / without-skill");
    expect(code).toBe(0);

    const manifest = JSON.parse(
      await readFile(join(output, "suite-run.json"), "utf8"),
    );
    expect(manifest.ablations).toEqual([
      {
        name: "discovery-value",
        baseline: "without-skill",
        candidate: "candidate",
      },
    ]);
    expect(manifest.models).toEqual({
      claude: "claude-sonnet-5",
      codex: "gpt-5.5",
    });
    expect(manifest.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fallbackModel: "gpt-5.5",
          fallbackEffort: "medium",
          caseRoutes: null,
        }),
      ]),
    );
    expect(await readFile(join(output, "ablation.md"), "utf8")).toContain(
      "discovery-value",
    );
  });

  test("records the goal-routed Codex default used by the cell", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-suite-"));
    roots.push(root);
    const suite = join(root, "suite.yaml");
    const output = join(root, "output");
    await writeFile(
      suite,
      [
        "version: 1",
        "experiment: goal-route-model-test",
        "case_filter: grilling-incomplete-subject",
        "modes:",
        "  goal:",
        "    apply_goal_route: true",
      ].join("\n"),
    );

    const proc = Bun.spawn(
      [
        "bun",
        resolve(import.meta.dir, "suite.ts"),
        "--suite",
        suite,
        "--harness",
        "codex",
        "--trials",
        "1",
        "--dry",
        "--no-judge",
        "--output",
        output,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(`${stdout}\n${stderr}`).toContain("codex / goal");
    expect(code).toBe(0);

    const manifest = JSON.parse(
      await readFile(join(output, "suite-run.json"), "utf8"),
    );
    expect(manifest.cells).toEqual([
      expect.objectContaining({
        harness: "codex",
        mode: "goal",
        fallbackModel: "gpt-5.6-terra",
        fallbackEffort: "medium",
        caseRoutes: null,
      }),
    ]);
  });

  test("records heterogeneous per-case routes without claiming one cell model", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-suite-"));
    roots.push(root);
    const suite = join(root, "suite.yaml");
    const output = join(root, "output");
    await writeFile(
      suite,
      [
        "version: 1",
        "experiment: case-route-model-test",
        "case_filter:",
        "  - grilling-incomplete-subject",
        "  - grilling-direct-frontier",
        "case_routes:",
        "  codex:",
        "    grilling-incomplete-subject:",
        "      model: gpt-5.6-luna",
        "      effort: high",
        "    grilling-direct-frontier:",
        "      model: gpt-5.6-terra",
        "      effort: medium",
        "modes:",
        "  routed:",
        "    apply_case_routes: true",
      ].join("\n"),
    );

    const proc = Bun.spawn(
      [
        "bun",
        resolve(import.meta.dir, "suite.ts"),
        "--suite",
        suite,
        "--harness",
        "codex",
        "--trials",
        "1",
        "--dry",
        "--no-judge",
        "--output",
        output,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(`${stdout}\n${stderr}`).toContain("codex / routed");
    expect(code).toBe(0);

    const manifest = JSON.parse(
      await readFile(join(output, "suite-run.json"), "utf8"),
    );
    expect(manifest.cells).toEqual([
      expect.objectContaining({
        fallbackModel: "gpt-5.5",
        fallbackEffort: "medium",
        caseRoutes: {
          "grilling-incomplete-subject": {
            model: "gpt-5.6-luna",
            effort: "high",
          },
          "grilling-direct-frontier": {
            model: "gpt-5.6-terra",
            effort: "medium",
          },
        },
      }),
    ]);
  });

  test("skips reports cleanly when a failed cell produced no result", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-suite-"));
    roots.push(root);
    const suite = join(root, "suite.yaml");
    await writeFile(
      suite,
      [
        "version: 1",
        "experiment: missing-result-test",
        "case_filter: case-that-does-not-exist",
        "modes:",
        "  candidate: {}",
      ].join("\n"),
    );
    const proc = Bun.spawn(
      [
        "bun",
        resolve(import.meta.dir, "suite.ts"),
        "--suite",
        suite,
        "--harness",
        "codex",
        "--dry",
        "--no-judge",
        "--output",
        join(root, "output"),
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code).toBe(1);
    expect(`${stdout}\n${stderr}`).toContain(
      "Reports skipped: 1 cell result file(s) are missing",
    );
    expect(`${stdout}\n${stderr}`).not.toContain("ENOENT");
  });

  test("rejects zero trials and out-of-range thresholds", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-suite-"));
    roots.push(root);
    const suite = join(root, "suite.yaml");
    await writeFile(
      suite,
      [
        "version: 1",
        "experiment: invalid-limits",
        "case_filter: grilling-incomplete-subject",
        "modes:",
        "  candidate: {}",
      ].join("\n"),
    );
    for (const args of [
      ["--trials", "0"],
      ["--trials", "1.5"],
      ["--threshold", "0"],
      ["--threshold", "1.1"],
    ]) {
      const proc = Bun.spawn(
        [
          "bun",
          resolve(import.meta.dir, "suite.ts"),
          "--suite",
          suite,
          ...args,
          "--dry",
          "--no-judge",
          "--output",
          join(root, args.join("-")),
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [stderr, code] = await Promise.all([
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      expect(code).toBe(1);
      expect(stderr).toMatch(/trials|threshold/);
    }
  });

  test("direct runner rejects zero trials before producing evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-run-"));
    roots.push(root);
    const output = join(root, "result.json");
    const proc = Bun.spawn(
      [
        "bun",
        resolve(import.meta.dir, "run.ts"),
        "--harness",
        "codex",
        "--case",
        "grilling-incomplete-subject",
        "--trials",
        "0",
        "--dry",
        "--output",
        output,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stderr, code] = await Promise.all([
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code).toBe(1);
    expect(stderr).toContain("--trials must be a positive integer");
    await expect(readFile(output, "utf8")).rejects.toThrow();
  });
});
