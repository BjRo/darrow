import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readSemanticArtifact,
  runSemanticArtifactChecks,
  validateSemanticArtifact,
} from "./semantic-artifact";
import type { HarnessAdapter, SemanticArtifactConfig } from "./types";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "darrow-semantic-artifact-"));
  roots.push(root);
  await mkdir(join(root, "docs", "decisions"), { recursive: true });
  return root;
}

const config: SemanticArtifactConfig = {
  path: "docs/decisions/ADR-0001-*.md",
  checks: [
    {
      name: "provenance",
      proposition: "The ADR distinguishes observation from assumption.",
    },
  ],
};

test("reads exactly one saved artifact and grades its content, not the final reply", async () => {
  const root = await fixture();
  await writeFile(
    join(root, "docs/decisions/ADR-0001-cache.md"),
    "User statement: 18%. Assumption: traffic doubles.\n",
  );
  const adapter: HarnessAdapter = {
    name: "fixture",
    defaultModel: "fixture-model",
    skillMounts: [],
    version: async () => "fixture",
    run: async ({ prompt }) => {
      expect(prompt).toContain("candidate document");
      expect(prompt).toContain(
        "User statement: 18%. Assumption: traffic doubles.",
      );
      expect(prompt).not.toContain("final reply");
      return {
        ok: true,
        durationMs: 1,
        inputTokens: 1,
        outputTokens: 1,
        costUsd: null,
        resultText: JSON.stringify({
          checks: [
            {
              name: "provenance",
              verdict: "pass",
              reason: "Distinct sources.",
            },
          ],
        }),
        raw: "",
      };
    },
  };
  const result = await runSemanticArtifactChecks({
    adapter,
    repoDir: root,
    config,
    model: "fixture-model",
    effort: "medium",
  });
  expect(result.checks[0]?.passed).toBe(true);
  expect(result.result.path).toBe("docs/decisions/ADR-0001-cache.md");
});

test("missing or ambiguous artifacts fail closed", async () => {
  const root = await fixture();
  await expect(readSemanticArtifact(root, config.path)).rejects.toThrow(
    "matched 0 files",
  );
  const noGrader: HarnessAdapter = {
    name: "fixture",
    defaultModel: "fixture-model",
    skillMounts: [],
    version: async () => "fixture",
    run: async () => {
      throw new Error("grader must not run without an artifact");
    },
  };
  const missing = await runSemanticArtifactChecks({
    adapter: noGrader,
    repoDir: root,
    config,
    model: "fixture-model",
    effort: "medium",
  });
  expect(missing.checks[0]?.passed).toBe(false);
  expect(missing.result.ok).toBe(false);
  await writeFile(join(root, "docs/decisions/ADR-0001-a.md"), "a");
  await writeFile(join(root, "docs/decisions/ADR-0001-b.md"), "b");
  await expect(readSemanticArtifact(root, config.path)).rejects.toThrow(
    "matched 2 files",
  );
});

test("rejects escaped paths and linked artifacts", async () => {
  const root = await fixture();
  expect(
    validateSemanticArtifact({ ...config, path: "../outside.md" }, "case"),
  ).not.toEqual([]);
  await symlink(
    join(root, "outside.md"),
    join(root, "docs/decisions/ADR-0001-linked.md"),
  );
  await expect(readSemanticArtifact(root, config.path)).rejects.toThrow(
    "regular file",
  );
});
