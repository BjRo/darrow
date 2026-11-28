import { expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureExtensionRequest } from "./fixture-command";

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

test("a copied pstack package exposes every selected skill through both public host mounts", async () => {
  const root = resolve(import.meta.dir, "../..");
  const scratch = await mkdtemp(join(tmpdir(), "darrow-pstack-catalog-"));
  const artifact = join(scratch, "plugins/capability/darrow-pstack");
  try {
    await mkdir(join(artifact, ".."), { recursive: true });
    await cp(join(root, "plugins/capability/darrow-pstack"), artifact, {
      recursive: true,
    });
    const resolved = await fixtureExtensionRequest<{ cases: unknown[] }>(
      "resolve",
      {
        projectRoot: pathToFileURL(scratch).href,
        selectors: {
          caseIds: ["pstack-principles-first-default-bundled-loading"],
        },
        configuration: {},
      },
    );
    expect(resolved.cases).toHaveLength(1);
    for (const host of ["codex", "claude"]) {
      const prepared = await fixtureExtensionRequest<{
        artifacts: Array<{ relativePath: string; contentBase64: string }>;
      }>("prepare", {
        case: resolved.cases[0],
        host: {
          id: `sevro.host.${host}`,
          capabilities:
            host === "codex"
              ? [
                  "sevro.codex.plugin-marketplace",
                  "sevro.codex.explicit-invocation",
                ]
              : [
                  "sevro.claude.plugin-dirs",
                  "sevro.claude.explicit-invocation",
                ],
        },
        condition: "passive",
        configuration: {},
      });
      for (const id of [
        ...catalog.map((suffix) => `principle-${suffix}`),
        "principles-first",
        "setup-principles",
        "unslop",
        "blast-radius",
        "correct",
        "create-verification-skill",
        "maintain-verification-skill",
        "why",
        "benchmark-checklist",
        "reflect",
      ]) {
        const mounted = prepared.artifacts.filter((file) =>
          file.relativePath.endsWith(`/skills/${id}/SKILL.md`),
        );
        expect(mounted, `${host}: ${id}`).toHaveLength(1);
        expect(
          Buffer.from(mounted[0]!.contentBase64, "base64").toString(),
        ).toBe(
          await readFile(join(artifact, "skills", id, "SKILL.md"), "utf8"),
        );
      }
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
