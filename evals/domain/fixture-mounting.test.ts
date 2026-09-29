import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  preparePolicy,
  policyProject,
  runPolicyPrompt,
} from "./policy-project";

type Artifact = {
  relativePath: string;
  contentBase64: string;
  sha256: string;
  gitExclude: boolean;
};

test.each(["project", "claude", "codex"] as const)(
  "Darrow preserves the owning plugin backend through public %s preparation",
  async (route: "project" | "claude" | "codex") => {
    const project = await policyProject(
      {
        prompt:
          route === "codex" ? "Run {{skill_invocation}}." : "Return ready.",
      },
      { skill: "primary" },
    );
    const plugin = join(project.root, "plugins/capability/sample");
    const backend = join(plugin, "backend");
    for (const directory of [".venv", "evals", "tests/evals"])
      await mkdir(join(backend, directory), { recursive: true });
    const contents = "[project]\nname = 'fixture-backend'\n";
    await writeFile(join(backend, "pyproject.toml"), contents);
    await writeFile(join(backend, ".venv/generated"), "private\n");
    await writeFile(join(backend, "evals/secret.yaml"), "hidden\n");
    await writeFile(join(backend, "tests/evals/oracle.py"), "hidden\n");
    await writeFile(
      join(plugin, ".claude-plugin/hooks.json"),
      '{"hooks":{"SessionStart":[]}}\n',
    );
    const selected = await project.resolve();
    const prepared = await preparePolicy(
      selected,
      route === "claude" ? "claude" : "codex",
    );
    const artifacts = prepared.artifacts as Artifact[];
    const destination =
      route === "project" ? ".agents" : ".sevro-marketplace/plugin";
    const resource = artifacts.find(
      (artifact) =>
        artifact.relativePath === `${destination}/backend/pyproject.toml`,
    );
    expect(resource).toBeDefined();
    expect(Buffer.from(resource!.contentBase64, "base64").toString()).toBe(
      contents,
    );
    expect(resource!.sha256).toBe(
      createHash("sha256").update(contents).digest("hex"),
    );
    expect(resource!.gitExclude).toBe(true);
    expect(
      artifacts.some((artifact) =>
        /\/(?:evals|\.venv)\//.test(artifact.relativePath),
      ),
    ).toBe(false);
    expect(
      artifacts.some(
        (artifact) =>
          artifact.relativePath === `${destination}/.claude-plugin/hooks.json`,
      ),
    ).toBe(route !== "project");
  },
);

test("Darrow mounts the implicit Codex backend through the installed command", async () => {
  const project = await policyProject({ prompt: "Return ready." });
  const backend = join(project.root, "plugins/capability/sample/backend");
  await mkdir(join(backend, "tests/evals"), { recursive: true });
  await mkdir(join(backend, ".venv"), { recursive: true });
  await writeFile(join(backend, "pyproject.toml"), "[project]\n");
  await writeFile(join(backend, "tests/evals/oracle.py"), "hidden\n");
  await writeFile(join(backend, ".venv/generated"), "private\n");
  await project.write({
    checks: [
      {
        name: "owning backend is mounted and excluded from Git",
        run: 'test -f .agents/backend/pyproject.toml && test -z "$(git status --porcelain)"',
      },
      {
        name: "hidden backend evals and generated environments stay absent",
        run: "test ! -e .agents/backend/tests/evals && test ! -e .agents/backend/.venv",
      },
    ],
  });
  const result = await runPolicyPrompt(project, "codex", "Return ready.");
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(
    result.value.cases[0]?.trials[0]?.checks.map((check) => check.status),
  ).toEqual(["passed", "passed", "passed"]);
}, 20_000);

test("Darrow rejects external links in an implicit plugin backend", async () => {
  const project = await policyProject({ prompt: "Return ready." });
  const backend = join(project.root, "plugins/capability/sample/backend");
  await mkdir(backend, { recursive: true });
  const external = join(project.root, "external.txt");
  await writeFile(external, "outside the plugin\n");
  await symlink(external, join(backend, "external.txt"));
  const selected = await project.resolve();
  await expect(preparePolicy(selected)).rejects.toThrow(
    /plugin package contains an unsafe entry/,
  );
});

test("Darrow excludes mounted artifacts while keeping unrelated setup files visible", async () => {
  const project = await policyProject({
    prompt: "Return ready.",
    fixture: {
      commits: [{ message: "Initial", files: { "README.md": "fixture\n" } }],
      setup: [
        "mkdir -p .agents/setup",
        "printf '%s\\n' harness >.agents/setup/state",
        "git ls-files --others --exclude-standard >.git/setup-untracked",
      ].join("\n"),
    },
    checks: [
      {
        name: "setup snapshot retains unrelated content",
        run: "printf '.agents/setup/state\\n' >.git/expected-setup-untracked && cmp .git/setup-untracked .git/expected-setup-untracked",
      },
      {
        name: "skill artifacts stay excluded after mounting",
        run: "git ls-files --others --exclude-standard",
        expect_exact: ".agents/setup/state",
      },
    ],
  });
  const result = await runPolicyPrompt(project, "codex", "Return ready.");
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(
    result.value.cases[0]?.trials[0]?.checks.map((check) => check.status),
  ).toEqual(["passed", "passed", "passed"]);
}, 20_000);

test.each(["claude", "codex"] as const)(
  "Darrow prepares filtered native %s resources without project copies",
  async (host) => {
    const project = await policyProject(
      { prompt: "{{skill_invocation}} Return ready." },
      { skill: "primary" },
    );
    const plugin = join(project.root, "plugins/capability/sample");
    const skill = join(plugin, "skills/primary");
    for (const directory of [
      "skills/primary/backend/.venv",
      "skills/primary/backend/.pytest_cache",
      "agents",
      "hooks",
    ])
      await mkdir(join(plugin, directory), { recursive: true });
    await writeFile(join(skill, "backend/pyproject.toml"), "[project]\n");
    await writeFile(join(skill, "backend/.venv/generated"), "ignored\n");
    await writeFile(
      join(skill, "backend/.pytest_cache/generated"),
      "ignored\n",
    );
    await writeFile(join(skill, "evals/secret.yaml"), "hidden: true\n");
    await writeFile(join(plugin, "agents/runner.md"), "Controlled agent\n");
    await writeFile(
      join(plugin, "hooks/hooks.json"),
      '{"hooks":{"PreToolUse":[]}}\n',
    );
    const prepared = await preparePolicy(await project.resolve(), host);
    const artifacts = prepared.artifacts as Artifact[];
    const paths = artifacts.map((artifact) => artifact.relativePath);
    const root = ".sevro-marketplace/plugin";
    expect(paths).toEqual(
      expect.arrayContaining([
        `${root}/.claude-plugin/plugin.json`,
        `${root}/.codex-plugin/plugin.json`,
        `${root}/skills/primary/SKILL.md`,
        `${root}/skills/primary/backend/pyproject.toml`,
        `${root}/agents/runner.md`,
        `${root}/hooks/hooks.json`,
      ]),
    );
    expect(paths.every((path) => path.startsWith(".sevro-marketplace/"))).toBe(
      true,
    );
    expect(
      paths.some((path) => /\/(?:evals|\.venv|\.pytest_cache)\//.test(path)),
    ).toBe(false);
    expect(artifacts.every((artifact) => artifact.gitExclude)).toBe(true);
    const backend = artifacts.find(
      (artifact) =>
        artifact.relativePath ===
        `${root}/skills/primary/backend/pyproject.toml`,
    );
    expect(Buffer.from(backend!.contentBase64, "base64").toString()).toBe(
      "[project]\n",
    );
    expect(
      host === "claude" ? prepared.claudePluginDirs : prepared.codexMarketplace,
    ).toEqual(
      host === "claude"
        ? { artifactRoots: [root] }
        : {
            artifactRoot: ".sevro-marketplace",
            marketplaceName: "darrow-eval",
            pluginNames: ["sample"],
          },
    );
  },
);

test.each(["selected skill only", "all sibling skills"] as const)(
  "Darrow filters colocated evals when mounting %s",
  async (selection) => {
    const siblings = selection === "all sibling skills";
    const project = await policyProject(
      { mount_plugin_skills: siblings },
      { skill: "primary" },
    );
    const skills = join(project.root, "plugins/capability/sample/skills");
    for (const name of ["primary", "plan-implementation", "discover-feature"])
      await writeFile(
        join(skills, name, "evals/secret.yaml"),
        "hidden: true\n",
      );
    const prepared = await preparePolicy(await project.resolve());
    const paths = (prepared.artifacts as Artifact[]).map(
      (artifact) => artifact.relativePath,
    );
    expect(paths.filter((path) => path.endsWith("/SKILL.md")).sort()).toEqual(
      siblings
        ? [
            ".agents/skills/discover-feature/SKILL.md",
            ".agents/skills/plan-implementation/SKILL.md",
            ".agents/skills/primary/SKILL.md",
          ]
        : [".agents/skills/primary/SKILL.md"],
    );
    expect(paths.some((path) => path.includes("/evals/"))).toBe(false);
  },
);

test.each(["claude", "codex"] as const)(
  "Darrow keeps composition manifests, skills, and mechanics independent on %s",
  async (host) => {
    const project = await policyProject(
      {
        prompt: "{{skill_invocation}} Return ready.",
        additional_plugins: ["plugins/capability/provider"],
      },
      { skill: "recipe" },
    );
    const provider = join(project.root, "plugins/capability/provider");
    for (const directory of ["backend", "bin"])
      await mkdir(join(provider, directory), { recursive: true });
    await writeFile(
      join(provider, "backend/pyproject.toml"),
      "fixture backend\n",
    );
    await writeFile(join(provider, "bin/runner"), "fixture runner\n");
    const prepared = await preparePolicy(await project.resolve(), host);
    const artifacts = prepared.artifacts as Artifact[];
    const paths = artifacts.map((artifact) => artifact.relativePath);
    const owner = ".sevro-marketplace/plugin";
    const additional = ".sevro-marketplace/plugins/0-provider";
    expect(paths).toContain(`${owner}/skills/recipe/SKILL.md`);
    expect(paths).toContain(`${additional}/skills/verify-change/SKILL.md`);
    expect(paths).toContain(`${additional}/backend/pyproject.toml`);
    expect(paths).toContain(`${additional}/bin/runner`);
    expect(paths).not.toContain(`${owner}/skills/verify-change/SKILL.md`);
    expect(paths).not.toContain(`${additional}/skills/recipe/SKILL.md`);
    const catalog = artifacts.find(
      (artifact) =>
        artifact.relativePath ===
        ".sevro-marketplace/.claude-plugin/marketplace.json",
    );
    expect(
      JSON.parse(Buffer.from(catalog!.contentBase64, "base64").toString())
        .plugins,
    ).toEqual([
      { name: "sample", source: "./plugin", description: expect.any(String) },
      {
        name: "provider",
        source: "./plugins/0-provider",
        description: expect.any(String),
      },
    ]);
    for (const [root, expected] of [
      [owner, "sample"],
      [additional, "provider"],
    ]) {
      const manifest = artifacts.find(
        (artifact) =>
          artifact.relativePath === `${root}/.claude-plugin/plugin.json`,
      );
      expect(
        JSON.parse(Buffer.from(manifest!.contentBase64, "base64").toString())
          .name,
      ).toBe(expected);
    }
    expect(
      host === "claude" ? prepared.claudePluginDirs : prepared.codexMarketplace,
    ).toEqual(
      host === "claude"
        ? { artifactRoots: [owner, additional] }
        : {
            artifactRoot: ".sevro-marketplace",
            marketplaceName: "darrow-eval",
            pluginNames: ["sample", "provider"],
          },
    );
  },
);
