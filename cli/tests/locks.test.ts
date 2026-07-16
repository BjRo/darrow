import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { writeJson } from "../src/io";
import { withDirectoryLock } from "../src/locks";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

test("directory lock serializes concurrent operations", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-lock-"));
  temps.push(root);
  const lock = resolve(root, "allocation.lock");
  let active = 0;
  let maximum = 0;
  await Promise.all(
    Array.from({ length: 8 }, () =>
      withDirectoryLock(lock, "test", async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await Bun.sleep(10);
        active -= 1;
      }),
    ),
  );
  expect(maximum).toBe(1);
});

test("directory lock reclaims a provably dead owner", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-lock-"));
  temps.push(root);
  const lock = resolve(root, "allocation.lock");
  await mkdir(lock);
  await writeJson(resolve(lock, "owner.json"), {
    schemaVersion: "0.1.0",
    pid: 2_147_483_647,
    token: "dead",
    acquiredAt: new Date().toISOString(),
  });
  let entered = false;
  await withDirectoryLock(lock, "test", async () => {
    entered = true;
  });
  expect(entered).toBe(true);
});
