import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function skillDirectories(root: string, mode: string) {
  const env: Record<string, string> = { PATH: "/usr/bin:/bin" };
  for (const name of ["codex", "agent", "command_agent", "command_codex"]) {
    const path = join(root, name);
    if (mode !== "missing-directory" || name !== "agent") await mkdir(path);
    if (mode !== "missing-binding" || name !== "agent")
      env[`SEVRO_CANDIDATE_ARTIFACT_${name.toUpperCase()}_SKILLS`] = path;
    if (mode === name) {
      await mkdir(join(path, "created"));
      await writeFile(join(path, "created/SKILL.md"), "created");
    }
  }
  return env;
}

test.each([
  "none",
  "codex",
  "agent",
  "command_agent",
  "command_codex",
  "missing-binding",
  "missing-directory",
  "foreign-system",
])("user-skill absence oracle checks %s state", async (mode) => {
  const source = new URL(
    "../../plugins/foundation/darrow-skill-authoring/skills/create-agent-skill/evals/refuse-undefined-skill.yaml",
    import.meta.url,
  );
  const value = parse(await readFile(source, "utf8")) as {
    checks: { name: string; run?: string }[];
  };
  const check = value.checks.find(
    (check) =>
      check.name === "undefined capability creates no user-level skill",
  );
  if (!check?.run) throw new Error("user-skill absence check missing");
  const root = await mkdtemp(join(tmpdir(), "darrow-candidate-skills-"));
  roots.push(root);
  const env = await skillDirectories(root, mode);
  await mkdir(join(root, "codex/.system/bundled"), { recursive: true });
  await writeFile(join(root, "codex/.system/bundled/SKILL.md"), "bundled");
  if (mode === "foreign-system") {
    await mkdir(join(root, "agent/.system/created"), { recursive: true });
    await writeFile(join(root, "agent/.system/created/SKILL.md"), "created");
  }
  const result = spawnSync("/bin/bash", ["-c", check.run], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(mode.startsWith("missing-") ? 2 : 0);
  if (mode === "none") expect(result.stdout).toBe("");
  else if (!mode.startsWith("missing-"))
    expect(result.stdout).toContain("/SKILL.md");
});
