import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  compile,
  createLock,
  snapshot,
  verifyRunSnapshot,
} from "../src/compiler";
import { writeJson } from "../src/io";
import { SOURCE_PLUGIN_ROOT } from "../src/paths";
import { initRepository } from "../src/repository";
import { validateSchema } from "../src/schema";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map(async (path) => {
      await chmod(
        resolve(path, ".darrow", "runs", "test-run", "snapshot"),
        0o755,
      ).catch(() => {});
      await Bun.spawn(["chmod", "-R", "u+w", path]).exited;
      await rm(path, { recursive: true, force: true });
    }),
  );
});

function git(cwd: string, args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

async function repo(): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), "darrow-compiler-"));
  temps.push(path);
  git(path, ["init", "-q"]);
  git(path, ["config", "user.name", "Test"]);
  git(path, ["config", "user.email", "test@example.com"]);
  await writeFile(resolve(path, "README.md"), "fixture\n");
  git(path, ["add", "README.md"]);
  git(path, ["commit", "-qm", "fixture"]);
  await initRepository(path);
  return path;
}

describe("M1 compiler", () => {
  test("resolves command and hard capability into a valid immutable plan and lock", async () => {
    const root = await repo();
    const previous = process.env.DARROW_PLUGIN_ROOTS;
    process.env.DARROW_PLUGIN_ROOTS = SOURCE_PLUGIN_ROOT;
    const compilation = await compile(root, "implement-change", {
      change: "return hello",
    }).finally(() => {
      process.env.DARROW_PLUGIN_ROOTS = previous;
    });
    expect(compilation.plan.steps[0]?.commandId).toBe(
      "darrow-delivery:implement",
    );
    expect(compilation.plan.capabilities[0]?.providerId).toBe(
      "darrow-git:create-branch",
    );
    expect(compilation.plan.capabilities[0]?.version).toBe("1.0.0");
    const runDir = resolve(root, ".darrow", "runs", "test-run");
    await mkdir(runDir, { recursive: true });
    const lock = await createLock(compilation, "test-run");
    await writeJson(resolve(runDir, "lock.json"), lock);
    const snapshotDir = await snapshot(compilation, runDir);
    expect(
      await readdir(
        resolve(snapshotDir, "commands", "darrow-delivery", "implement"),
      ),
    ).toContain("SKILL.md");
    await validateSchema("lock.schema.json", lock, "lock");
    await expect(
      verifyRunSnapshot(runDir, compilation.plan),
    ).resolves.toBeUndefined();
    await chmod(resolve(snapshotDir, "workflow.yaml"), 0o644);
    await writeFile(resolve(snapshotDir, "workflow.yaml"), "corrupt\n");
    await expect(verifyRunSnapshot(runDir, compilation.plan)).rejects.toThrow(
      "workflow digest mismatch",
    );
  });

  test("an incompatible harness-enabled provider fails before worktree creation and does not fall through", async () => {
    const root = await repo();
    const plugin = resolve(root, "bad-plugin");
    await mkdir(resolve(plugin, ".codex-plugin"), { recursive: true });
    await mkdir(resolve(plugin, ".claude-plugin"), { recursive: true });
    await mkdir(resolve(plugin, "skills", "create-branch"), {
      recursive: true,
    });
    const manifest = { name: "darrow-git", version: "9.0.0" };
    await writeFile(
      resolve(plugin, ".codex-plugin", "plugin.json"),
      JSON.stringify({ ...manifest, skills: "./skills/" }),
    );
    await writeFile(
      resolve(plugin, ".claude-plugin", "plugin.json"),
      JSON.stringify(manifest),
    );
    await writeFile(
      resolve(plugin, "skills", "create-branch", "SKILL.md"),
      "# incompatible\n",
    );
    await writeFile(
      resolve(plugin, "skills", "create-branch", "darrow.json"),
      JSON.stringify({
        schemaVersion: 1,
        kind: "capability",
        provides: [{ contract: "git.branch.create", version: "0.5.0" }],
      }),
    );
    const previous = process.env.DARROW_PLUGIN_ROOTS;
    process.env.DARROW_PLUGIN_ROOTS = plugin;
    await expect(
      compile(root, "implement-change", { change: "return hello" }),
    ).rejects.toThrow("does not satisfy ^1.0.0");
    process.env.DARROW_PLUGIN_ROOTS = previous;
    expect(await readdir(resolve(root, ".darrow", "worktrees"))).toEqual([]);
  });
});
