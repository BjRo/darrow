import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sandboxedAgentCommand, sandboxProfile } from "./sandbox";

const cleanup: string[] = [];
const originalPath = process.env.PATH;

afterEach(async () => {
  delete process.env.DARROW_EVAL_EXTERNAL_SANDBOX;
  if (originalPath === undefined) delete process.env.PATH;
  else process.env.PATH = originalPath;
  await Promise.all(
    cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("eval outer sandbox", () => {
  test("builds deterministic deny rules and escapes literals", () => {
    const profile = sandboxProfile(
      ['/tmp/z"q', "/tmp/a\\b", "/tmp/a\\b"],
      ["/opt/homebrew/bin/gh"],
    );
    expect(profile).toContain('(deny file-read* (subpath "/tmp/z\\"q"))');
    expect(profile).toContain('(deny file-write* (subpath "/tmp/a\\\\b"))');
    expect(profile.match(/\/tmp\/a/g)?.length).toBe(2);
    expect(profile.indexOf("/tmp/a")).toBeLessThan(profile.indexOf("/tmp/z"));
    expect(profile).toContain(
      '(deny process-exec (literal "/opt/homebrew/bin/gh"))',
    );
  });

  test("wraps agents on macOS or requires declared external isolation", async () => {
    const repoDir = await mkdtemp(join(tmpdir(), "darrow-eval-sandbox-test-"));
    const unrelatedDir = await mkdtemp(
      join(tmpdir(), "unrelated-sandbox-test-"),
    );
    cleanup.push(repoDir);
    cleanup.push(unrelatedDir);
    await mkdir(join(repoDir, ".git"));

    if (process.platform === "darwin") {
      const hostBin = await mkdtemp(join(tmpdir(), "darrow-host-bin-"));
      cleanup.push(hostBin);
      const hostGh = join(hostBin, "gh");
      await Bun.write(hostGh, "#!/bin/sh\nexit 0\n");
      await Bun.spawn(["chmod", "+x", hostGh]).exited;
      process.env.PATH = `${hostBin}:${originalPath ?? ""}`;
      const command = await sandboxedAgentCommand(["/usr/bin/true"], repoDir);
      expect(command[0]).toBe("/usr/bin/sandbox-exec");
      expect(command.slice(-1)).toEqual(["/usr/bin/true"]);
      const profile = await readFile(command[2]!, "utf8");
      const git = Bun.spawn(
        ["git", "-C", import.meta.dir, "worktree", "list", "--porcelain"],
        { stdout: "pipe" },
      );
      const worktrees = await new Response(git.stdout).text();
      expect(await git.exited).toBe(0);
      const main = worktrees.match(/^worktree (.+)$/m)?.[1];
      expect(main).toBeDefined();
      expect(profile).toContain(
        `(deny file-read* (subpath "${await realpath(main!)}"))`,
      );
      expect(profile).not.toContain(await realpath(unrelatedDir));
      expect(profile).toContain(
        `(deny process-exec (literal "${await realpath(hostGh)}"))`,
      );

      const deniedRead = await sandboxedAgentCommand(
        ["/bin/cat", join(import.meta.dir, "types.ts")],
        repoDir,
      );
      const proc = Bun.spawn(deniedRead, {
        cwd: repoDir,
        stdout: "ignore",
        stderr: "ignore",
      });
      expect(await proc.exited).not.toBe(0);

      const deniedForge = await sandboxedAgentCommand([hostGh], repoDir);
      const forge = Bun.spawn(deniedForge, {
        cwd: repoDir,
        stdout: "ignore",
        stderr: "ignore",
      });
      expect(await forge.exited).not.toBe(0);
    } else {
      await expect(
        sandboxedAgentCommand(["/usr/bin/true"], repoDir),
      ).rejects.toThrow("eval isolation unavailable");
    }

    process.env.DARROW_EVAL_EXTERNAL_SANDBOX = "1";
    expect(await sandboxedAgentCommand(["/usr/bin/true"], repoDir)).toEqual([
      "/usr/bin/true",
    ]);
  }, 10_000);
});
