import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixture, destroyFixture } from "./fixture";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("eval fixture skill mounts", () => {
  test("optionally mounts every plugin skill without exposing colocated evals", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-plugin-"));
    cleanup.push(root);
    const primary = join(root, "plugins", "sample", "skills", "primary");
    const secondary = join(root, "plugins", "sample", "skills", "secondary");
    await mkdir(join(primary, "evals"), { recursive: true });
    await mkdir(join(secondary, "evals"), { recursive: true });
    await writeFile(
      join(primary, "SKILL.md"),
      "---\nname: primary\ndescription: Primary\n---\n",
    );
    await writeFile(join(primary, "evals", "secret.yaml"), "hidden: true\n");
    await writeFile(
      join(secondary, "SKILL.md"),
      "---\nname: secondary\ndescription: Secondary\n---\n",
    );
    await writeFile(join(secondary, "evals", "secret.yaml"), "hidden: true\n");

    const fixture = await buildFixture({}, primary, [".agents/skills"], true);
    cleanup.push(fixture);
    expect(
      existsSync(join(fixture, ".agents", "skills", "primary", "SKILL.md")),
    ).toBe(true);
    expect(
      existsSync(join(fixture, ".agents", "skills", "secondary", "SKILL.md")),
    ).toBe(true);
    expect(
      existsSync(join(fixture, ".agents", "skills", "primary", "evals")),
    ).toBe(false);
    expect(
      existsSync(join(fixture, ".agents", "skills", "secondary", "evals")),
    ).toBe(false);
    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("commits case scaffolding and provisions a local ticket", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-case-"));
    cleanup.push(root);
    const caseDir = join(root, "case");
    await mkdir(caseDir);
    await writeFile(join(caseDir, "marker.txt"), "prepared\n");

    const fixture = await buildFixture(
      {
        commits: [
          {
            message: "Initial commit",
            files: { "README.md": "fixture\n" },
          },
        ],
        files: { "AGENTS.md": "evaluation guidance\n" },
        commit_files: true,
        ticket: {
          id: "17",
          title: "Implement the benchmark task",
          body: "Original ticket body\n",
        },
        setup: 'cp "{{case_dir}}/marker.txt" .git/setup-marker.txt',
      },
      "",
      [],
      false,
      caseDir,
    );
    cleanup.push(fixture);

    const status = Bun.spawnSync(["git", "status", "--porcelain"], {
      cwd: fixture,
    });
    expect(status.stdout.toString()).toBe("");
    expect(
      await readFile(join(fixture, ".git", "setup-marker.txt"), "utf8"),
    ).toBe("prepared\n");

    const ticketctl = join(fixture, ".git", "fixture-bin", "ticketctl");
    const bodyPath = join(fixture, ".git", "ticket-body.md");
    const get = Bun.spawnSync(
      [ticketctl, "get", "17", "--body-file", bodyPath],
      {
        cwd: fixture,
      },
    );
    expect(get.exitCode).toBe(0);
    expect(get.stdout.toString()).toContain("Implement the benchmark task");
    expect(await readFile(bodyPath, "utf8")).toBe("Original ticket body\n");

    const replacement = join(fixture, ".git", "replacement.md");
    await writeFile(replacement, "Updated ticket body\n");
    const describe = Bun.spawnSync(
      [ticketctl, "describe", "17", "--body-file", replacement],
      { cwd: fixture },
    );
    expect(describe.exitCode).toBe(0);
    Bun.spawnSync([ticketctl, "get", "17", "--body-file", bodyPath], {
      cwd: fixture,
    });
    expect(await readFile(bodyPath, "utf8")).toBe("Updated ticket body\n");

    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("destroys a fixture containing a permission-locked directory", async () => {
    const fixture = await buildFixture({}, "", []);
    cleanup.push(fixture);
    const locked = join(fixture, "locked");
    await mkdir(locked);
    await writeFile(join(locked, "value.txt"), "locked\n");
    await chmod(locked, 0o000);

    let failure: unknown;
    try {
      await destroyFixture(fixture);
    } catch (error) {
      failure = error;
    } finally {
      if (existsSync(fixture)) await chmod(locked, 0o700);
    }
    expect(failure).toBeUndefined();
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });
});
