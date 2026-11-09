import { expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const catalog = [
  "laziness-protocol",
  "foundational-thinking",
  "redesign-from-first-principles",
  "attack-the-premise",
  "subtract-before-you-add",
  "minimize-reader-load",
  "outcome-oriented-execution",
  "experience-first",
  "exhaust-the-design-space",
  "build-the-lever",
  "model-the-domain",
  "boundary-discipline",
  "type-system-discipline",
  "make-operations-idempotent",
  "migrate-callers-then-delete-legacy-apis",
  "separate-before-serializing-shared-state",
  "prove-it-works",
  "fix-root-causes",
  "sequence-verifiable-units",
  "test-behavior-not-implementation",
  "explain-the-number",
  "guard-the-context-window",
  "never-block-on-the-human",
  "encode-lessons-in-structure",
];

test("native delivery test doubles stay outside marketplace adoption", async () => {
  const root = resolve(import.meta.dir, "../..");
  const fixture = "plugins/fixtures/principles-delivery-fixture";
  const marketplace = JSON.parse(
    await readFile(join(root, ".claude-plugin/marketplace.json"), "utf8"),
  ) as { plugins: Array<{ name: string; source: string }> };
  expect(
    marketplace.plugins.filter(
      (plugin) =>
        plugin.name === "principles-delivery-fixture" ||
        plugin.source === `./${fixture}`,
    ),
  ).toEqual([]);
  expect(existsSync(join(root, fixture, "hooks"))).toBe(false);
  expect(existsSync(join(root, fixture, "backend"))).toBe(false);
});

test("a copied plugin exposes every catalog leaf through the public skill inspector", async () => {
  const root = resolve(import.meta.dir, "../..");
  const scratch = await mkdtemp(join(tmpdir(), "darrow-principles-catalog-"));
  const artifact = join(scratch, "darrow-principles");
  try {
    await cp(join(root, "plugins/capability/darrow-principles"), artifact, {
      recursive: true,
    });
    for (const suffix of catalog) {
      const result = Bun.spawnSync([
        "uv",
        "run",
        "--quiet",
        "--no-project",
        join(
          root,
          "plugins/foundation/darrow-skill-authoring/backend/scripts/run_locked.py",
        ),
        "inspect-skill",
        "inspect",
        join(artifact, "skills", `principle-${suffix}`),
        artifact,
      ]);
      expect(
        result.exitCode,
        `${suffix}: ${result.stderr.toString()}${result.stdout.toString()}`,
      ).toBe(0);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
