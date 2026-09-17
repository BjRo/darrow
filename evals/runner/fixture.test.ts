import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildFixture, destroyFixture } from "./fixture";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("eval fixture skill mounts", () => {
  test("hides reserved skill roots from setup-time preservation snapshots", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-excludes-"));
    cleanup.push(root);
    const skill = join(root, "plugins", "sample", "skills", "primary");
    await mkdir(skill, { recursive: true });
    await writeFile(
      join(skill, "SKILL.md"),
      "---\nname: primary\ndescription: Primary\n---\n",
    );

    const fixture = await buildFixture({
      fixture: {
        setup: [
          "mkdir -p .agents/setup",
          "printf '%s\\n' harness >.agents/setup/state",
          "git ls-files --others --exclude-standard >.git/setup-untracked",
        ].join("\n"),
      },
      skillDir: skill,
      skillMounts: [".agents/skills"],
    });
    cleanup.push(fixture);
    expect(
      await readFile(join(fixture, ".git", "setup-untracked"), "utf8"),
    ).toBe("");
    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("mounts a source Claude plugin without a project skill copy", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-agents-"));
    cleanup.push(root);
    const skill = join(root, "plugins", "sample", "skills", "primary");
    const agents = join(root, "plugins", "sample", "agents");
    const hooks = join(root, "plugins", "sample", "hooks");
    const manifest = join(
      root,
      "plugins",
      "sample",
      ".claude-plugin",
      "plugin.json",
    );
    await mkdir(skill, { recursive: true });
    await mkdir(join(skill, "backend", ".venv"), { recursive: true });
    await mkdir(agents, { recursive: true });
    await mkdir(hooks, { recursive: true });
    await mkdir(dirname(manifest), { recursive: true });
    await writeFile(
      join(skill, "SKILL.md"),
      "---\nname: primary\ndescription: Primary\n---\n",
    );
    await writeFile(join(skill, "backend", "pyproject.toml"), "[project]\n");
    await writeFile(join(skill, "backend", ".venv", "generated"), "ignored\n");
    await writeFile(
      join(agents, "runner.md"),
      "---\nname: runner\ndescription: Runner\n---\n",
    );
    await writeFile(
      manifest,
      '{"name":"sample","version":"0.1.0","description":"Sample"}\n',
    );
    await writeFile(join(hooks, "hooks.json"), '{"hooks":{"PreToolUse":[]}}\n');

    const fixture = await buildFixture({
      fixture: {},
      skillDir: skill,
      skillMounts: [],
      sourceClaudePlugin: true,
    });
    cleanup.push(fixture);
    expect(fixture).toBe(realpathSync(fixture));
    expect(
      existsSync(join(fixture, ".claude", "skills", "primary", "SKILL.md")),
    ).toBe(false);
    expect(existsSync(join(fixture, ".claude", "agents", "runner.md"))).toBe(
      false,
    );
    expect(
      existsSync(
        join(fixture, ".git", "eval-plugin", ".claude-plugin", "plugin.json"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(fixture, ".git", "eval-plugin", "skills", "primary", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          fixture,
          ".git",
          "eval-plugin",
          "skills",
          "primary",
          "backend",
          "pyproject.toml",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          fixture,
          ".git",
          "eval-plugin",
          "skills",
          "primary",
          "backend",
          ".venv",
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(join(fixture, ".git", "eval-plugin", "agents", "runner.md")),
    ).toBe(true);
    expect(
      existsSync(join(fixture, ".git", "eval-plugin", "hooks", "hooks.json")),
    ).toBe(true);
    expect(existsSync(join(fixture, ".agents", "agents", "runner.md"))).toBe(
      false,
    );
    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("builds a filtered local marketplace for an installed Codex plugin", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-codex-plugin-"));
    cleanup.push(root);
    const plugin = join(root, "plugins", "sample");
    const skill = join(plugin, "skills", "primary");
    await mkdir(join(skill, "evals"), { recursive: true });
    await mkdir(join(skill, "backend", ".pytest_cache"), { recursive: true });
    await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
    await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
    await writeFile(
      join(skill, "SKILL.md"),
      "---\nname: primary\ndescription: Primary\n---\n",
    );
    await writeFile(join(skill, "evals", "secret.yaml"), "hidden: true\n");
    await writeFile(join(skill, "backend", "pyproject.toml"), "[project]\n");
    await writeFile(
      join(skill, "backend", ".pytest_cache", "generated"),
      "ignored\n",
    );
    await writeFile(
      join(plugin, ".claude-plugin", "plugin.json"),
      '{"name":"sample","version":"0.1.0","description":"Sample"}\n',
    );
    await writeFile(
      join(plugin, ".codex-plugin", "plugin.json"),
      '{"name":"sample","version":"0.1.0","description":"Sample","skills":"./skills/"}\n',
    );

    const fixture = await buildFixture({
      fixture: {},
      skillDir: skill,
      skillMounts: [],
      sourceCodexPlugin: true,
    });
    cleanup.push(fixture);
    const marketplace = join(fixture, ".git", "eval-marketplace");
    expect(
      existsSync(join(fixture, ".agents", "skills", "primary", "SKILL.md")),
    ).toBe(false);
    expect(
      existsSync(join(marketplace, ".claude-plugin", "marketplace.json")),
    ).toBe(true);
    expect(
      existsSync(join(marketplace, "plugin", ".codex-plugin", "plugin.json")),
    ).toBe(true);
    expect(
      existsSync(join(marketplace, "plugin", "skills", "primary", "SKILL.md")),
    ).toBe(true);
    expect(
      existsSync(join(marketplace, "plugin", "skills", "primary", "evals")),
    ).toBe(false);
    expect(
      existsSync(
        join(
          marketplace,
          "plugin",
          "skills",
          "primary",
          "backend",
          "pyproject.toml",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          marketplace,
          "plugin",
          "skills",
          "primary",
          "backend",
          ".pytest_cache",
        ),
      ),
    ).toBe(false);
    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

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

    const fixture = await buildFixture({
      fixture: {},
      skillDir: primary,
      skillMounts: [".agents/skills"],
      mountPluginSkills: true,
    });
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

  test("packages composition skills with explicitly selected plugin mechanics", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-composition-"));
    cleanup.push(root);
    const recipe = join(root, "plugins", "recipe", "skills", "recipe");
    const orchestration = join(root, "plugins", "orchestration");
    const adaptive = join(orchestration, "skills", "adaptive");
    await mkdir(recipe, { recursive: true });
    await mkdir(adaptive, { recursive: true });
    await mkdir(join(orchestration, ".claude-plugin"), { recursive: true });
    await mkdir(join(orchestration, ".codex-plugin"), { recursive: true });
    await mkdir(join(orchestration, "bin"), { recursive: true });
    await writeFile(
      join(recipe, "SKILL.md"),
      "---\nname: recipe\ndescription: Recipe\n---\n",
    );
    await writeFile(
      join(adaptive, "SKILL.md"),
      "---\nname: adaptive\ndescription: Adaptive\n---\n",
    );
    await writeFile(
      join(orchestration, ".claude-plugin", "plugin.json"),
      '{"name":"orchestration","version":"0.1.0","description":"Orchestration"}\n',
    );
    await writeFile(
      join(orchestration, ".codex-plugin", "plugin.json"),
      '{"name":"orchestration","version":"0.1.0","description":"Orchestration","skills":"./skills/"}\n',
    );
    await writeFile(join(orchestration, "bin", "runner"), "fixture runner\n");

    const fixture = await buildFixture({
      fixture: {},
      skillDir: recipe,
      skillMounts: [],
      sourceClaudePlugin: true,
      sourcePluginRoot: orchestration,
      additionalSkillDirs: [adaptive],
    });
    cleanup.push(fixture);
    const plugin = join(fixture, ".git", "eval-plugin");
    expect(
      await readFile(join(plugin, ".claude-plugin", "plugin.json"), "utf8"),
    ).toContain('"name":"orchestration"');
    expect(existsSync(join(plugin, "skills", "recipe", "SKILL.md"))).toBe(true);
    expect(existsSync(join(plugin, "skills", "adaptive", "SKILL.md"))).toBe(
      true,
    );
    expect(existsSync(join(plugin, "bin", "runner"))).toBe(true);
    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("installs composition plugins as separate packages", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-multi-plugin-"));
    cleanup.push(root);
    const recipeRoot = join(root, "plugins", "recipe");
    const recipe = join(recipeRoot, "skills", "recipe");
    const orchestrationRoot = join(root, "plugins", "orchestration");
    const adaptive = join(orchestrationRoot, "skills", "adaptive");
    for (const plugin of [recipeRoot, orchestrationRoot]) {
      await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
      await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
    }
    await mkdir(recipe, { recursive: true });
    await mkdir(adaptive, { recursive: true });
    await mkdir(join(orchestrationRoot, "bin"), { recursive: true });
    await writeFile(
      join(recipe, "SKILL.md"),
      "---\nname: recipe\ndescription: Recipe\n---\n",
    );
    await writeFile(
      join(adaptive, "SKILL.md"),
      "---\nname: adaptive\ndescription: Adaptive\n---\n",
    );
    for (const [plugin, name] of [
      [recipeRoot, "recipe"],
      [orchestrationRoot, "orchestration"],
    ] as const) {
      await writeFile(
        join(plugin, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name, version: "0.1.0", description: name }) + "\n",
      );
      await writeFile(
        join(plugin, ".codex-plugin", "plugin.json"),
        JSON.stringify({
          name,
          version: "0.1.0",
          description: name,
          skills: "./skills/",
        }) + "\n",
      );
    }
    await writeFile(
      join(orchestrationRoot, "bin", "adaptive-delivery-preflight"),
      "fixture runner\n",
    );

    const fixture = await buildFixture({
      fixture: {},
      skillDir: recipe,
      skillMounts: [],
      sourceClaudePlugin: true,
      sourceCodexPlugin: true,
      additionalPluginRoots: [orchestrationRoot],
    });
    cleanup.push(fixture);

    const claudePrimary = join(fixture, ".git", "eval-plugin");
    const claudeAdditional = join(
      fixture,
      ".git",
      "eval-plugins",
      "0-orchestration",
    );
    expect(
      existsSync(join(claudePrimary, "skills", "recipe", "SKILL.md")),
    ).toBe(true);
    expect(existsSync(join(claudePrimary, "skills", "adaptive"))).toBe(false);
    expect(
      existsSync(join(claudeAdditional, "skills", "adaptive", "SKILL.md")),
    ).toBe(true);
    expect(existsSync(join(claudeAdditional, "skills", "recipe"))).toBe(false);
    expect(
      existsSync(join(claudeAdditional, "bin", "adaptive-delivery-preflight")),
    ).toBe(true);

    const marketplace = join(fixture, ".git", "eval-marketplace");
    const catalog = JSON.parse(
      await readFile(
        join(marketplace, ".claude-plugin", "marketplace.json"),
        "utf8",
      ),
    ) as {
      plugins: Array<{ name: string; source: string; description: string }>;
    };
    expect(catalog.plugins).toEqual([
      { name: "recipe", source: "./plugin", description: expect.any(String) },
      {
        name: "orchestration",
        source: "./plugins/0-orchestration",
        description: expect.any(String),
      },
    ]);
    expect(existsSync(join(marketplace, "plugin", "skills", "adaptive"))).toBe(
      false,
    );
    expect(
      existsSync(
        join(
          marketplace,
          "plugins",
          "0-orchestration",
          "skills",
          "adaptive",
          "SKILL.md",
        ),
      ),
    ).toBe(true);
    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("commits case scaffolding and provisions a local ticket", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-case-"));
    cleanup.push(root);
    const caseDir = join(root, "case");
    await mkdir(caseDir);
    await writeFile(join(caseDir, "marker.txt"), "prepared\n");

    const fixture = await buildFixture({
      fixture: {
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
      skillDir: "",
      skillMounts: [],
      caseDir,
    });
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
    const compatibilityLog = join(fixture, ".git", "ticketctl.log");
    expect((await lstat(compatibilityLog)).isSymbolicLink()).toBe(true);
    expect(await readlink(compatibilityLog)).toBe(
      "fixture-state/ticketctl.log",
    );
    expect(
      await readFile(
        join(fixture, ".git", "fixture-state", "ticketctl.log"),
        "utf8",
      ),
    ).toBe("get 17\ndescribe 17\nget 17\n");

    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("destroys a fixture containing a permission-locked directory", async () => {
    const fixture = await buildFixture({
      fixture: {},
      skillDir: "",
      skillMounts: [],
    });
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
