import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { captureTestCommand } from "../test-command";

const caches: string[] = [];
afterEach(async () => {
  await Promise.all(
    caches
      .splice(0)
      .map((cache) => rm(cache, { recursive: true, force: true })),
  );
});

test("goal review proof works offline after preparing an explicit empty UV cache", async () => {
  const cache = await mkdtemp(join(tmpdir(), "darrow-goal-review-cache-"));
  caches.push(cache);
  const result = await captureTestCommand(
    [
      process.execPath,
      "test",
      "--timeout",
      "60000",
      fileURLToPath(new URL("goal-review-fixture.test.ts", import.meta.url)),
      "--test-name-pattern",
      "high-risk current proof accepts read-only artifacts and rejects changed content",
    ],
    undefined,
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: { ...process.env, UV_CACHE_DIR: cache },
      timeout: 60_000,
    },
  );
  expect(result.exitCode, result.stderr || result.stdout).toBe(0);
  expect(result.stderr).toContain("1 pass");
}, 60_000);
