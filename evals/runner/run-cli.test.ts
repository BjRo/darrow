import { expect, test } from "bun:test";
import { join } from "node:path";

test("requires an explicit harness", async () => {
  const proc = Bun.spawn(
    ["bun", "runner/run.ts", "--case", "no-such-case", "--dry"],
    {
      cwd: join(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(exitCode).toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toBe("--harness is required; available: claude, codex\n");
});
