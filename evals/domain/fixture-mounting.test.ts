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
