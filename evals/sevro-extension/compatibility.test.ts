import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { auditCaseCompatibility, resolveCase, selectCaseIds } from "./index";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function invoke(root: string, extra: string[] = []) {
  const child = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "compatibility.ts"),
      "--project-root",
      root,
      "--json",
      ...extra,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, stderr, report: JSON.parse(stdout) };
}

test("compatibility inventory names unsupported cases and fails closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-inventory-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/sample/cases");
  await mkdir(cases, { recursive: true });
  const base = {
    invariant: "EXAMPLE-C1",
    prompt: "Return ready.",
    fixture: {
      commits: [{ message: "chore: init", files: { "README.md": "ready\n" } }],
    },
    checks: [],
  };
  await writeFile(
    join(cases, "supported.yaml"),
    JSON.stringify({ ...base, id: "supported" }),
  );
  const unsupported = join(cases, "unsupported.yaml");
  await writeFile(
    unsupported,
    JSON.stringify({
      ...base,
      id: "unsupported",
      transcript_checks: [{ name: "raw", expect_regex: "tool" }],
    }),
  );
  const inventory = await auditCaseCompatibility(root);
  expect(inventory).toMatchObject({
    format: "darrow-sevro-compatibility-v1",
    total: 2,
    supported: 1,
    valid: false,
    failures: [
      {
        id: "unsupported",
        source: await realpath(unsupported),
        error: expect.stringContaining("transcript check"),
      },
    ],
  });
  const strict = await invoke(root);
  expect(strict.code, strict.stderr).toBe(1);
  expect(strict.report.failures).toEqual(inventory.failures);
  expect((await invoke(root, ["--allow-unsupported"])).code).toBe(0);
  await rm(unsupported);
  expect((await invoke(root)).report).toMatchObject({
    supported: 1,
    valid: true,
    failures: [],
  });
});

test("resolves continuation prompts including a later skill invocation", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-continuation-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/sample/cases");
  await mkdir(cases, { recursive: true });
  const base = {
    invariant: "EXAMPLE-C1",
    fixture: {
      commits: [{ message: "chore: init", files: { "README.md": "ready\n" } }],
    },
    checks: [],
  };
  await writeFile(
    join(cases, "continue.yaml"),
    JSON.stringify({
      ...base,
      id: "continue",
      prompt: "Inspect {{repo_dir}}.",
      follow_up_prompt: "Continue in {{repo_dir}}.",
    }),
  );
  const skillRoot = join(root, "plugins/capability/probe/skills/probe");
  await mkdir(join(skillRoot, "evals"), { recursive: true });
  await mkdir(join(root, "plugins/capability/probe/.codex-plugin"), {
    recursive: true,
  });
  await writeFile(
    join(root, "plugins/capability/probe/.codex-plugin/plugin.json"),
    JSON.stringify({ name: "probe", version: "1.0.0", skills: "./skills/" }),
  );
  await writeFile(join(skillRoot, "SKILL.md"), "---\nname: probe\n---\n");
  await writeFile(
    join(skillRoot, "evals/continue-with-skill.yaml"),
    JSON.stringify({
      ...base,
      id: "continue-with-skill",
      prompt: "Wait for my next message.",
      follow_up_prompt: "{{skill_invocation}} Continue now.",
    }),
  );
  const projectRoot = pathToFileURL(root).href;
  const plain = await resolveCase({
    projectRoot,
    selectors: { caseIds: ["continue"] },
  });
  expect(plain.cases[0]?.prompt).toBe("Inspect {{sevro.workspace}}.");
  expect(plain.cases[0]?.followUpPrompt).toBe(
    "Continue in {{sevro.workspace}}.",
  );
  const invoked = await resolveCase({
    projectRoot,
    selectors: { caseIds: ["continue-with-skill"] },
  });
  expect(invoked.cases[0]?.followUpPrompt).toBe(
    "{{sevro.skill_invocation}} Continue now.",
  );
  expect(invoked.cases[0]?.extensionData["darrow.case"]).toMatchObject({
    invocation: { pluginName: "probe", skillName: "probe" },
  });
});

test("compatibility inventory includes repository invocation and composition", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "darrow-sevro-repository-inventory-"),
  );
  roots.push(root);
  const cases = join(root, ".agents/skills/probe/evals");
  await mkdir(cases, { recursive: true });
  const source = join(cases, "probe.yaml");
  await writeFile(
    source,
    JSON.stringify({
      id: "repository-probe",
      invariant: "EXAMPLE-R1",
      activation: "positive",
      prompt: "{{skill_invocation}} Use the probe capability.",
      additional_plugins: ["plugins/capability/provider"],
      activation_sequence: ["probe", "provider"],
      fixture: {
        commits: [{ message: "Initial", files: { "README.md": "fixture\n" } }],
      },
      checks: [],
    }),
  );
  expect(await selectCaseIds(root, ["repository-"])).toEqual([
    "repository-probe",
  ]);
  const inventory = await auditCaseCompatibility(root);
  expect(inventory).toMatchObject({
    total: 1,
    supported: 1,
    valid: true,
    failures: [],
  });
  const resolved = await resolveCase({
    projectRoot: pathToFileURL(root).href,
    selectors: { caseIds: ["repository-probe"] },
  });
  expect(resolved.cases[0]?.extensionData["darrow.case"]).toMatchObject({
    invocation: { scope: "repository", skillName: "probe" },
    additionalPlugins: ["plugins/capability/provider"],
    activation: { sequence: ["probe", "provider"] },
  });
});
