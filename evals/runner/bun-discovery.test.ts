import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("main Bun test discovery ignores external eval corpus caches", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-bun-discovery-"));
  roots.push(root);
  const cache = join(root, "evals", "corpus", "orchestration", "cache");
  await mkdir(cache, { recursive: true });
  await writeFile(
    join(root, "bunfig.toml"),
    '[test]\npathIgnorePatterns = ["evals/corpus/**/cache/**"]\n',
  );
  await writeFile(
    join(root, "owned.test.ts"),
    'import { test } from "bun:test"; test("owned sentinel", () => {});\n',
  );
  await writeFile(
    join(cache, "external.test.ts"),
    'import { test } from "bun:test"; test("external sentinel", () => {});\n',
  );

  const result = Bun.spawnSync([process.execPath, "test"], {
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });
  const output = `${result.stdout}\n${result.stderr}`;

  expect(result.exitCode).toBe(0);
  expect(output).toContain("owned sentinel");
  expect(output).not.toContain("external sentinel");
});
