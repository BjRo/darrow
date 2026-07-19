import { afterEach, describe, expect, test } from "bun:test";
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const SOURCE_GENERATOR = resolve(import.meta.dir, "plugin-projections.ts");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

function command(cwd: string, argv: string[]): CommandResult {
  const result = Bun.spawnSync(argv, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function git(cwd: string, args: string[]): CommandResult {
  return command(cwd, ["git", ...args]);
}

function run(root: string, args: string[]): CommandResult {
  return command(root, [
    "bun",
    resolve(root, "scripts", "plugin-projections.ts"),
    ...args,
  ]);
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-projection-test-"));
  temporaryRoots.push(root);
  await mkdir(resolve(root, "scripts"), { recursive: true });
  await cp(SOURCE_GENERATOR, resolve(root, "scripts", "plugin-projections.ts"));

  const plugin = resolve(root, "plugins", "sample-plugin");
  await mkdir(resolve(plugin, ".claude-plugin"), { recursive: true });
  await mkdir(resolve(plugin, ".codex-plugin"), { recursive: true });
  await mkdir(resolve(plugin, "source", "sample", "scripts"), {
    recursive: true,
  });
  await mkdir(resolve(plugin, "source", "sample", "evals"), {
    recursive: true,
  });
  await mkdir(resolve(plugin, "overlays", "codex", "sample", "agents"), {
    recursive: true,
  });
  await writeFile(
    resolve(plugin, ".claude-plugin", "plugin.json"),
    `${JSON.stringify(
      {
        name: "sample-plugin",
        version: "1.2.3",
        skills: "./claude-skills/",
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    resolve(plugin, ".codex-plugin", "plugin.json"),
    `${JSON.stringify(
      {
        name: "sample-plugin",
        version: "1.2.3",
        skills: "./codex-skills/",
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    resolve(plugin, "source", "sample", "SKILL.md"),
    "# Shared skill\n",
  );
  await writeFile(
    resolve(plugin, "source", "sample", "darrow.json"),
    '{"schemaVersion":1,"kind":"capability","provides":[{"contract":"sample.read","version":"1.0.0"}]}\n',
  );
  await writeFile(
    resolve(plugin, "source", "sample", "scripts", "run.sh"),
    "#!/bin/sh\nexit 0\n",
  );
  await writeFile(
    resolve(plugin, "source", "sample", "evals", "case.yaml"),
    "id: sample\ninvariant: CP-12c\n",
  );
  await writeFile(
    resolve(plugin, "overlays", "codex", "sample", "agents", "openai.yaml"),
    "interface:\n  display_name: Sample\n",
  );
  return root;
}

async function initializeGit(root: string): Promise<void> {
  expect(git(root, ["init", "-q", "-b", "main"]).code).toBe(0);
  expect(git(root, ["config", "user.name", "Projection Test"]).code).toBe(0);
  expect(
    git(root, ["config", "user.email", "projection@example.com"]).code,
  ).toBe(0);
  expect(git(root, ["add", "-A"]).code).toBe(0);
  expect(git(root, ["commit", "-qm", "fixture"]).code).toBe(0);
}

async function runStagedCheck(worktree: string): Promise<CommandResult> {
  const staged = await mkdtemp(resolve(tmpdir(), "darrow-staged-test-"));
  temporaryRoots.push(staged);
  const checkout = git(worktree, [
    "checkout-index",
    "--all",
    `--prefix=${staged}/`,
  ]);
  expect(checkout.code, checkout.stderr).toBe(0);
  return run(staged, ["check-staged", worktree]);
}

describe("plugin projection generation", () => {
  test("generates deterministic shared and harness-specific projections", async () => {
    const root = await fixture();
    const generated = run(root, ["generate"]);
    expect(generated.code, generated.stderr).toBe(0);
    const plugin = resolve(root, "plugins", "sample-plugin");
    expect(
      await readFile(
        resolve(plugin, "claude-skills", "sample", "SKILL.md"),
        "utf8",
      ),
    ).toBe("# Shared skill\n");
    expect(
      await Bun.file(
        resolve(plugin, "codex-skills", "sample", "agents", "openai.yaml"),
      ).exists(),
    ).toBe(true);
    expect(
      await Bun.file(
        resolve(plugin, "claude-skills", "sample", "agents", "openai.yaml"),
      ).exists(),
    ).toBe(false);
    const firstLock = await readFile(
      resolve(plugin, "projection.lock.json"),
      "utf8",
    );
    expect(firstLock).not.toContain(root);
    expect(run(root, ["generate"]).code).toBe(0);
    expect(
      await readFile(resolve(plugin, "projection.lock.json"), "utf8"),
    ).toBe(firstLock);
    expect(run(root, ["check"]).code).toBe(0);
  });

  test("requires both projections after a shared source change", async () => {
    const root = await fixture();
    expect(run(root, ["generate"]).code).toBe(0);
    const plugin = resolve(root, "plugins", "sample-plugin");
    await writeFile(
      resolve(plugin, "source", "sample", "SKILL.md"),
      "# Updated shared skill\n",
    );
    const stale = run(root, ["check"]);
    expect(stale.code).toBe(1);
    expect(stale.stderr).toContain(
      "run: bun run plugins:generate -- sample-plugin",
    );
    expect(run(root, ["generate", "sample-plugin"]).code).toBe(0);
    for (const projection of ["claude-skills", "codex-skills"])
      expect(
        await readFile(
          resolve(plugin, projection, "sample", "SKILL.md"),
          "utf8",
        ),
      ).toBe("# Updated shared skill\n");
  });

  test("permits an exact one-sided harness overlay change", async () => {
    const root = await fixture();
    expect(run(root, ["generate"]).code).toBe(0);
    const plugin = resolve(root, "plugins", "sample-plugin");
    const claudeBefore = await readFile(
      resolve(plugin, "claude-skills", "sample", "SKILL.md"),
      "utf8",
    );
    await writeFile(
      resolve(plugin, "overlays", "codex", "sample", "agents", "openai.yaml"),
      "interface:\n  display_name: Optimized Sample\n",
    );
    expect(run(root, ["generate", "sample-plugin"]).code).toBe(0);
    expect(
      await readFile(
        resolve(plugin, "codex-skills", "sample", "agents", "openai.yaml"),
        "utf8",
      ),
    ).toContain("Optimized Sample");
    expect(
      await readFile(
        resolve(plugin, "claude-skills", "sample", "SKILL.md"),
        "utf8",
      ),
    ).toBe(claudeBefore);
  });

  test("rejects direct generated edits and protected overlays", async () => {
    const root = await fixture();
    expect(run(root, ["generate"]).code).toBe(0);
    const plugin = resolve(root, "plugins", "sample-plugin");
    await writeFile(
      resolve(plugin, "codex-skills", "sample", "SKILL.md"),
      "# Manual edit\n",
    );
    const manual = run(root, ["check"]);
    expect(manual.code).toBe(1);
    expect(manual.stderr).toContain("stale generated projection");

    await mkdir(resolve(plugin, "overlays", "claude", "sample", "scripts"), {
      recursive: true,
    });
    await writeFile(
      resolve(plugin, "overlays", "claude", "sample", "scripts", "run.sh"),
      "#!/bin/sh\nexit 1\n",
    );
    const protectedChange = run(root, ["generate"]);
    expect(protectedChange.code).toBe(1);
    expect(protectedChange.stderr).toContain(
      "overlay cannot replace canonical mechanics",
    );
  });

  test("records generator changes in every plugin lock", async () => {
    const root = await fixture();
    expect(run(root, ["generate"]).code).toBe(0);
    await appendFile(
      resolve(root, "scripts", "plugin-projections.ts"),
      "\n// deterministic test change\n",
    );
    const stale = run(root, ["check"]);
    expect(stale.code).toBe(1);
    expect(stale.stderr).toContain("stale projection lock");
  });

  test("checks partial staging and skips unaffected plugins", async () => {
    const root = await fixture();
    expect(run(root, ["generate"]).code).toBe(0);
    await writeFile(resolve(root, "README.md"), "fixture\n");
    await initializeGit(root);

    const plugin = resolve(root, "plugins", "sample-plugin");
    await writeFile(
      resolve(plugin, "source", "sample", "SKILL.md"),
      "# Partially staged source\n",
    );
    expect(run(root, ["generate"]).code).toBe(0);
    expect(
      git(root, ["add", "plugins/sample-plugin/source/sample/SKILL.md"]).code,
    ).toBe(0);
    const partial = await runStagedCheck(root);
    expect(partial.code).toBe(1);
    expect(partial.stderr).toContain("stale generated projection");

    const cleanRoot = await fixture();
    expect(run(cleanRoot, ["generate"]).code).toBe(0);
    await writeFile(resolve(cleanRoot, "README.md"), "fixture\n");
    await initializeGit(cleanRoot);
    await writeFile(resolve(cleanRoot, "README.md"), "ordinary docs\n");
    expect(git(cleanRoot, ["add", "README.md"]).code).toBe(0);
    const unaffected = await runStagedCheck(cleanRoot);
    expect(unaffected.code, unaffected.stderr).toBe(0);
    expect(unaffected.stdout).toContain("no affected plugins");
  });

  test("accepts a fully staged one-sided overlay projection", async () => {
    const root = await fixture();
    expect(run(root, ["generate"]).code).toBe(0);
    await initializeGit(root);
    const plugin = resolve(root, "plugins", "sample-plugin");
    await writeFile(
      resolve(plugin, "overlays", "codex", "sample", "agents", "openai.yaml"),
      "interface:\n  display_name: Staged Codex\n",
    );
    expect(run(root, ["generate", "sample-plugin"]).code).toBe(0);
    expect(
      git(root, [
        "add",
        "plugins/sample-plugin/overlays/codex",
        "plugins/sample-plugin/codex-skills",
        "plugins/sample-plugin/projection.lock.json",
      ]).code,
    ).toBe(0);
    const stagedNames = git(root, ["diff", "--cached", "--name-only"]);
    expect(stagedNames.stdout).not.toContain("claude-skills");
    const checked = await runStagedCheck(root);
    expect(checked.code, checked.stderr).toBe(0);
    expect(checked.stdout).toContain("plugin projections current");
  });
});
