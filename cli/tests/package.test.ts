import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { CLI_ROOT } from "../src/paths";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

test("packed CLI contains both executables and every runtime input", async () => {
  const destination = await mkdtemp(resolve(tmpdir(), "darrow-package-"));
  temps.push(destination);
  const packed = Bun.spawnSync(
    ["bun", "pm", "pack", "--destination", destination],
    { cwd: CLI_ROOT, stdout: "pipe", stderr: "pipe" },
  );
  expect(packed.exitCode, packed.stderr.toString()).toBe(0);
  const archive = resolve(
    destination,
    (await readdir(destination)).find((name) => name.endsWith(".tgz"))!,
  );
  const listed = Bun.spawnSync(["tar", "-tzf", archive], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(listed.exitCode, listed.stderr.toString()).toBe(0);
  const files = listed.stdout.toString();
  for (const required of [
    "package/src/index.ts",
    "package/src/install.ts",
    "package/src/worker.ts",
    "package/schemas/lock.schema.json",
    "package/profiles/codex.yaml",
    "package/profiles/claude.yaml",
    "package/workflows/implement-change.yaml",
    "package/temporal.json",
  ])
    expect(files).toContain(required);
});
