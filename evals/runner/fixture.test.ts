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
import { dirname, join } from "node:path";
import {
  buildFixture,
  destroyFixture,
  filterAdditionalSkillDirs,
  readActivationProbe,
} from "./fixture";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("eval fixture skill mounts", () => {
  test("omits case-declared unavailable additional skills", () => {
    expect(
      filterAdditionalSkillDirs(
        ["/plugins/ticket-to-pr", "/plugins/adaptive-goal"],
        ["adaptive-goal"],
      ),
    ).toEqual(["/plugins/ticket-to-pr"]);
  });

  test("blocks forge CLIs unless a fixture explicitly supplies a mock", async () => {
    const fixture = await buildFixture({
      fixture: {},
      skillDir: "",
      skillMounts: [],
    });
    cleanup.push(fixture);

    const gh = join(fixture, ".git", "fixture-bin", "gh");
    const blocked = Bun.spawnSync([gh, "pr", "create"], { cwd: fixture });
    expect(blocked.exitCode).not.toBe(0);
    expect(blocked.stderr.toString()).toContain("disabled unless fixture.bin");

    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);

    const optedIn = await buildFixture({
      fixture: {
        bin: {
          gh: "#!/bin/sh\nprintf '%s\\n' mocked\n",
        },
      },
      skillDir: "",
      skillMounts: [],
    });
    cleanup.push(optedIn);
    const mock = Bun.spawnSync(
      [join(optedIn, ".git", "fixture-bin", "gh"), "pr", "create"],
      { cwd: optedIn },
    );
    expect(mock.exitCode).toBe(0);
    expect(mock.stdout.toString()).toBe("mocked\n");

    await destroyFixture(optedIn);
    cleanup.splice(cleanup.indexOf(optedIn), 1);
  });

  test("injects and reads a private activation sentinel", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-probe-"));
    cleanup.push(root);
    const skill = join(root, "plugins", "sample", "skills", "primary");
    await mkdir(skill, { recursive: true });
    await writeFile(
      join(skill, "SKILL.md"),
      "---\nname: primary\ndescription: Primary\n---\n\nFollow the workflow.\n",
    );

    const fixture = await buildFixture({
      fixture: {},
      skillDir: skill,
      skillMounts: [".agents/skills"],
      activationProbe: { token: "probe-token" },
    });
    cleanup.push(fixture);
    const mounted = await readFile(
      join(fixture, ".agents", "skills", "primary", "SKILL.md"),
      "utf8",
    );
    expect(mounted).toContain("Evaluation activation observation");
    expect(mounted).toContain("probe-token");

    expect(await readActivationProbe(fixture, "probe-token")).toEqual({
      source: "skill_activation_probe",
      complete: true,
      primarySkill: null,
      observedSkills: [],
    });
    await mkdir(join(fixture, ".git", "darrow-eval"), { recursive: true });
    await writeFile(
      join(fixture, ".git", "darrow-eval", "skill-activation.tsv"),
      "primary\tprobe-token\n",
    );
    expect(await readActivationProbe(fixture, "probe-token")).toEqual({
      source: "skill_activation_probe",
      complete: true,
      primarySkill: "primary",
      observedSkills: ["primary"],
    });

    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("mounts a source Claude plugin without a project skill copy", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-agents-"));
    cleanup.push(root);
    const skill = join(root, "plugins", "sample", "skills", "primary");
    const agents = join(root, "plugins", "sample", "agents");
    const manifest = join(
      root,
      "plugins",
      "sample",
      ".claude-plugin",
      "plugin.json",
    );
    await mkdir(skill, { recursive: true });
    await mkdir(agents, { recursive: true });
    await mkdir(dirname(manifest), { recursive: true });
    await writeFile(
      join(skill, "SKILL.md"),
      "---\nname: primary\ndescription: Primary\n---\n",
    );
    await writeFile(
      join(agents, "runner.md"),
      "---\nname: runner\ndescription: Runner\n---\n",
    );
    await writeFile(
      manifest,
      '{"name":"sample","version":"0.1.0","description":"Sample"}\n',
    );

    const fixture = await buildFixture({
      fixture: {},
      skillDir: skill,
      skillMounts: [],
      sourceClaudePlugin: true,
    });
    cleanup.push(fixture);
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
      existsSync(join(fixture, ".git", "eval-plugin", "agents", "runner.md")),
    ).toBe(true);
    expect(existsSync(join(fixture, ".agents", "agents", "runner.md"))).toBe(
      false,
    );
    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("bridges an explicit headless Claude entrypoint only in the mounted copy", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-claude-bridge-"));
    cleanup.push(root);
    const plugin = join(root, "plugins", "sample");
    const skill = join(plugin, "skills", "primary");
    const sibling = join(plugin, "skills", "secondary");
    await mkdir(skill, { recursive: true });
    await mkdir(sibling, { recursive: true });
    await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
    const source =
      "---\nname: primary\ndescription: Primary\ndisable-model-invocation: true\n---\n\nFollow it.\n";
    await writeFile(join(skill, "SKILL.md"), source);
    await writeFile(
      join(sibling, "SKILL.md"),
      source.replaceAll("primary", "secondary"),
    );
    await writeFile(
      join(plugin, ".claude-plugin", "plugin.json"),
      '{"name":"sample","version":"0.1.0","description":"Sample"}\n',
    );

    const fixture = await buildFixture({
      fixture: {},
      skillDir: skill,
      skillMounts: [],
      sourceClaudePlugin: true,
      mountPluginSkills: true,
      claudeExplicitEntrypointBridge: true,
    });
    cleanup.push(fixture);
    const mounted = await readFile(
      join(fixture, ".git", "eval-plugin", "skills", "primary", "SKILL.md"),
      "utf8",
    );
    expect(mounted).not.toContain("disable-model-invocation");
    expect(
      await readFile(
        join(fixture, ".git", "eval-plugin", "skills", "secondary", "SKILL.md"),
        "utf8",
      ),
    ).toContain("disable-model-invocation: true");
    expect(await readFile(join(skill, "SKILL.md"), "utf8")).toBe(source);

    await destroyFixture(fixture);
    cleanup.splice(cleanup.indexOf(fixture), 1);
  });

  test("builds a filtered local marketplace for an installed Codex plugin", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-codex-plugin-"));
    cleanup.push(root);
    const plugin = join(root, "plugins", "sample");
    const skill = join(plugin, "skills", "primary");
    await mkdir(join(skill, "evals"), { recursive: true });
    await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
    await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
    await writeFile(
      join(skill, "SKILL.md"),
      "---\nname: primary\ndescription: Primary\n---\n",
    );
    await writeFile(join(skill, "evals", "secret.yaml"), "hidden: true\n");
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

  test("mounts an independently packaged capability with its plugin mechanics", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-fixture-composition-"));
    cleanup.push(root);
    const primaryPlugin = join(root, "plugins", "recipe");
    const capabilityPlugin = join(root, "plugins", "goal-loop");
    const primary = join(primaryPlugin, "skills", "ticket-to-pr");
    const capability = join(capabilityPlugin, "skills", "adaptive-goal");
    await mkdir(primary, { recursive: true });
    await mkdir(capability, { recursive: true });
    await mkdir(join(primaryPlugin, ".claude-plugin"), { recursive: true });
    await mkdir(join(primaryPlugin, ".codex-plugin"), { recursive: true });
    await mkdir(join(capabilityPlugin, ".claude-plugin"), { recursive: true });
    await mkdir(join(capabilityPlugin, ".codex-plugin"), { recursive: true });
    await mkdir(join(capabilityPlugin, "bin"), { recursive: true });
    await mkdir(join(capabilityPlugin, "agents"), { recursive: true });
    await writeFile(
      join(primary, "SKILL.md"),
      "---\nname: ticket-to-pr\ndescription: Recipe\n---\n",
    );
    await writeFile(
      join(capability, "SKILL.md"),
      "---\nname: adaptive-goal\ndescription: Goal\n---\n",
    );
    await writeFile(
      join(primaryPlugin, ".claude-plugin", "plugin.json"),
      '{"name":"recipe","version":"0.1.0","description":"Recipe"}\n',
    );
    await writeFile(
      join(primaryPlugin, ".codex-plugin", "plugin.json"),
      '{"name":"recipe","version":"0.1.0","description":"Recipe","skills":"./skills/"}\n',
    );
    await writeFile(
      join(capabilityPlugin, ".claude-plugin", "plugin.json"),
      '{"name":"goal-loop","version":"0.1.0","description":"Goal loop"}\n',
    );
    await writeFile(
      join(capabilityPlugin, ".codex-plugin", "plugin.json"),
      '{"name":"goal-loop","version":"0.1.0","description":"Goal loop","skills":"./skills/"}\n',
    );
    await writeFile(join(capabilityPlugin, "bin", "goal-loop"), "#!/bin/sh\n");
    await writeFile(join(capabilityPlugin, "agents", "worker.md"), "worker\n");

    const fixture = await buildFixture({
      fixture: {},
      skillDir: primary,
      additionalSkillDirs: [capability],
      skillMounts: [".agents/skills"],
      sourceClaudePlugin: true,
      sourceCodexPlugin: true,
    });
    cleanup.push(fixture);
    expect(
      existsSync(
        join(fixture, ".agents", "skills", "adaptive-goal", "SKILL.md"),
      ),
    ).toBe(true);
    expect(existsSync(join(fixture, ".agents", "bin", "goal-loop"))).toBe(true);
    expect(
      existsSync(
        join(
          fixture,
          ".git",
          "eval-plugins",
          "goal-loop",
          "skills",
          "adaptive-goal",
          "SKILL.md",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          fixture,
          ".git",
          "eval-plugins",
          "goal-loop",
          "agents",
          "worker.md",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(fixture, ".git", "eval-plugin", "skills", "adaptive-goal"),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(
          fixture,
          ".git",
          "eval-marketplace",
          "plugins",
          "goal-loop",
          "agents",
          "worker.md",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          fixture,
          ".git",
          "eval-marketplace",
          "plugins",
          "goal-loop",
          "skills",
          "adaptive-goal",
          "SKILL.md",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          fixture,
          ".git",
          "eval-marketplace",
          "plugins",
          "goal-loop",
          "bin",
          "goal-loop",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          fixture,
          ".git",
          "eval-marketplace",
          "plugin",
          "skills",
          "adaptive-goal",
        ),
      ),
    ).toBe(false);
    const marketplace = JSON.parse(
      await readFile(
        join(
          fixture,
          ".git",
          "eval-marketplace",
          ".claude-plugin",
          "marketplace.json",
        ),
        "utf8",
      ),
    ) as {
      plugins: Array<{ name: string; source: string; description: string }>;
    };
    expect(marketplace.plugins).toEqual([
      {
        name: "recipe",
        source: "./plugin",
        description: "Filtered source plugin for evaluation",
      },
      {
        name: "goal-loop",
        source: "./plugins/goal-loop",
        description: "Filtered source plugin for evaluation",
      },
    ]);
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
