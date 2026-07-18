import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checked } from "../src/process";
import {
  capturePatch,
  destroyWorkspace,
  injectOracleTests,
  prepareWorkspace,
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
    await writeFile(
      join(source, "src", "value.ts"),
      "export const value = 1;\n",
    );
    await writeFile(join(source, "AGENTS.md"), "secret instructions\n");
    await checked(["git", "add", "-A"], source);
    await checked(["git", "commit", "-m", "chore: base"], source);
    const baseRevision = await checked(["git", "rev-parse", "HEAD"], source);
    await mkdir(join(source, "tests"));
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
      await checked(["git", "add", "src/value.ts"], workspace.repo);
      await checked(
        ["git", "commit", "-m", "fix: participant commit"],
        workspace.repo,
      );
      const patchPath = join(workspace.root, "participant.patch");
      await capturePatch(workspace.repo, patchPath, workspace.baseCommit);
      const patch = await Bun.file(patchPath).text();
      expect(patch).toContain("value = 3");
      expect(patch).toContain("src/new.ts");
      const tests = await injectOracleTests(
        source,
        task,
        workspace.repo,
        workspace.baseCommit,
      );
      expect(tests).toEqual(["tests/value.test.ts"]);
      expect((await verifyOutcome(workspace.repo, task, tests)).passed).toBe(
        true,
      );
    } finally {
      await destroyWorkspace(workspace);
    }
  });
});
