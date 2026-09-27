import { afterEach, expect, test } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sevroCommand } from "../../sevro-extension/sevro-command";
import { invocation } from "../../sevro-extension/run";

const extension = resolve(import.meta.dir, "../../sevro-extension/index.ts");
const projectRoot = resolve(import.meta.dir, "../../..");
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function command<T>(
  argv: string[],
  input?: unknown,
): Promise<{
  code: number;
  stderr: string;
  value: T;
}> {
  const proc = Bun.spawn(argv, {
    stdin: input === undefined ? "ignore" : "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (input !== undefined) {
    if (!proc.stdin || typeof proc.stdin === "number")
      throw new Error("stdin unavailable");
    await proc.stdin.write(JSON.stringify(input));
    await proc.stdin.end();
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stderr, value: JSON.parse(stdout) as T };
}

interface ExtensionReply {
  result: {
    extension: { id: string };
    protocols: string[];
    cases: Array<{
      prompt: string;
      fixture: {
        kind: string;
        commits?: Array<{ message: string }>;
        sourceRef?: string;
      };
      checks: Array<{
        id: string;
        grader: string;
        configuration: Record<string, unknown>;
      }>;
      extensionData: {
        "darrow.case": {
          invariant: string;
          activation?: { class: string; targetSkill: string };
          setupDigest?: string;
        };
      };
    }>;
  };
  error: { code: string; message: string };
}

interface CliReply {
  task: { verdict: string };
  cases: Array<{
    trials: Array<{
      checks: Array<{ id: string; status: string }>;
      domainOutcomes: Array<{
        id: string;
        status: string;
        evidenceRefs: string[];
      }>;
    }>;
  }>;
  evidencePath: string;
}

function request(method: string, params: Record<string, unknown>) {
  return {
    protocol:
      method === "describe" ? "sevro.discovery.v1" : "sevro.extension.v1",
    id: `request-${method}`,
    method,
    params,
  };
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(stderr);
  return stdout.trim();
}

test("Darrow extension resolves supported cases and rejects unsupported fixtures", async () => {
  const describe = await command<ExtensionReply>(
    [process.execPath, extension],
    request("describe", {}),
  );
  expect(describe.code).toBe(0);
  expect(describe.value.result.extension.id).toBe("darrow.evals");
  expect(describe.value.result.protocols).toEqual(["sevro.extension.v1"]);
  const resolveParams = (caseId: string) => ({
    projectRoot: pathToFileURL(projectRoot).href,
    selectors: { caseIds: [caseId] },
    configuration: {},
  });
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request(
      "resolve",
      resolveParams("orchestration-routing-localized-mechanical"),
    ),
  );
  expect(resolved.code).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  expect(selected.fixture).toMatchObject({
    kind: "generated",
    commits: [{ message: "chore: init" }],
  });
  expect(
    selected.checks.map((check: { grader: string }) => check.grader),
  ).toEqual(["sevro.shell", "sevro.shell"]);
  expect(selected.extensionData["darrow.case"].invariant).toBe(
    "ORCH-ROUTING-LOCALIZED-MECHANICAL",
  );
  const activationCase = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams("author-agent-skill-validate-read-only")),
  );
  expect(activationCase.code, activationCase.stderr).toBe(0);
  expect(
    activationCase.value.result.cases[0]!.extensionData["darrow.case"]
      .activation,
  ).toEqual({
    class: "positive",
    targetSkill: "author-agent-skill",
  });
  const siblingCase = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams("readiness-no-trigger-implementation")),
  );
  expect(siblingCase.code, siblingCase.stderr).toBe(0);
  expect(siblingCase.value.result.cases[0]!.extensionData).toMatchObject({
    "darrow.case": {
      activation: {
        class: "negative",
        targetSkill: "assess-implementation-readiness",
      },
      mount: { mountPluginSkills: true },
    },
  });
  const unsupported = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams("orchestration-oss-requests-proxy")),
  );
  expect(unsupported.value.error.code).toBe("darrow.extension.invalid");
  expect(unsupported.value.error.message).toMatch(
    /unsupported|generated Git history/,
  );
});

test("Darrow activation needs a complete and consistent host observation", async () => {
  const extensionData = {
    "darrow.case": {
      activation: { class: "positive", targetSkill: "verify-change" },
    },
  };
  const evaluate = (observations: unknown[], data = extensionData) =>
    command<{
      result: {
        domainOutcomes: Array<{
          status: string;
          evidenceRefs: string[];
          data: Record<string, unknown>;
        }>;
      };
    }>(
      [process.execPath, extension],
      request("evaluate", { extensionData: data, observations }),
    );
  const observation = {
    id: "darrow.activation",
    source: "darrow.host.synthetic",
    completeness: "complete",
    data: { primarySkill: "verify-change", observedSkills: ["verify-change"] },
  };
  const passed = await evaluate([observation]);
  expect(passed.value.result.domainOutcomes).toMatchObject([
    { status: "passed", evidenceRefs: ["darrow.activation"] },
  ]);
  const native = {
    ...observation,
    id: "sevro.codex.skill-reads",
    source: "sevro.host.codex",
    data: { ...observation.data, method: "skill_file_read_probe" },
  };
  const nativePassed = await evaluate([native]);
  expect(nativePassed.value.result.domainOutcomes).toMatchObject([
    { status: "passed", evidenceRefs: ["sevro.codex.skill-reads"] },
  ]);
  const foreign = await evaluate([
    { ...native, source: "darrow.host.synthetic" },
  ]);
  expect(foreign.value.result.domainOutcomes[0]!.status).toBe("unavailable");
  const unsupportedMethod = await evaluate([
    { ...native, data: { ...native.data, method: "unverified" } },
  ]);
  expect(unsupportedMethod.value.result.domainOutcomes[0]!.status).toBe(
    "unavailable",
  );
  const ambiguous = await evaluate([observation, native]);
  expect(ambiguous.value.result.domainOutcomes[0]!.status).toBe("unavailable");
  const missed = await evaluate([]);
  expect(missed.value.result.domainOutcomes[0]!.status).toBe("unavailable");
  const partial = await evaluate([{ ...observation, completeness: "partial" }]);
  expect(partial.value.result.domainOutcomes[0]!.status).toBe("unavailable");
  const inconsistent = await evaluate([
    {
      ...observation,
      data: { primarySkill: "verify-change", observedSkills: [] },
    },
  ]);
  expect(inconsistent.value.result.domainOutcomes[0]!.status).toBe(
    "unavailable",
  );
  const duplicate = await evaluate([observation, observation]);
  expect(duplicate.value.result.domainOutcomes[0]!.status).toBe("unavailable");
  const negative = await evaluate([observation], {
    "darrow.case": {
      activation: { class: "negative", targetSkill: "verify-change" },
    },
  });
  expect(negative.value.result.domainOutcomes[0]!.status).toBe("failed");
});

test("Darrow mounts sibling skills for a competition activation case", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-siblings-"));
  roots.push(root);
  const skills = join(root, "plugins/capability/example/skills");
  await mkdir(join(skills, "primary/evals"), { recursive: true });
  await mkdir(join(skills, "rival/evals"), { recursive: true });
  await mkdir(join(skills, "spare/evals"), { recursive: true });
  await writeFile(join(skills, "primary/SKILL.md"), "Primary skill\n");
  await writeFile(join(skills, "rival/SKILL.md"), "Rival skill\n");
  await writeFile(join(skills, "spare/SKILL.md"), "Spare skill\n");
  await writeFile(
    join(skills, "primary/evals/competition.yaml"),
    JSON.stringify({
      id: "sibling-competition",
      invariant: "EXAMPLE-C1",
      activation: "competition",
      activation_sequence: ["primary", "rival"],
      activation_includes: ["rival"],
      activation_excludes: ["spare"],
      mount_plugin_skills: true,
      prompt: "Use the best skill for this request.",
      fixture: {
        commits: [
          { message: "Initialize", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["sibling-competition"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  expect(resolved.value.result.cases[0]!.extensionData).toMatchObject({
    "darrow.case": {
      activation: {
        class: "competition",
        targetSkill: "primary",
        sequence: ["primary", "rival"],
        includes: ["rival"],
        excludes: ["spare"],
      },
      mount: { mountPluginSkills: true },
    },
  });
  const prepared = await command<{
    result: { artifacts: Array<{ id: string; relativePath: string }> };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: resolved.value.result.cases[0],
      host: { id: "darrow.host.synthetic", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.code, prepared.stderr).toBe(0);
  expect(prepared.value.result.artifacts).toMatchObject([
    { id: "darrow.skill.1", relativePath: ".agents/skills/primary/SKILL.md" },
    { id: "darrow.skill.2", relativePath: ".agents/skills/rival/SKILL.md" },
    { id: "darrow.skill.3", relativePath: ".agents/skills/spare/SKILL.md" },
  ]);
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run({ workspace }) {
    for (const name of ["primary", "rival", "spare"])
      if (!(await Bun.file(workspace + "/.agents/skills/" + name + "/SKILL.md").exists())) throw new Error("sibling missing");
    return { finalMessage: "ready", complete: true, observations: [{ id: "darrow.activation", completeness: "complete", data: { primarySkill: "primary", observedSkills: ["primary", "rival"] } }] };
  },
};
`,
  );
  const run = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "sibling-competition",
    "--project-root",
    root,
    "--results-root",
    join(root, "results"),
    "--",
    "--adapter-module",
    adapter,
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
  ]);
  expect(run.code, run.stderr).toBe(0);
  expect(run.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
    { id: "darrow.evals.activation", status: "passed" },
  ]);
  const evidence = JSON.parse(await readFile(run.value.evidencePath, "utf8"));
  expect(evidence.trials[0].artifactRefs).toHaveLength(3);
  expect(evidence.trials[0].domainOutcomes[0].data).toMatchObject({
    expectedSkills: ["primary", "rival"],
    requiredSkills: ["rival"],
    excludedSkills: ["spare"],
  });
  const violated = await command<{
    result: { domainOutcomes: Array<{ status: string }> };
  }>(
    [process.execPath, extension],
    request("evaluate", {
      extensionData: resolved.value.result.cases[0]!.extensionData,
      observations: [
        {
          id: "darrow.activation",
          source: "darrow.host.synthetic",
          completeness: "complete",
          data: {
            primarySkill: "primary",
            observedSkills: ["primary", "spare"],
          },
        },
      ],
    }),
  );
  expect(violated.value.result.domainOutcomes[0]!.status).toBe("failed");
  const unavailableCase = JSON.parse(
    await readFile(join(skills, "primary/evals/competition.yaml"), "utf8"),
  ) as Record<string, unknown>;
  unavailableCase.id = "unmounted-inclusion";
  unavailableCase.activation_includes = ["absent"];
  await writeFile(
    join(skills, "primary/evals/unmounted.yaml"),
    JSON.stringify(unavailableCase),
  );
  const unavailableResolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["unmounted-inclusion"] },
      configuration: {},
    }),
  );
  const unmounted = await command<ExtensionReply>(
    [process.execPath, extension],
    request("prepare", {
      case: unavailableResolved.value.result.cases[0],
      host: { id: "darrow.host.synthetic", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(unmounted.value.error.message).toMatch(/absent from the mounted set/);
  await symlink(join(root, "outside"), join(skills, "linked"));
  const unsafe = await command<ExtensionReply>(
    [process.execPath, extension],
    request("prepare", {
      case: resolved.value.result.cases[0],
      host: { id: "darrow.host.synthetic", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(unsafe.value.error.message).toMatch(/symbolic link/);
});

test("Darrow extension grades combined shell and final-message assertions", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-stdout-"));
  roots.push(root);
  const caseDir = join(root, "evals/experiments/example/cases");
  await mkdir(caseDir, { recursive: true });
  await writeFile(
    join(caseDir, "stdout.yaml"),
    JSON.stringify({
      id: "stdout-case",
      invariant: "EXAMPLE-C1",
      prompt: "Inspect the fixture.",
      fixture: {
        commits: [{ message: "Initialize", files: { "README.md": "ready\n" } }],
      },
      checks: [
        {
          name: "stdout contract",
          run: "cat README.md",
          expect_exact: "ready",
          expect_regex: "^ready$",
          not_regex: "missing",
          flags: "i",
          exit_code: 0,
        },
      ],
      output_checks: [
        {
          name: "final response contract",
          valid_json: true,
          json_path: "/status",
          expect_json: "ready",
          expect_exact: '{"status":"ready"}',
          expect_regex: "ready",
          not_regex: "secret",
        },
      ],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["stdout-case"] },
      configuration: {},
    }),
  );
  expect(resolved.value.result.cases[0]!.checks[0]).toMatchObject({
    grader: "sevro.shell",
    configuration: {
      run: "cat README.md",
      expectExact: "ready",
      expectRegex: "^ready$",
      notRegex: "missing",
      flags: "i",
      expectedExitCode: 0,
    },
  });
  expect(resolved.value.result.cases[0]!.checks[1]).toMatchObject({
    id: "darrow.output.1",
    grader: "sevro.output",
    configuration: {
      validJson: true,
      jsonPath: "/status",
      expectJson: "ready",
      expectExact: '{"status":"ready"}',
      expectRegex: "ready",
      notRegex: "secret",
    },
  });

  const sevroRoute = sevroCommand();
  const commandFile = join(root, "extension-command.json");
  const adapter = join(root, "candidate.ts");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  const invoke = async (status: string) => {
    await writeFile(
      adapter,
      `export default {
  id: "darrow.host.output-synthetic", model: "synthetic-v1", effort: "none",
  async run() { return { finalMessage: JSON.stringify({ status: ${JSON.stringify(status)} }), complete: true }; },
};
`,
    );
    return command<CliReply>([
      ...sevroRoute.launch,
      "run",
      "--json",
      ...sevroRoute.extraArgs,
      "--extension-command-file",
      commandFile,
      "--extension-source-file",
      extension,
      "--extension-source-file",
      join(projectRoot, "package.json"),
      "--extension-source-file",
      join(projectRoot, "bun.lock"),
      "--case-id",
      "stdout-case",
      "--adapter-module",
      adapter,
      "--shell-isolation",
      "--project-root",
      root,
      "--results-root",
      join(root, "results"),
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
    ]);
  };
  const passed = await invoke("ready");
  expect(passed.code, passed.stderr).toBe(0);
  expect(
    passed.value.cases[0]!.trials[0]!.checks.map((check) => check.status),
  ).toEqual(["passed", "passed"]);
  const failed = await invoke("wait");
  expect(failed.code, failed.stderr).toBe(1);
  expect(
    failed.value.cases[0]!.trials[0]!.checks.map((check) => check.status),
  ).toEqual(["passed", "failed"]);
});

test("Darrow extension grades semantic propositions through an isolated route", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-semantic-"));
  roots.push(root);
  const caseDir = join(root, "evals/experiments/example/cases");
  await mkdir(caseDir, { recursive: true });
  await writeFile(
    join(caseDir, "semantic.yaml"),
    JSON.stringify({
      id: "semantic-case",
      invariant: "EXAMPLE-S1",
      prompt: "Report readiness.",
      fixture: {
        commits: [{ message: "Initialize", files: { "README.md": "ready\n" } }],
      },
      checks: [],
      semantic_output_checks: [
        { name: "readiness", proposition: "The response promises readiness." },
      ],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["semantic-case"] },
      configuration: {},
    }),
  );
  expect(resolved.value.result.cases[0]!.checks).toEqual([
    {
      id: "darrow.semantic.1",
      grader: "sevro.semantic",
      configuration: { proposition: "The response promises readiness." },
    },
  ]);

  const sevroRoute = sevroCommand();
  const commandFile = join(root, "extension-command.json");
  const candidate = join(root, "candidate.ts");
  const semantic = join(root, "semantic.ts");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  await writeFile(
    semantic,
    `export default {
  id: "darrow.host.semantic-synthetic", model: "synthetic-v1", effort: "none",
  async run({ prompt }) {
    if (!prompt.includes("The response promises readiness.")) throw new Error("missing proposition");
    const passed = prompt.includes("The change is ready.");
    return { finalMessage: JSON.stringify({ checks: [{ id: "darrow.semantic.1", verdict: passed ? "pass" : "fail", reason: "Synthetic semantic verdict" }] }), complete: true };
  },
};
`,
  );
  const invoke = async (response: string) => {
    await writeFile(
      candidate,
      `export default {
  id: "darrow.host.candidate-synthetic", model: "synthetic-v1", effort: "none",
  async run() { return { finalMessage: ${JSON.stringify(response)}, complete: true }; },
};
`,
    );
    return command<CliReply>([
      ...sevroRoute.launch,
      "run",
      "--json",
      ...sevroRoute.extraArgs,
      "--extension-command-file",
      commandFile,
      "--extension-source-file",
      extension,
      "--extension-source-file",
      join(projectRoot, "package.json"),
      "--extension-source-file",
      join(projectRoot, "bun.lock"),
      "--case-id",
      "semantic-case",
      "--adapter-module",
      candidate,
      "--semantic-adapter-module",
      semantic,
      "--project-root",
      root,
      "--results-root",
      join(root, "results"),
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
    ]);
  };
  const passed = await invoke("The change is ready.");
  expect(passed.code, passed.stderr).toBe(0);
  expect(passed.value.cases[0]!.trials[0]!.checks).toMatchObject([
    { id: "darrow.semantic.1", status: "passed" },
  ]);
  const failed = await invoke("The change needs work.");
  expect(failed.code, failed.stderr).toBe(1);
  expect(failed.value.cases[0]!.trials[0]!.checks).toMatchObject([
    { id: "darrow.semantic.1", status: "failed" },
  ]);
});

test("Darrow extension mounts a plugin skill without exposing its evals", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-skill-"));
  roots.push(root);
  const skillDir = join(root, "plugins/capability/example/skills/example");
  await mkdir(join(skillDir, "references"), { recursive: true });
  await mkdir(join(skillDir, "scripts"), { recursive: true });
  await mkdir(join(skillDir, "evals"), { recursive: true });
  await writeFile(
    join(skillDir, "SKILL.md"),
    "---\nname: example\ndescription: Example skill\n---\n\nRead references/guide.md.\n",
  );
  await writeFile(join(skillDir, "references/guide.md"), "Visible guidance.\n");
  const script = join(skillDir, "scripts/run.sh");
  await writeFile(script, "#!/bin/sh\nprintf 'ready\\n'\n");
  await chmod(script, 0o755);
  await writeFile(join(skillDir, "evals/hidden.txt"), "hidden pass criteria\n");
  await writeFile(
    join(skillDir, "evals/mount.yaml"),
    JSON.stringify({
      id: "example-skill-mount",
      invariant: "EXAMPLE-M1",
      activation: "positive",
      prompt: "Use the example skill in {{repo_dir}} and return ready.",
      fixture: {
        commits: [
          { message: "Initialize", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [
        {
          name: "skill mount is not a candidate change",
          run: "git status --porcelain --untracked-files=all",
          expect_exact: "",
        },
      ],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["example-skill-mount"] },
      configuration: {},
    }),
  );
  expect(resolved.code).toBe(0);
  expect(resolved.value.result.cases[0]!.prompt).toBe(
    "Use the example skill in {{sevro.workspace}} and return ready.",
  );
  expect(resolved.value.result.cases[0]!.extensionData).toMatchObject({
    "darrow.case": {
      mount: {
        projectRoot: pathToFileURL(await realpath(root)).href,
        skillDir: "plugins/capability/example/skills/example",
      },
    },
  });
  const prepared = await command<{
    result: {
      artifacts: Array<{
        relativePath: string;
        gitExclude: boolean;
        executable?: boolean;
      }>;
    };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: resolved.value.result.cases[0],
      host: { id: "darrow.host.synthetic", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.code).toBe(0);
  expect(
    prepared.value.result.artifacts.map((item) => item.relativePath),
  ).toEqual([
    ".agents/skills/example/SKILL.md",
    ".agents/skills/example/references/guide.md",
    ".agents/skills/example/scripts/run.sh",
  ]);
  expect(prepared.value.result.artifacts.every((item) => item.gitExclude)).toBe(
    true,
  );
  expect(prepared.value.result.artifacts[2]!.executable).toBe(true);

  const sevroRoute = sevroCommand();
  const commandFile = join(root, "extension-command.json");
  const adapter = join(root, "candidate.ts");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  await writeFile(
    adapter,
    `import { readFile } from "node:fs/promises";
import { join } from "node:path";
export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run({ workspace, prompt }) {
    const skill = join(workspace, ".agents/skills/example");
    if (prompt !== \`Use the example skill in \${workspace} and return ready.\`) throw new Error("workspace token unresolved");
    if (!(await readFile(join(skill, "SKILL.md"), "utf8")).includes("Example skill")) throw new Error("skill missing");
    if ((await readFile(join(skill, "references/guide.md"), "utf8")) !== "Visible guidance.\\n") throw new Error("reference missing");
    if (await Bun.file(join(skill, "evals/hidden.txt")).exists()) throw new Error("eval criteria exposed");
    const script = Bun.spawn([join(skill, "scripts/run.sh")], { stdout: "pipe" });
    if ((await new Response(script.stdout).text()) !== "ready\\n" || (await script.exited) !== 0) throw new Error("script not executable");
    return { finalMessage: "ready", complete: true, observations: [{ id: "darrow.activation", completeness: "complete", data: { primarySkill: "example", observedSkills: ["example"] } }] };
  },
};
`,
  );
  const commonArgs = [
    ...sevroRoute.launch,
    "run",
    "--json",
    ...sevroRoute.extraArgs,
    "--extension-command-file",
    commandFile,
    "--extension-source-file",
    extension,
    "--extension-source-file",
    join(projectRoot, "package.json"),
    "--extension-source-file",
    join(projectRoot, "bun.lock"),
    "--case-id",
    "example-skill-mount",
    "--project-root",
    root,
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
  ];
  const run = await command<CliReply>([
    ...commonArgs,
    "--adapter-module",
    adapter,
    "--shell-isolation",
    "--results-root",
    join(root, "results"),
  ]);
  expect(run.code, run.stderr).toBe(0);
  expect(
    run.value.cases[0]!.trials[0]!.checks.map((check) => check.status),
  ).toEqual(["passed", "passed"]);
  expect(run.value.task.verdict).toBe("passed");
  expect(run.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
    {
      id: "darrow.evals.activation",
      status: "passed",
      evidenceRefs: ["darrow.activation"],
    },
  ]);
  const missedAdapter = join(root, "candidate-missed.ts");
  await writeFile(
    missedAdapter,
    (await readFile(adapter, "utf8")).replace(
      'primarySkill: "example", observedSkills: ["example"]',
      "primarySkill: null, observedSkills: []",
    ),
  );
  const missed = await command<CliReply>([
    ...commonArgs,
    "--adapter-module",
    missedAdapter,
    "--shell-isolation",
    "--results-root",
    join(root, "missed-results"),
  ]);
  expect(missed.code, missed.stderr).toBe(0);
  expect(missed.value.task.verdict).toBe("passed");
  expect(missed.value.cases[0]!.trials[0]!.domainOutcomes[0]!.status).toBe(
    "failed",
  );
  const nativeAdapter = join(root, "candidate-native-observation.ts");
  await writeFile(
    nativeAdapter,
    (await readFile(adapter, "utf8"))
      .replace('id: "darrow.host.synthetic"', 'id: "sevro.host.codex"')
      .replace('id: "darrow.activation"', 'id: "sevro.codex.skill-reads"')
      .replace(
        'data: { primarySkill: "example"',
        'data: { method: "skill_file_read_probe", primarySkill: "example"',
      ),
  );
  const native = await command<CliReply>([
    ...commonArgs,
    "--adapter-module",
    nativeAdapter,
    "--shell-isolation",
    "--results-root",
    join(root, "native-observation-results"),
  ]);
  expect(native.code, native.stderr).toBe(0);
  expect(native.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
    {
      id: "darrow.evals.activation",
      status: "passed",
      evidenceRefs: ["sevro.codex.skill-reads"],
    },
  ]);
  const evidence = JSON.parse(await readFile(run.value.evidencePath, "utf8"));
  expect(
    evidence.trials[0].artifactRefs.filter(
      (item: { gitExclude?: boolean }) => item.gitExclude,
    ),
  ).toHaveLength(3);
  expect(
    evidence.trials[0].artifactRefs.filter(
      (item: { executable?: boolean }) => item.executable,
    ),
  ).toHaveLength(1);
  const codexDry = await command<{
    execution: { status: string };
    evidencePath: string;
  }>([
    ...commonArgs,
    "--dry",
    "--host",
    "codex",
    "--codex-bin",
    process.execPath,
    "--codex-auth-file",
    join(root, "unused-auth.json"),
    "--model",
    "synthetic-codex",
    "--effort",
    "low",
    "--shell-isolation",
    "--results-root",
    join(root, "codex-dry-results"),
  ]);
  expect(codexDry.code, codexDry.stderr).toBe(0);
  expect(codexDry.value.execution.status).toBe("not_run");
  const codexEvidence = JSON.parse(
    await readFile(codexDry.value.evidencePath, "utf8"),
  );
  expect(codexEvidence.routes[0].host).toBe("sevro.host.codex");
  expect(codexEvidence.trials[0].artifactRefs).toHaveLength(3);
  const installedCodex = Bun.which("codex");
  if (process.platform === "darwin" && installedCodex) {
    const fakeRoot = await mkdtemp(join(tmpdir(), "darrow-sevro-codex-"));
    roots.push(fakeRoot);
    const fakeCodex = join(fakeRoot, "fake-codex");
    const quotedCodex = `'${installedCodex.replaceAll("'", `'"'"'`)}'`;
    const skillBody = await readFile(join(skillDir, "SKILL.md"), "utf8");
    const events = [
      { type: "thread.started", thread_id: "synthetic-codex-turn" },
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "cat .agents/skills/example/SKILL.md",
          aggregated_output: skillBody,
          exit_code: 0,
          status: "completed",
        },
      },
      {
        type: "item.completed",
        item: { type: "agent_message", text: "ready" },
      },
      { type: "turn.completed", usage: { input_tokens: 12, output_tokens: 4 } },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");
    const fakeSource = `#!/bin/sh
if [ "$1" = sandbox ]; then exec ${quotedCodex} "$@"; fi
if [ "$1" = --version ]; then printf 'synthetic-codex\\n'; exit 0; fi
if [ "$1" != exec ]; then exit 99; fi
/bin/cat >/dev/null
/bin/cat <<'SEVRO_EVENTS'
${events}
SEVRO_EVENTS
`;
    await writeFile(fakeCodex, fakeSource, { mode: 0o700 });
    await chmod(fakeCodex, 0o700);
    const authFile = join(root, "auth.json");
    await writeFile(authFile, "test-only-auth\n", { mode: 0o600 });
    const nativeHost = await command<CliReply>([
      ...commonArgs,
      "--host",
      "codex",
      "--codex-bin",
      fakeCodex,
      "--codex-auth-file",
      authFile,
      "--model",
      "synthetic-codex",
      "--effort",
      "low",
      "--shell-isolation",
      "--results-root",
      join(root, "codex-native-results"),
    ]);
    expect(nativeHost.code, nativeHost.stderr).toBe(0);
    expect(nativeHost.value.task.verdict).toBe("passed");
    expect(nativeHost.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
      {
        id: "darrow.evals.activation",
        status: "passed",
        evidenceRefs: ["sevro.codex.skill-reads"],
      },
    ]);
    const nativeEvidence = JSON.parse(
      await readFile(nativeHost.value.evidencePath, "utf8"),
    );
    expect(nativeEvidence.trials[0].observations).toContainEqual({
      id: "sevro.codex.skill-reads",
      source: "sevro.host.codex",
      completeness: "complete",
      data: {
        method: "skill_file_read_probe",
        primarySkill: "example",
        observedSkills: ["example"],
      },
    });
    await writeFile(
      fakeCodex,
      fakeSource.replace(JSON.stringify(skillBody), JSON.stringify("summary")),
    );
    const partialHost = await command<CliReply>([
      ...commonArgs,
      "--host",
      "codex",
      "--codex-bin",
      fakeCodex,
      "--codex-auth-file",
      authFile,
      "--model",
      "synthetic-codex",
      "--effort",
      "low",
      "--shell-isolation",
      "--results-root",
      join(root, "codex-partial-results"),
    ]);
    expect(partialHost.code, partialHost.stderr).toBe(0);
    expect(partialHost.value.task.verdict).toBe("passed");
    expect(
      partialHost.value.cases[0]!.trials[0]!.domainOutcomes[0]!.status,
    ).toBe("unavailable");
  }
  await writeFile(join(root, "secret.txt"), "private source\n");
  await symlink(join(root, "secret.txt"), join(skillDir, "references/leak.md"));
  const unsafe = await command<ExtensionReply>(
    [process.execPath, extension],
    request("prepare", {
      case: resolved.value.result.cases[0],
      host: { id: "darrow.host.synthetic", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(unsafe.value.error.message).toMatch(/unsafe entry/);
}, 20_000);

test("Sevro runs an existing Darrow case through the extension protocol", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-extension-"));
  roots.push(root);
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run({ workspace }) {
    await writeFile(join(workspace, "NOTES.md"), "# Notes\\n\\n- alpha\\n- maple\\n- zebra\\n");
    return { finalMessage: "Sorted the notes.", complete: true };
  },
};
`,
  );
  const result = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "orchestration-routing-localized-mechanical",
    "--results-root",
    join(root, "results"),
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
  ]);
  expect(result.code, result.stderr).toBe(0);
  expect(result.value.task.verdict).toBe("passed");
  expect(result.value.cases[0]!.trials[0]!.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "darrow.shell.1", status: "passed" }),
      expect.objectContaining({ id: "darrow.shell.2", status: "passed" }),
    ]),
  );
  const evidence = JSON.parse(
    await readFile(result.value.evidencePath, "utf8"),
  );
  expect(evidence.extension).toMatchObject({
    id: "darrow.evals",
    protocol: "sevro.extension.v1",
  });
  expect(evidence.evaluationIdentity.dimensions.runnerBuildDigest).toMatch(
    /^[a-f0-9]{64}$/,
  );
  expect(evidence.evaluationIdentity.dimensions.runnerBuildDigest).toBe(
    evidence.runner.buildDigest,
  );
  expect(evidence.evaluationIdentity.dimensions.projectDigest).toMatch(
    /^[a-f0-9]{64}$/,
  );
  expect(evidence.evaluationIdentity.dimensions.projectDigest).not.toBe(
    "a".repeat(64),
  );
  expect(evidence.trials[0].condition.requested).toBe("passive");
});

test("Darrow command reserves extension and identity options", () => {
  const args = [
    "--case-id",
    "example",
    "--results-root",
    "/tmp/darrow-sevro-results",
    "--",
  ];
  expect(() =>
    invocation([...args, "--project-digest", "a".repeat(64)]),
  ).toThrow(/owned by Darrow/);
  expect(() => invocation([...args, "--extension-command-file=other"])).toThrow(
    /owned by Darrow/,
  );
  expect(() => invocation([...args, "--case-source-map-file=other"])).toThrow(
    /owned by Darrow/,
  );
});

test("Darrow fixture setup runs through Sevro and rejects changed source", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-setup-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  const caseFile = join(cases, "setup.yaml");
  const definition = {
    id: "setup-case",
    invariant: "EXAMPLE-S1",
    prompt: "Return ready.",
    fixture: {
      commits: [{ message: "Initialize", files: { "README.md": "fixture\n" } }],
      setup:
        'test -f "{{case_dir}}/setup.yaml" && printf "setup\\n" > SETUP.txt',
    },
    checks: [{ name: "setup result", run: "test -f SETUP.txt" }],
    output_checks: [{ name: "response", expect_exact: "ready" }],
  };
  await writeFile(caseFile, JSON.stringify(definition));
  const resolveParams = {
    projectRoot: pathToFileURL(root).href,
    selectors: { caseIds: ["setup-case"] },
    configuration: {},
  };
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  expect(
    resolved.value.result.cases[0]!.extensionData["darrow.case"].setupDigest,
  ).toMatch(/^[a-f0-9]{64}$/);
  const prepareParams = {
    case: resolved.value.result.cases[0],
    host: { id: "darrow.host.synthetic", capabilities: [] },
    condition: "passive",
    configuration: {},
  };
  const prepared = await command<{
    result: {
      fixtureSetup: { command: string[]; environment: Record<string, string> };
    };
  }>([process.execPath, extension], request("prepare", prepareParams));
  expect(prepared.code, JSON.stringify(prepared.value)).toBe(0);
  expect(prepared.value.result.fixtureSetup).toMatchObject({
    command: [
      "/bin/bash",
      "-c",
      expect.stringContaining("$DARROW_EVAL_CASE_DIR"),
    ],
    environment: {
      DARROW_EVAL_CASE_DIR: "{{sevro.project}}/evals/experiments/example/cases",
    },
  });
  await writeFile(
    caseFile,
    JSON.stringify({
      ...definition,
      fixture: { ...definition.fixture, setup: "exit 0" },
    }),
  );
  const changed = await command<ExtensionReply>(
    [process.execPath, extension],
    request("prepare", prepareParams),
  );
  expect(changed.value.error.message).toMatch(/changed after resolution/);
  await writeFile(caseFile, JSON.stringify(definition));
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run({ workspace }) {
    if ((await Bun.file(workspace + "/SETUP.txt").text()) !== "setup\\n") throw new Error("setup missing");
    return { finalMessage: "ready", complete: true };
  },
};
`,
  );
  const run = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "setup-case",
    "--project-root",
    root,
    "--results-root",
    join(root, "results"),
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
  ]);
  expect(run.code, run.stderr).toBe(0);
  expect(run.value.task.verdict).toBe("passed");
  const evidence = JSON.parse(await readFile(run.value.evidencePath, "utf8"));
  expect(evidence.configuration.redacted.fixtureSetupDigest).toMatch(
    /^[a-f0-9]{64}$/,
  );
});

test("Darrow runs a pinned corpus repository with committed overlay and setup", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-corpus-"));
  roots.push(root);
  const corpus = join(root, "evals/corpus/orchestration");
  const repository = join(corpus, "cache/sample");
  const cases = join(root, "evals/experiments/example/cases");
  await Promise.all([
    mkdir(repository, { recursive: true }),
    mkdir(cases, { recursive: true }),
  ]);
  await git(repository, "init", "-b", "main");
  await writeFile(join(repository, "LICENSE"), "MIT\n");
  await writeFile(join(repository, "README.md"), "source\n");
  await git(repository, "add", "LICENSE", "README.md");
  await git(
    repository,
    "-c",
    "user.name=Corpus Test",
    "-c",
    "user.email=corpus@example.invalid",
    "commit",
    "-m",
    "Source snapshot",
  );
  const revision = await git(repository, "rev-parse", "HEAD");
  await writeFile(
    join(corpus, "manifest.yaml"),
    [
      "version: 1",
      "sources:",
      "  sample:",
      "    repository: https://example.invalid/sample.git",
      `    commit: ${revision}`,
      "    commit_date: 2021-01-02T03:04:05Z",
      "    license: MIT",
      "    license_file: LICENSE",
      "    provenance: pinned synthetic source",
      "",
    ].join("\n"),
  );
  const definition = {
    id: "corpus-case",
    invariant: "EXAMPLE-CORPUS",
    prompt: "Return ready.",
    fixture: {
      source: "sample",
      files: { "README.md": "overlay\n" },
      commit_files: true,
      setup: 'printf "setup\\n" > SETUP.txt',
    },
    checks: [
      { name: "overlay", run: 'test "$(cat README.md)" = overlay' },
      {
        name: "scaffolding",
        run: 'test "$(git log -1 --format=%s)" = "Add evaluation scaffolding"',
      },
      { name: "setup", run: 'test "$(cat SETUP.txt)" = setup' },
    ],
    output_checks: [{ name: "response", expect_exact: "ready" }],
  };
  await writeFile(join(cases, "corpus.yaml"), JSON.stringify(definition));
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["corpus-case"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  expect(resolved.value.result.cases[0]!.fixture).toMatchObject({
    kind: "repository",
    sourceRef: "sample",
    files: { "README.md": "overlay\n" },
    commitFiles: true,
  });
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run() { return { finalMessage: "ready", complete: true }; },
};
`,
  );
  const runArgs = [
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "corpus-case",
    "--project-root",
    root,
    "--results-root",
    join(root, "results"),
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
  ];
  const run = await command<CliReply>(runArgs);
  expect(run.code, run.stderr).toBe(0);
  expect(run.value.task.verdict).toBe("passed");
  expect(
    run.value.cases[0]!.trials[0]!.checks.map((check) => check.status),
  ).toEqual(["passed", "passed", "passed", "passed"]);
  expect(await readFile(join(repository, "README.md"), "utf8")).toBe(
    "source\n",
  );
  expect(await git(repository, "status", "--porcelain=v1")).toBe("");
  await writeFile(join(repository, "DRIFT.txt"), "not pinned\n");
  const rejected = Bun.spawn(runArgs, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(rejected.stdout).text(),
    new Response(rejected.stderr).text(),
    rejected.exited,
  ]);
  expect(code).toBe(64);
  expect(stderr).toContain("not clean");
  expect(stdout).toBe("");
});

test("Darrow Git hook fixtures run through Sevro before candidate commits", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-hook-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  const hook = "#!/bin/sh\necho 'fixture hook failed' >&2\nexit 1\n";
  await writeFile(
    join(cases, "hook.yaml"),
    JSON.stringify({
      id: "hook-case",
      invariant: "EXAMPLE-HOOK",
      prompt: "Return ready.",
      fixture: {
        commits: [
          {
            message: "Initialize",
            files: { "README.md": "fixture\n", "src/a.ts": "old\n" },
          },
        ],
        files: { "src/a.ts": "new\n" },
        staged: ["src/a.ts"],
        hooks: { "pre-commit": hook },
      },
      checks: [
        {
          name: "commit blocked",
          run: "git rev-list --count HEAD",
          expect_exact: "1",
        },
      ],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["hook-case"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  expect(resolved.value.result.cases[0]!.fixture).toMatchObject({
    kind: "generated",
    hooks: { "pre-commit": hook },
  });
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run({ workspace }) {
    const proc = Bun.spawn(["git", "-c", "user.name=Candidate", "-c", "user.email=candidate@example.invalid", "commit", "-m", "Try"], { cwd: workspace, stdout: "pipe", stderr: "pipe" });
    const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    if (code === 0 || !stderr.includes("fixture hook failed")) throw new Error("fixture hook was not applied");
    return { finalMessage: "ready", complete: true };
  },
};
`,
  );
  const run = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "hook-case",
    "--project-root",
    root,
    "--results-root",
    join(root, "results"),
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
  ]);
  expect(run.code, run.stderr).toBe(0);
  expect(run.value.task.verdict).toBe("passed");
  expect(
    run.value.cases[0]!.trials[0]!.checks.map((check) => check.status),
  ).toEqual(["passed", "passed"]);
});
