import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});
async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "darrow-doc-check-"));
  roots.push(root);
  const baseline = {
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "darrow",
      plugins: [],
    }),
    ".agents/skills/darrow-guide/SKILL.md": "# Guide\n",
    ".claude/skills/darrow-guide/SKILL.md": "# Guide\n",
    ".agents/skills/darrow-guide/evals/inventory.json": JSON.stringify({
      version: 1,
      questions: [],
    }),
    "docs/choosing-plugins.md": "# Choose\n",
  };
  for (const [path, text] of Object.entries({ ...baseline, ...files })) {
    const destination = join(root, path);
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFile(destination, text);
  }
  return root;
}
async function check(root: string) {
  const proc = Bun.spawn(
    [process.execPath, join(import.meta.dir, "check-docs.ts"), "--root", root],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { output: stdout + stderr, code };
}
test("checks rendered links and GitHub duplicate heading anchors, ignoring code examples", async () => {
  const root = await fixture({
    "README.md":
      "# Root\n\n[second](other.md#hello-world-1)\n\n[reference][target]\n\n[target]: other.md#hello-world\n\n```text\n[example](missing.md)\n```\n",
    "other.md": "# Hello, *World*!\n\n## Hello, World!\n",
  });
  const result = await check(root);
  expect(result.code, result.output).toBe(0);
});
test("reports broken links, anchors, image alternatives and unlabelled fences", async () => {
  const root = await fixture({
    "README.md":
      "# Root\n\n[missing](absent.md)\n[anchor](#absent)\n![](image.svg)\n\n```\ncode\n```\n",
    "image.svg": "<svg/>",
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  for (const message of [
    "absent.md",
    "#absent",
    "image alternative",
    "fence language",
  ])
    expect(result.output).toContain(message);
});
test("rejects guide drift and unpublished catalog paths", async () => {
  const root = await fixture({
    ".claude/skills/darrow-guide/SKILL.md": "# A different guide\n",
    "docs/choosing-plugins.md":
      "# Choose\n\n[stale](../plugins/capability/removed/README.md)\n",
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  expect(result.output).toContain("guide entrypoints differ");
  expect(result.output).toContain("removed/README.md");
});
test("validates paired manifests, required README sections and catalog membership", async () => {
  const plugin = "plugins/capability/example";
  const root = await fixture({
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "darrow",
      plugins: [{ name: "example", source: "./" + plugin }],
    }),
    [plugin + "/README.md"]: "# Example\n",
    [plugin + "/.claude-plugin/plugin.json"]: JSON.stringify({
      name: "example",
      version: "1.0.0",
    }),
    [plugin + "/.codex-plugin/plugin.json"]: JSON.stringify({
      name: "wrong",
      version: "1.0.1",
      skills: "./skills/",
    }),
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  for (const message of [
    "manifest identity",
    "manifest versions",
    "When to use",
    "catalog",
  ])
    expect(result.output).toContain(message);
});
test("rejects an inventory with missing cases or source routes", async () => {
  const root = await fixture({
    ".agents/skills/darrow-guide/evals/inventory.json": JSON.stringify({
      version: 1,
      questions: [
        {
          id: "guide-example",
          sources: ["absent.md"],
          static_page: "docs/absent.md",
        },
      ],
    }),
    ".agents/skills/darrow-guide/evals/unlisted.yaml": "id: unlisted\n",
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  for (const message of [
    "missing or invalid case",
    "absent.md",
    "case absent from inventory",
  ])
    expect(result.output).toContain(message);
});
