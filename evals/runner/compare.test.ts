import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CaseResult } from "./types";

test.each(["dry", "unknown"] as const)(
  "compare refuses %s execution provenance",
  async (executionMode) => {
    const root = await mkdtemp(join(tmpdir(), "darrow-compare-"));
    try {
      const result: CaseResult = {
        caseId: "preparation",
        invariant: "SE-C21",
        executionMode,
        evaluationDigest: "matched",
        passThreshold: 0.8,
        skillDirectory: null,
        mountPluginSkills: false,
        harness: "codex",
        model: "synthetic",
        effort: "medium",
        trials: [],
        passRate: 1,
        meanDurationMs: 0,
        p95DurationMs: 0,
        meanTokens: 0,
        totalCostUsd: null,
        humanReviewMinutes: null,
      };
      const path = join(root, "result.json");
      await writeFile(path, JSON.stringify([result]));
      const proc = Bun.spawn(
        [process.execPath, join(import.meta.dir, "compare.ts"), path, path],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [stdout, code] = await Promise.all([
        new Response(proc.stdout).text(),
        proc.exited,
      ]);
      expect(code).toBe(1);
      expect(stdout).toContain("unmeasured");
      expect(stdout).not.toContain("100%");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
