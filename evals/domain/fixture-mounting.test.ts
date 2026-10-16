import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  preparePolicy,
  policyProject,
  runPolicyPrompt,
} from "./policy-project";
import { fixtureExtensionRequest } from "./fixture-command";

type Artifact = {
  relativePath: string;
  contentBase64: string;
  sha256: string;
  gitExclude: boolean;
};

const supportingBody =
  "---\nname: supporting\ndescription: Fixture provider\n---\n\nRecord the delegated request.\n";
const supportingFixture = {
  commits: [{ message: "Initial", files: { "README.md": "fixture\n" } }],
  files: {
    ".agents/skills/supporting/SKILL.md": supportingBody,
    ".claude/skills/supporting/SKILL.md": supportingBody,
    "input.txt": "ordinary fixture input\n",
  },
};

test.each(["codex", "claude"] as const)(
  "Darrow declares inline supporting skills as byte-bound %s mounts",
  async (host) => {
    const project = await policyProject(
      {
        activation: "positive",
        activation_sequence: ["primary", "supporting"],
        prompt: "Run {{skill_invocation}}.",
        fixture: supportingFixture,
      },
      { skill: "primary" },
    );
    const selected = await project.resolve();
    const prepared = await preparePolicy(selected, host);
    const artifacts = prepared.artifacts as Artifact[];
    const path = `.${host === "codex" ? "agents" : "claude"}/skills/supporting/SKILL.md`;
    const supporting = artifacts.find(
      (artifact) => artifact.relativePath === path,
    );
    expect(supporting).toBeDefined();
    expect(Buffer.from(supporting!.contentBase64, "base64").toString()).toBe(
      supportingBody,
    );
    expect(supporting!.sha256).toBe(
      createHash("sha256").update(supportingBody).digest("hex"),
    );
    expect(supporting!.gitExclude).toBe(true);
    expect(
      artifacts.filter((artifact) =>
        artifact.relativePath.endsWith("/supporting/SKILL.md"),
      ),
    ).toHaveLength(1);
    const fixture = (
      selected as unknown as { fixture: { files: Record<string, string> } }
    ).fixture;
    expect(JSON.stringify(fixture)).not.toContain("supporting/SKILL.md");
    expect(JSON.stringify(fixture)).toContain("ordinary fixture input");
  },
);

test("Darrow refuses mutated, duplicate, or missing inline supporting mounts", async () => {
  const project = await policyProject(
    { fixture: supportingFixture },
    { skill: "primary" },
  );
  const selected = await project.resolve();
  await project.write({
    fixture: {
      ...supportingFixture,
      files: {
        ...supportingFixture.files,
        ".agents/skills/supporting/SKILL.md": supportingBody + "changed\n",
      },
    },
  });
  await expect(preparePolicy(selected)).rejects.toThrow(
    "fixture skills changed",
  );
  await project.write({
    fixture: {
      ...supportingFixture,
      files: { ".agents/skills/supporting/SKILL.md": supportingBody },
    },
  });
  await expect(
    preparePolicy(await project.resolve(), "claude"),
  ).rejects.toThrow("host mirror is missing");
  await project.write({
    fixture: {
      ...supportingFixture,
      files: {
        ".agents/skills/primary/SKILL.md": supportingBody,
        ".claude/skills/primary/SKILL.md": supportingBody,
      },
    },
  });
  await expect(preparePolicy(await project.resolve())).rejects.toThrow(
    "mounted skill names must be unique",
  );
});

test("Darrow omits fixture supporting skills from an unmounted control", async () => {
  const project = await policyProject(
    { fixture: supportingFixture },
    { skill: "primary" },
  );
  const { cases } = await fixtureExtensionRequest<{ cases: unknown[] }>(
    "resolve",
    {
      projectRoot: pathToFileURL(project.root).href,
      selectors: { caseIds: ["activation-case"] },
      configuration: { withoutSkill: true },
    },
  );
  const prepared = await fixtureExtensionRequest<{ artifacts: unknown[] }>(
    "prepare",
    {
      case: cases[0],
      host: { id: "sevro.host.codex", capabilities: [] },
      configuration: { withoutSkill: true },
    },
  );
  expect(prepared.artifacts).toEqual([]);
  expect(JSON.stringify(cases[0])).not.toContain(supportingBody);
});

test.each(["codex", "claude"] as const)(
  "Darrow binds the %s fixture host through public preparation",
  async (host) => {
    const project = await policyProject({
      prompt: "Return ready.",
      checks: [
        {
          name: "host fact comes from trusted preparation",
          run: "cat .git/fixture-host",
          expect_exact: host,
        },
        {
          name: "host metadata is outside product contents",
          run: "git status --porcelain --untracked-files=all",
          expect_exact: "",
        },
      ],
    });
    const result = await runPolicyPrompt(project, host, "Return ready.");
    expect(result.exitCode, result.diagnostic).toBe(0);
    expect(result.value.task.verdict).toBe("passed");
  },
  30_000,
);

test("Darrow prepares writable fixture state without changing Git status", async () => {
  const project = await policyProject({
    prompt: "Return ready.",
    fixture: {
      commits: [{ message: "Initial", files: { "README.md": "fixture\n" } }],
      setup: "printf 'prepared\\n' >.fixture-state/setup-receipt",
    },
    checks: [
      {
        name: "setup and tools share the excluded workspace state",
        run: "test -d .fixture-state && test \"$(cat .fixture-state/setup-receipt)\" = prepared && printf 'checked\\n' >.fixture-state/tool-receipt && git check-ignore .fixture-state/tool-receipt",
        expect_exact: ".fixture-state/tool-receipt",
      },
      {
        name: "fixture receipts do not appear as product changes",
        run: "git status --porcelain --untracked-files=all",
        expect_exact: "",
      },
    ],
  });
  const result = await runPolicyPrompt(project, "codex", "Return ready.");
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.task.verdict).toBe("passed");
}, 30_000);

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
    const configuration = '{"implementation":{"model":"fixture-model"}}\n';
    await mkdir(join(plugin, "config"));
    await writeFile(join(plugin, "config/routes.json"), configuration);
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
    const routes = artifacts.find(
      (artifact) =>
        artifact.relativePath === `${destination}/config/routes.json`,
    );
    expect(routes).toBeDefined();
    expect(Buffer.from(routes!.contentBase64, "base64").toString()).toBe(
      configuration,
    );
    expect(routes!.gitExclude).toBe(true);
    for (const host of ["claude", "codex"]) {
      const relativePath = `.${host}-plugin/plugin.json`;
      const manifest = artifacts.find(
        (artifact) =>
          artifact.relativePath === `${destination}/${relativePath}`,
      );
      expect(manifest).toBeDefined();
      expect(Buffer.from(manifest!.contentBase64, "base64")).toEqual(
        await readFile(join(plugin, relativePath)),
      );
      expect(manifest!.gitExclude).toBe(true);
    }
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
  const plugin = join(project.root, "plugins/capability/sample");
  await mkdir(join(plugin, "config"));
  await writeFile(
    join(plugin, "config/routes.json"),
    '{"model":"fixture-model"}\n',
  );
  await project.write({
    checks: [
      {
        name: "owning backend is mounted and excluded from Git",
        run: 'test -f .agents/backend/pyproject.toml && test "$(cat .agents/config/routes.json)" = \'{"model":"fixture-model"}\' && test -z "$(git status --porcelain)"',
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

test.each(["backend", "config", "references"])(
  "Darrow rejects external links in an implicit plugin %s directory",
  async (directory) => {
    const project = await policyProject({ prompt: "Return ready." });
    const resource = join(project.root, "plugins/capability/sample", directory);
    await mkdir(resource, { recursive: true });
    const external = join(project.root, "external.txt");
    await writeFile(external, "outside the plugin\n");
    await symlink(external, join(resource, "external.txt"));
    const selected = await project.resolve();
    await expect(preparePolicy(selected)).rejects.toThrow(
      /plugin package contains an unsafe entry/,
    );
  },
);

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
