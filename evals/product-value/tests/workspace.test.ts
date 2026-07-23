import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checked } from "../src/process";
import {
  capturePatch,
  destroyWorkspace,
  injectOracleTests,
  prepareWorkspace,
  reverifyPatch,
  verifyOracleOutcome,
  verifyOutcome,
} from "../src/workspace";
import type { RepositoryDefinition, TaskDefinition } from "../src/types";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("product-value workspace (PV-4 through PV-6)", () => {
  test("removes read-only runtime snapshots without following symlinks", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-product-cleanup-"));
    const outside = await mkdtemp(join(tmpdir(), "darrow-product-outside-"));
    roots.push(outside);
    const outsideSentinel = join(outside, "untouched.txt");
    await writeFile(outsideSentinel, "untouched\n");
    const snapshot = join(root, "repo", ".darrow", "snapshot");
    await mkdir(snapshot, { recursive: true });
    await writeFile(join(snapshot, "lock.json"), "{}\n");
    await Bun.spawn(["ln", "-s", outside, join(snapshot, "outside")]).exited;
    await chmod(snapshot, 0o555);
    await destroyWorkspace({
      root,
      repo: join(root, "repo"),
      state: join(root, "state"),
      baseCommit: "fixture",
      sanitization: {
        schemaVersion: "1.0.0",
        sourceRevision: "fixture",
        removedPaths: [],
        retainedFileCount: 1,
        treeDigest: `sha256:${"0".repeat(64)}`,
      },
    });
    expect(await Bun.file(root).exists()).toBe(false);
    expect(await Bun.file(outsideSentinel).text()).toBe("untouched\n");
  });

  test("exports a history-free base and injects oracle tests only afterward", async () => {
    const source = await mkdtemp(join(tmpdir(), "darrow-product-source-"));
    roots.push(source);
    await checked(["git", "init", "-b", "main"], source);
    await checked(["git", "config", "user.name", "Fixture"], source);
    await checked(
      ["git", "config", "user.email", "fixture@example.test"],
      source,
    );
    await mkdir(join(source, "src"));
    await mkdir(join(source, "tests"));
    await writeFile(
      join(source, "src", "value.ts"),
      "export const value = 1;\n",
    );
    await writeFile(join(source, "AGENTS.md"), "secret instructions\n");
    await writeFile(join(source, "tests", "obsolete.test.ts"), "obsolete\n");
    await checked(["git", "add", "-A"], source);
    await checked(["git", "commit", "-m", "chore: base"], source);
    const baseRevision = await checked(["git", "rev-parse", "HEAD"], source);
    await rm(join(source, "tests", "obsolete.test.ts"));
    await writeFile(
      join(source, "src", "value.ts"),
      "export const value = 2;\n",
    );
    await writeFile(join(source, "tests", "value.test.ts"), "oracle\n");
    await checked(["git", "add", "-A"], source);
    await checked(["git", "commit", "-m", "fix: value"], source);
    const oracleRevision = await checked(["git", "rev-parse", "HEAD"], source);

    const repository: RepositoryDefinition = {
      id: "fixture",
      url: "https://example.test/fixture",
      pinnedRevision: oracleRevision,
      setupCommand: "true",
    };
    const task: TaskDefinition = {
      id: "fixture-value",
      repository: "fixture",
      phase: "pilot",
      stratum: "simple",
      baseRevision,
      oracleRevision,
      prompt: "Change the value.",
      verificationCommand: "test -f {tests}",
      grading: "mixed",
      rubric: ["correct"],
    };
    const workspace = await prepareWorkspace(source, repository, task);
    try {
      expect(await Bun.file(join(workspace.repo, "AGENTS.md")).exists()).toBe(
        false,
      );
      expect(
        await checked(["git", "rev-list", "--count", "HEAD"], workspace.repo),
      ).toBe("1");
      expect(await checked(["git", "remote"], workspace.repo)).toBe("");
      expect(
        await Bun.file(join(workspace.repo, "tests", "value.test.ts")).exists(),
      ).toBe(false);
      await writeFile(
        join(workspace.repo, "src", "value.ts"),
        "export const value = 3;\n",
      );
      await writeFile(join(workspace.repo, "src", "new.ts"), "export {};\n");
      await Promise.all([
        mkdir(join(workspace.repo, ".darrow")),
        mkdir(join(workspace.repo, ".darrow-attempts")),
      ]);
      await writeFile(
        join(workspace.repo, ".darrow", "project.yaml"),
        "private\n",
      );
      await writeFile(
        join(workspace.repo, ".darrow-attempts", "evidence.txt"),
        "private\n",
      );
      await checked(["git", "add", "src/value.ts"], workspace.repo);
      await checked(
        ["git", "commit", "-m", "fix: participant commit"],
        workspace.repo,
      );
      const patchPath = join(workspace.root, "participant.patch");
      await capturePatch(workspace.repo, patchPath, workspace.baseCommit, [
        ".darrow",
        ".darrow-attempts",
      ]);
      const patch = await Bun.file(patchPath).text();
      expect(patch).toContain("value = 3");
      expect(patch).toContain("src/new.ts");
      expect(patch).not.toContain(".darrow");
      expect(patch).not.toContain("private");
      const tests = await injectOracleTests(
        source,
        task,
        workspace.repo,
        workspace.baseCommit,
      );
      expect(tests).toEqual(["tests/value.test.ts"]);
      task.oracleTestAdjustments = [
        {
          path: "tests/value.test.ts",
          find: "oracle",
          replace: "semantic oracle",
        },
      ];
      await injectOracleTests(
        source,
        task,
        workspace.repo,
        workspace.baseCommit,
      );
      expect(
        await Bun.file(join(workspace.repo, "tests", "value.test.ts")).text(),
      ).toBe("semantic oracle\n");
      expect(
        await Bun.file(
          join(workspace.repo, "tests", "obsolete.test.ts"),
        ).exists(),
      ).toBe(false);
      const verification = await verifyOutcome(workspace.repo, task, tests);
      expect(verification.passed).toBe(true);
      expect(verification.failureCategory).toBeNull();
      expect(verification.outputPath).toBeNull();
      task.verificationCommand = "printf 'Failed Suites 1\\n' >&2; exit 1";
      const failureLog = join(workspace.root, "verification.log");
      const failure = await verifyOutcome(
        workspace.repo,
        task,
        tests,
        failureLog,
      );
      expect(failure.failureCategory).toBe("test_failure");
      expect(failure.outputPath).toBe(failureLog);
      expect(await Bun.file(failureLog).text()).toContain("Failed Suites");
      task.verificationCommand =
        "printf \"Failed Suites 1\\nCannot find module './value.ts'\\n\" >&2; exit 1";
      const missingImplementation = await verifyOutcome(
        workspace.repo,
        task,
        tests,
      );
      expect(missingImplementation.failureCategory).toBe("test_failure");

      task.verificationCommand = "test -f {tests}";
      task.verificationCwd = "tests";
      const scoped = await verifyOutcome(workspace.repo, task, tests);
      expect(scoped.command).toBe("test -f 'value.test.ts'");
      expect(scoped.passed).toBe(true);
      task.verificationCwd = "../outside";
      await expect(verifyOutcome(workspace.repo, task, tests)).rejects.toThrow(
        "verification cwd escapes the workspace",
      );

      task.verificationCwd = undefined;
      const reverified = await reverifyPatch(
        source,
        repository,
        task,
        patchPath,
        join(workspace.root, "reverification.log"),
      );
      expect(reverified.passed).toBe(true);

      task.verificationCommand =
        "grep -q 'value = 2' src/value.ts && test -f {tests}";
      const oracleVerification = await verifyOracleOutcome(
        source,
        repository,
        task,
      );
      expect(oracleVerification.passed).toBe(true);
    } finally {
      await destroyWorkspace(workspace);
    }
  });
});
