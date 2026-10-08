import { afterEach, expect, test } from "bun:test";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
  // Sentinels record execution in files: Bun's reporter omits passing test
  // names in agent environments (for example CLAUDECODE=1).
  const sentinel = (name: string) =>
    [
      'import { test } from "bun:test";',
      'import { writeFileSync } from "node:fs";',
      `test("${name}", () => writeFileSync(${JSON.stringify(join(root, `${name}.ran`))}, ""));`,
      "",
    ].join("\n");
  await writeFile(join(root, "owned.test.ts"), sentinel("owned"));
  await writeFile(join(cache, "external.test.ts"), sentinel("external"));
  const ran = (name: string) =>
    access(join(root, `${name}.ran`)).then(
      () => true,
      () => false,
    );

  const result = Bun.spawnSync([process.execPath, "test"], {
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });
  expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(await ran("owned")).toBe(true);
  expect(await ran("external")).toBe(false);
});
