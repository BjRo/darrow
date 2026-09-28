import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
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
import { parse as parseYaml } from "yaml";
import { sevroCommand } from "../../sevro-extension/sevro-command";
import { invocation } from "../../sevro-extension/run";

const extension = resolve(import.meta.dir, "../../sevro-extension/index.ts");
const projectRoot = resolve(import.meta.dir, "../../..");
const roots: string[] = [];

test("Darrow refuses override mounts that contradict preparation configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-override-binding-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  const skillDir = "plugins/capability/example/skills/probe";
  await mkdir(cases, { recursive: true });
  for (const name of ["probe", "rival"]) {
    const directory = join(root, "plugins/capability/example/skills", name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "SKILL.md"), `${name} body\n`);
  }
  await writeFile(
    join(cases, "override.yaml"),
    JSON.stringify({
      id: "override-binding",
      invariant: "MOUNT-C1",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: init", files: { "README.md": "ready\n" } },
        ],
      },
      checks: [],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["override-binding"] },
      configuration: { skillDir, mountPluginSkills: true },
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const rejected = await command<{ error: { message: string } }>(
    [process.execPath, extension],
    request("prepare", {
      case: resolved.value.result.cases[0],
      host: { id: "sevro.host.codex", capabilities: [] },
      condition: "passive",
      configuration: { skillDir },
    }),
  );
  expect(rejected.value).toMatchObject({
    error: { message: expect.stringMatching(/mount.*configuration/i) },
  });
  const prepared = await command<{ result: { artifacts: unknown[] } }>(
    [process.execPath, extension],
    request("prepare", {
      case: resolved.value.result.cases[0],
      host: { id: "sevro.host.codex", capabilities: [] },
      condition: "passive",
      configuration: { skillDir, mountPluginSkills: true },
    }),
  );
  expect(prepared.code, prepared.stderr).toBe(0);
  expect(prepared.value.result.artifacts).toHaveLength(2);
});

test("Darrow condition files render the actual candidate route through Sevro", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-condition-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  const conditionFile = join(root, "instructions.md");
  const text = "  Route {{harness}}|{{model}}|{{effort}}.  \n";
  await writeFile(conditionFile, text);
  const runCommand = resolve(import.meta.dir, "../../sevro-extension/run.ts");
  for (const harness of ["codex", "claude"]) {
    const expected = `Route ${harness}|candidate-${harness}|high.\n\nReturn ready.`;
    await writeFile(
      join(cases, "condition.yaml"),
      JSON.stringify({
        id: "condition-case",
        invariant: "CONDITION-C1",
        prompt: "Return ready.",
        fixture: {
          commits: [
            {
              message: "chore: initialize",
              files: { "README.md": "fixture\n" },
            },
          ],
        },
        checks: [],
        output_checks: [{ name: "instructions", expect_exact: expected }],
      }),
    );
    const adapter = join(root, `${harness}.ts`);
    await writeFile(
      adapter,
      `export default {
      id: "sevro.host.${harness}", model: "candidate-${harness}", effort: "high",
      async run({ prompt }) { return { finalMessage: prompt, complete: true }; }
    };`,
    );
    const results = join(root, `results-${harness}`);
    const proc = Bun.spawn(
      [
        process.execPath,
        runCommand,
        "--case-id",
        "condition-case",
        "--project-root",
        root,
        "--results-root",
        results,
        "--benchmark-condition-file",
        conditionFile,
        "--benchmark-condition-label",
        "route-probe",
        "--without-skill",
        "--",
        "--adapter-module",
        adapter,
        "--condition",
        "passive",
        "--trials",
        "1",
        "--threshold",
        "1",
        "--shell-isolation",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code, stderr + stdout).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.task.verdict).toBe("passed");
    const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
    expect(
      await readFile(new URL(evidence.trials[0].rawResult.path), "utf8"),
    ).toBe(expected);
    expect(evidence.extension.capabilities).toContain("sevro.case.host-route");
    expect(
      JSON.parse(
        await readFile(
          join(results, "darrow-extension-redacted-configuration.json"),
          "utf8",
        ),
      ),
    ).toEqual({
      withoutSkill: true,
      benchmarkCondition: {
        label: "route-probe",
        sha256: createHash("sha256").update(text).digest("hex"),
      },
    });
  }
});

test("Darrow conditions preserve route rendering on the follow-up turn", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "darrow-sevro-condition-followup-"),
  );
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "followup.yaml"),
    JSON.stringify({
      id: "condition-followup",
      invariant: "CONDITION-C2",
      prompt: "Return ready.",
      follow_up_prompt: "Continue on {{harness}}|{{model}}|{{effort}}.",
      fixture: {
        commits: [
          { message: "chore: initialize", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
    }),
  );
  const text = "Use the declared route.";
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["condition-followup"] },
      host: {
        id: "sevro.host.codex",
        model: "candidate",
        effort: "high",
        capabilities: ["sevro.host.continuation"],
      },
      configuration: {
        benchmarkCondition: {
          label: "followup",
          text,
          sha256: createHash("sha256").update(text).digest("hex"),
        },
      },
    }),
  );
  expect(resolved.value.error).toBeUndefined();
  expect(resolved.value.result.cases[0]).toMatchObject({
    prompt: "Use the declared route.\n\nReturn ready.",
    followUpPrompt: "Continue on codex|candidate|high.",
  });
});

test("Darrow condition routes resolve after corpus preflight", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "darrow-sevro-condition-preflight-"),
  );
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  const expected =
    "Use the candidate route.\n\nStart on codex.|Continue on candidate|high.";
  await writeFile(
    join(cases, "preflight.yaml"),
    JSON.stringify({
      id: "condition-preflight",
      invariant: "CONDITION-C4",
      prompt: "Start on {{harness}}.",
      follow_up_prompt: "Continue on {{model}}|{{effort}}.",
      fixture: {
        commits: [
          { message: "chore: initialize", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "prompts", expect_exact: expected }],
    }),
  );
  const condition = join(root, "prefix.md");
  await writeFile(condition, "Use the candidate route.");
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
    id: "sevro.host.codex", model: "candidate", effort: "high",
    hostCapabilities: ["sevro.host.continuation"],
    async run({ prompt, followUpPrompt }) { return { finalMessage: prompt + "|" + followUpPrompt, complete: true }; }
  };`,
  );
  const proc = Bun.spawn(
    [
      process.execPath,
      resolve(import.meta.dir, "../../sevro-extension/run.ts"),
      "--case-id",
      "condition-preflight",
      "--project-root",
      root,
      "--results-root",
      join(root, "results"),
      "--benchmark-condition-file",
      condition,
      "--",
      "--adapter-module",
      adapter,
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
      "--shell-isolation",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(code, stderr + stdout).toBe(0);
  const result = JSON.parse(stdout);
  expect(result.task.verdict).toBe("passed");
  const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
  expect(
    await readFile(new URL(evidence.trials[0].rawResult.path), "utf8"),
  ).toBe(expected);
});

test("Darrow rejects invalid condition inputs before candidate execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-condition-invalid-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "invalid.yaml"),
    JSON.stringify({
      id: "condition-invalid",
      invariant: "CONDITION-C3",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: initialize", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
    }),
  );
  const marker = join(root, "candidate-started");
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
    id: "sevro.host.codex", model: "candidate", effort: "low",
    async run() { await Bun.write(${JSON.stringify(marker)}, "started"); return { finalMessage: "ready", complete: true }; }
  };`,
  );
  const invalid = [
    ["oversized.md", "x".repeat(64 * 1024 + 1), 64],
    ["invalid-utf8.md", Buffer.from([0xff]), 64],
    ["nul.md", "instruction\0", 64],
    ["template.md", "Use {{unknown}}.", 70],
  ] as const;
  for (const [name, text, expectedCode] of invalid) {
    const path = join(root, name);
    await writeFile(path, text);
    const proc = Bun.spawn(
      [
        process.execPath,
        resolve(import.meta.dir, "../../sevro-extension/run.ts"),
        "--case-id",
        "condition-invalid",
        "--project-root",
        root,
        "--results-root",
        join(root, `results-${name}`),
        "--benchmark-condition-file",
        path,
        "--",
        "--adapter-module",
        adapter,
        "--condition",
        "passive",
        "--trials",
        "1",
        "--threshold",
        "1",
        "--shell-isolation",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code, stderr + stdout).toBe(expectedCode);
    expect(await Bun.file(marker).exists()).toBe(false);
  }
});

test("guide disclosure uses retained response evidence through Sevro", async () => {
  const original = parseYaml(
    await readFile(
      join(
        projectRoot,
        ".agents/skills/darrow-guide/evals/guide-explicit.yaml",
      ),
      "utf8",
    ),
  );
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-disclosure-"));
  roots.push(root);
  const skill = join(root, ".agents/skills/darrow-guide");
  await mkdir(join(skill, "evals"), { recursive: true });
  await mkdir(join(root, ".claude/skills/darrow-guide"), { recursive: true });
  const body =
    "---\nname: darrow-guide\ndescription: Explain this repository.\n---\nUse local sources.\n";
  await writeFile(join(skill, "SKILL.md"), body);
  await writeFile(join(root, ".claude/skills/darrow-guide/SKILL.md"), body);
  await writeFile(
    join(skill, "evals/disclosure.yaml"),
    JSON.stringify({
      id: "guide-disclosure",
      invariant: "RG-C8",
      prompt: "Explain the repository.",
      fixture: {
        commits: [
          { message: "chore: initialize", files: { "README.md": "source\n" } },
        ],
      },
      checks: [
        original.checks.find(
          (check: { name: string }) => check.name === "Claude host disclosure",
        ),
      ],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["guide-disclosure"] },
      configuration: {},
    }),
  );
  const selected = resolved.value.result.cases[0]!;
  expect(selected.checks).toMatchObject([
    { id: "darrow.evals.disclosure.1", grader: "darrow.evals.disclosure" },
  ]);
  const final = {
    id: "sevro.observation.final-message",
    source: "sevro.host.claude",
    completeness: "complete",
    data: {
      text: "Claude support is best-effort; development is primarily with Codex.",
    },
  };
  for (const [observations, status] of [
    [[final], "passed"],
    [[{ ...final, data: { text: "Claude is supported." } }], "failed"],
    [
      [
        {
          ...final,
          source: "sevro.host.codex",
          data: { text: "Repository guide." },
        },
      ],
      "passed",
    ],
    [[], "unavailable"],
    [[final, final], "unavailable"],
    [[{ ...final, completeness: "partial" }], "unavailable"],
    [[{ ...final, source: "foreign.host" }], "unavailable"],
  ] as const) {
    const response = await command<{
      result: { checks: Array<{ status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        caseId: "guide-disclosure",
        execution: { status: "completed" },
        observations,
        builtinChecks: [],
        artifacts: [],
        extensionData: selected.extensionData,
        configuration: {},
      }),
    );
    expect(response.value.result.checks[0]?.status).toBe(status);
  }
  const commandFile = join(root, "extension-command.json");
  const adapter = join(root, "candidate.ts");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  const route = sevroCommand();
  for (const [text, complete, code, status] of [
    [final.data.text, true, 0, "passed"],
    ["Claude is supported.", true, 1, "failed"],
    [final.data.text, false, 4, "unavailable"],
  ] as const) {
    await writeFile(
      adapter,
      `export default {
      id: "sevro.host.claude", model: "synthetic", effort: "none",
      hostCapabilities: ["sevro.claude.repository-invocation"],
      async run() { return { finalMessage: ${JSON.stringify(text)}, complete: ${complete} }; }
    };`,
    );
    const result = await command<CliReply>([
      ...route.launch,
      "run",
      "--json",
      ...route.extraArgs,
      "--extension-command-file",
      commandFile,
      "--extension-source-file",
      extension,
      "--case-id",
      "guide-disclosure",
      "--project-root",
      root,
      "--results-root",
      join(root, "results"),
      "--adapter-module",
      adapter,
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
    ]);
    expect(result.code, result.stderr).toBe(code);
    expect(result.value.cases[0]?.trials[0]?.checks[0]?.status).toBe(status);
  }
  const casePath = join(skill, "evals/disclosure.yaml");
  const changed = JSON.parse(await readFile(casePath, "utf8"));
  changed.checks[0].run += "; echo changed";
  await writeFile(casePath, JSON.stringify(changed));
  const unsupported = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["guide-disclosure"] },
      configuration: {},
    }),
  );
  expect(unsupported.value.error.message).toContain(
    "unsupported legacy guide response check",
  );
});

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
        bin?: Record<string, string>;
      };
      checks: Array<{
        id: string;
        grader: string;
        configuration: Record<string, unknown>;
      }>;
      requiredEvidence: string[];
      extensionData: {
        "darrow.case": {
          invariant: string;
          activation?: { class: string; targetSkill: string };
          setupDigest?: string;
          ticketDigest?: string;
          checkMetrics?: Array<{ checkId: string; metric: string }>;
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
  const artificer = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams("artificer-status")),
  );
  expect(artificer.code, artificer.stderr).toBe(0);
  expect(
    artificer.value.result.cases[0]!.checks.map((check) => check.grader),
  ).toEqual(["sevro.shell", "sevro.git-head", "sevro.semantic"]);
  const branchGuard = await command<ExtensionReply>(
    [process.execPath, extension],
    request(
      "resolve",
      resolveParams("prepare-task-branch-guard-correlated-creation"),
    ),
  );
  expect(branchGuard.code, branchGuard.stderr).toBe(0);
  expect(branchGuard.value.result.cases[0]!.checks).toContainEqual({
    id: "darrow.shell.2",
    grader: "sevro.shell",
    configuration: {
      run: "git show-ref | diff .git/expected-refs -",
      expectedExitCode: 0,
    },
  });
  expect(selected.extensionData["darrow.case"].invariant).toBe(
    "ORCH-ROUTING-LOCALIZED-MECHANICAL",
  );
  const unchangedHead = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams("create-commit-clean-tree")),
  );
  expect(unchangedHead.code, unchangedHead.stderr).toBe(0);
  expect(unchangedHead.value.result.cases[0]!.checks).toContainEqual({
    id: "darrow.head.unchanged",
    grader: "sevro.git-head",
    configuration: { kind: "unchanged" },
  });
  const advancedHead = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams("create-commit-no-attribution")),
  );
  expect(advancedHead.code, advancedHead.stderr).toBe(0);
  expect(advancedHead.value.result.cases[0]!.checks).toEqual(
    expect.arrayContaining([
      {
        id: "darrow.head.changed",
        grader: "sevro.git-head",
        configuration: { kind: "changed" },
      },
      {
        id: "darrow.head.lineage",
        grader: "sevro.git-head",
        configuration: { kind: "base-ancestor" },
      },
    ]),
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
  const ossCase = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams("orchestration-oss-requests-proxy")),
  );
  expect(ossCase.code, ossCase.stderr).toBe(0);
  expect(ossCase.value.result.cases[0]!.fixture).toMatchObject({
    kind: "repository",
    sourceRef: "requests-2.25.1",
  });
  expect(
    ossCase.value.result.cases[0]!.extensionData["darrow.case"].checkMetrics,
  ).toContainEqual({ checkId: "darrow.shell.1", metric: "escaped_defect" });
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-unsupported-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "unsupported.yaml"),
    JSON.stringify({
      id: "unsupported-case",
      invariant: "EXAMPLE-UNSUPPORTED",
      prompt: "Return ready.",
      fixture: {
        commits: [{ message: "Initialize", files: { "README.md": "ready\n" } }],
        unknown_field: true,
      },
      checks: [],
    }),
  );
  const unsupported = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["unsupported-case"] },
      configuration: {},
    }),
  );
  expect(unsupported.value.error.code).toBe("darrow.extension.invalid");
  expect(unsupported.value.error.message).toMatch(/unknown_field/);
});

test("Darrow preserves case host restrictions and ignores diagnostic goal policy", async () => {
  const codexOnly = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["ticket-to-pr-unattended-grant"] },
      configuration: {},
    }),
  );
  expect(codexOnly.code, codexOnly.stderr).toBe(0);
  const selected = codexOnly.value.result.cases[0]!;
  expect(selected.extensionData["darrow.case"]).toMatchObject({
    hostIds: ["sevro.host.codex"],
  });
  const refused = await command<ExtensionReply>(
    [process.execPath, extension],
    request("prepare", {
      case: selected,
      host: { id: "sevro.host.synthetic", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(refused.value.error.message).toMatch(/excludes the candidate host/);
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-diagnostic-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/sample/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "diagnostic.yaml"),
    JSON.stringify({
      id: "diagnostic",
      invariant: "DIAGNOSTIC-C1",
      prompt: "Return ready.",
      goal_report: "forbidden",
      goal_route_checks: false,
      fixture: {
        commits: [
          { message: "chore: init", files: { "README.md": "ready\n" } },
        ],
      },
      checks: [],
    }),
  );
  const diagnostic = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["diagnostic"] },
      configuration: {},
    }),
  );
  expect(diagnostic.code, diagnostic.stderr).toBe(0);
  expect(diagnostic.value.result.cases[0]!.checks).toEqual([]);
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
  const explicitData = {
    "darrow.case": {
      ...extensionData["darrow.case"],
      invocation: { pluginName: "probe", skillName: "verify-change" },
    },
  };
  const readOnly = await evaluate([native], explicitData);
  expect(readOnly.value.result.domainOutcomes[0]!.status).toBe("unavailable");
  const dispatch = {
    ...native,
    id: "sevro.codex.explicit-invocation",
    data: { ...native.data, method: "explicit_invocation" },
  };
  const dispatched = await evaluate([native, dispatch], explicitData);
  expect(dispatched.value.result.domainOutcomes).toMatchObject([
    { status: "passed", evidenceRefs: ["sevro.codex.explicit-invocation"] },
  ]);
  const repeatedDispatch = await evaluate([dispatch, dispatch], explicitData);
  expect(repeatedDispatch.value.result.domainOutcomes[0]!.status).toBe(
    "unavailable",
  );
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

test("Darrow ownership checks use complete native evidence without private task content", async () => {
  const resolved = await command<{
    result: {
      cases: Array<{
        checks: Array<{ id: string; grader: string }>;
        requiredEvidence: string[];
        extensionData: Record<string, unknown>;
      }>;
    };
  }>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-verification-clear-first"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  expect(selected.requiredEvidence).toEqual(["sevro.codex.native-calls"]);
  expect(
    selected.checks.filter(
      (check) => check.grader === "darrow.evals.ownership",
    ),
  ).toHaveLength(3);
  const prepareParams = {
    case: selected,
    host: {
      id: "sevro.host.codex",
      capabilities: [
        "sevro.codex.plugin-marketplace",
        "sevro.codex.explicit-invocation",
        "sevro.codex.native-calls",
      ],
    },
    condition: "passive",
    configuration: {},
  };
  const prepared = await command<{ result: { artifacts: unknown[] } }>(
    [process.execPath, extension],
    request("prepare", prepareParams),
  );
  expect(prepared.value.result.artifacts.length).toBeGreaterThan(0);
  const missingCapability = await command<{ error: { message: string } }>(
    [process.execPath, extension],
    request("prepare", {
      ...prepareParams,
      host: { ...prepareParams.host, capabilities: [] },
    }),
  );
  expect(missingCapability.value.error.message).toMatch(/native-call evidence/);
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const final = {
    id: "sevro.observation.final-message",
    source: "sevro.host.codex",
    completeness: "complete",
    data: { text: "Proceed toward completion." },
  };
  const evaluate = (observations: unknown[]) =>
    command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        observations,
        extensionData: selected.extensionData,
      }),
    );
  const noOwner = await evaluate([native, final]);
  expect(noOwner.value.result.checks.map((check) => check.status)).toEqual([
    "passed",
    "passed",
    "passed",
  ]);
  const accepted = {
    ...native,
    data: {
      ...native.data,
      toolCalls: [
        { ordinal: 0, namespace: "collaboration", name: "spawn_agent" },
        {
          ordinal: 3,
          namespace: "collaboration",
          name: "send_message",
          target: "/root/owner",
        },
        { ordinal: 4, namespace: "collaboration", name: "wait_agent" },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 0,
          startedOrdinal: 1,
          acceptedOrdinal: 2,
          agentRef: "/root/owner",
        },
      ],
    },
  };
  const allowed = await evaluate([accepted, final]);
  expect(allowed.value.result.checks.map((check) => check.status)).toEqual([
    "passed",
    "passed",
    "passed",
  ]);
  const parentWork = await evaluate([
    {
      ...accepted,
      data: {
        ...accepted.data,
        toolCalls: [
          ...accepted.data.toolCalls,
          { ordinal: 5, namespace: "other", name: "exec" },
        ],
      },
    },
    final,
  ]);
  expect(parentWork.value.result.checks[1]?.status).toBe("failed");
  const wrongTarget = await evaluate([
    {
      ...accepted,
      data: {
        ...accepted.data,
        toolCalls: [
          accepted.data.toolCalls[0],
          {
            ordinal: 3,
            namespace: "collaboration",
            name: "send_message",
            target: "/root/other",
          },
        ],
      },
    },
    final,
  ]);
  expect(wrongTarget.value.result.checks[1]?.status).toBe("failed");
  const replacement = await evaluate([
    {
      ...accepted,
      data: {
        ...accepted.data,
        toolCalls: [
          ...accepted.data.toolCalls,
          { ordinal: 5, namespace: "collaboration", name: "spawn_agent" },
        ],
      },
    },
    final,
  ]);
  expect(replacement.value.result.checks[0]?.status).toBe("failed");
  const incomplete = await evaluate([
    { ...native, completeness: "partial" },
    final,
  ]);
  expect(
    incomplete.value.result.checks.slice(0, 2).map((check) => check.status),
  ).toEqual(["unavailable", "unavailable"]);
  const malformed = await evaluate([
    { ...native, data: { ...native.data, toolCalls: [null] } },
    final,
  ]);
  expect(
    malformed.value.result.checks.slice(0, 2).map((check) => check.status),
  ).toEqual(["unavailable", "unavailable"]);
  const internalRecord = await evaluate([
    native,
    { ...final, data: { text: "format\tdarrow-native-goal-v1" } },
  ]);
  expect(internalRecord.value.result.checks[2]?.status).toBe("failed");
});

test("task recipe composition keeps the two legacy ownership checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-composition-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/sample/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "composition.yaml"),
    JSON.stringify({
      id: "composition",
      invariant: "COMPOSITION-C1",
      prompt: "Delegate the accepted request.",
      adaptive_delivery_composition: true,
      fixture: {
        commits: [
          { message: "chore: init", files: { "README.md": "ready\n" } },
        ],
      },
      checks: [],
    }),
  );
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["composition"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  expect(selectedCase.checks.map((check) => check.id)).toEqual([
    "darrow.evals.ownership.single-owner",
    "darrow.evals.ownership.parent-work",
  ]);
  expect(selectedCase.requiredEvidence).toEqual(["sevro.codex.native-calls"]);
  expect(selectedCase.extensionData["darrow.case"]).toMatchObject({
    ownership: "composition",
  });
  const prepared = await command<ExtensionReply>(
    [process.execPath, extension],
    request("prepare", {
      case: selectedCase,
      host: { id: "sevro.host.synthetic", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.value.error.message).toMatch(/native-call evidence/);
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const evaluated = await command<{
    result: { checks: Array<{ id: string; status: string }> };
  }>(
    [process.execPath, extension],
    request("evaluate", {
      extensionData: selectedCase.extensionData,
      observations: [native],
    }),
  );
  expect(evaluated.code, evaluated.stderr).toBe(0);
  expect(evaluated.value.result.checks.map((check) => check.status)).toEqual([
    "passed",
    "passed",
  ]);
});

test("Darrow translates no-agent transcript assertions into bounded native checks", async () => {
  const selected = await command<{
    result: {
      cases: Array<{
        checks: Array<{
          id: string;
          grader: string;
          configuration: Record<string, unknown>;
        }>;
        requiredEvidence: string[];
        extensionData: Record<string, unknown>;
      }>;
    };
  }>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-budgeted-repair-explicit-zero"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  expect(selectedCase.requiredEvidence).toEqual(["sevro.codex.native-calls"]);
  expect(selectedCase.checks).toContainEqual({
    id: "darrow.evals.transcript.1",
    grader: "darrow.evals.transcript",
    configuration: {},
  });
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const evaluate = (observations: unknown[]) =>
    command<{
      result: {
        checks: Array<{ id: string; status: string; evidenceRefs: string[] }>;
      };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        observations,
        extensionData: selectedCase.extensionData,
      }),
    );
  const status = async (observations: unknown[]) => {
    const response = await evaluate(observations);
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks.find(
      (check) => check.id === "darrow.evals.transcript.1",
    );
  };
  expect(await status([native])).toMatchObject({
    status: "passed",
    evidenceRefs: ["sevro.codex.native-calls"],
  });
  const spawn = {
    ...native,
    data: {
      ...native.data,
      calls: [
        {
          ordinal: 0,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 0, namespace: "collaboration", name: "spawn_agent" },
      ],
    },
  };
  expect((await status([spawn]))?.status).toBe("failed");
  expect(
    (await status([{ ...spawn, data: { ...spawn.data, toolCalls: [] } }]))
      ?.status,
  ).toBe("unavailable");
  expect((await status([{ ...native, completeness: "partial" }]))?.status).toBe(
    "unavailable",
  );
  expect((await status([native, native]))?.status).toBe("unavailable");
  for (const id of [
    "ticket-to-pr-compatible-orchestrator",
    "author-agent-skill-reuse-current-review",
    "verification-missing-review",
  ]) {
    const variant = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [id] },
        configuration: {},
      }),
    );
    expect(variant.code, variant.stderr).toBe(0);
    const variantCase = variant.value.result.cases[0]!;
    expect(variantCase.requiredEvidence).toContain("sevro.codex.native-calls");
    const evaluated = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        observations: [spawn],
        extensionData: variantCase.extensionData,
      }),
    );
    expect(evaluated.code, evaluated.stderr).toBe(0);
    expect(
      evaluated.value.result.checks.find(
        (check) => check.id === "darrow.evals.transcript.1",
      )?.status,
    ).toBe("failed");
  }
});

test("repository guide assertions forbid owner and goal-control attempts", async () => {
  const resolveGuide = (id: string) =>
    command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [id] },
      }),
    );
  const resolved = await resolveGuide("guide-mutation");
  expect(resolved.code, resolved.stderr).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  expect(selected.requiredEvidence).toEqual(["sevro.host.native-controls"]);
  expect((await resolveGuide("guide-orchestration")).code).toBe(0);
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const status = async (observations: unknown[]) => {
    const portable = observations
      .map((value) => value as typeof native)
      .filter((value) => value.id === "sevro.codex.native-calls")
      .map(({ source, completeness, data }) => ({
        id: "sevro.host.native-controls",
        source,
        completeness,
        data: {
          method: "native_control_calls",
          calls: data.toolCalls,
          acceptedAgentCount: data.acceptedSpawns.length,
          submittedExecCalls: data.submittedExecCalls,
          truncated: false,
        },
      }));
    const result = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        observations: [...observations, ...portable],
        extensionData: selected.extensionData,
      }),
    );
    expect(result.code, result.stderr).toBe(0);
    return result.value.result.checks.find(
      (check) => check.id === "darrow.evals.transcript.1",
    )?.status;
  };
  expect(await status([native])).toBe("passed");
  for (const [namespace, name] of [
    ["collaboration", "spawn_agent"],
    ["functions", "create_goal"],
    ["functions", "update_goal"],
  ]) {
    const call = { ordinal: 0, namespace, name };
    expect(
      await status([
        {
          ...native,
          data: {
            ...native.data,
            calls: [{ ...call, evidence: "invocation_attempt" }],
            toolCalls: [call],
          },
        },
      ]),
    ).toBe("failed");
    expect(
      await status([
        { ...native, data: { ...native.data, calls: [], toolCalls: [call] } },
      ]),
    ).toBe("unavailable");
  }
  expect(await status([])).toBe("unavailable");
  expect(await status([{ ...native, completeness: "partial" }])).toBe(
    "unavailable",
  );
  expect(await status([native, native])).toBe("unavailable");
  expect(
    await status([
      { ...native, data: { ...native.data, submittedExecCalls: 1 } },
    ]),
  ).toBe("unavailable");
});

test("guide native control assertions prepare and grade on Claude", async () => {
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["guide-mutation"] },
    }),
  );
  const selected = resolved.value.result.cases[0]!;
  expect(selected.requiredEvidence).toEqual(["sevro.host.native-controls"]);
  const capabilities = [
    "sevro.claude.repository-invocation",
    "sevro.host.native-controls",
  ];
  const prepare = (caps: string[]) =>
    command<{
      result?: { claudeRepositorySkillInvocation: { skillName: string } };
      error?: { message: string };
    }>(
      [process.execPath, extension],
      request("prepare", {
        case: selected,
        host: { id: "sevro.host.claude", capabilities: caps },
        condition: "passive",
        configuration: {},
      }),
    );
  const ready = await prepare(capabilities);
  expect(ready.value.result, ready.value.error?.message).toBeDefined();
  expect(ready.value.result?.claudeRepositorySkillInvocation).toEqual({
    skillName: "darrow-guide",
  });
  expect(
    (await prepare(capabilities.slice(0, 1))).value.error?.message,
  ).toContain("native control evidence");
  const native = {
    id: "sevro.host.native-controls",
    source: "sevro.host.claude",
    completeness: "complete",
    data: {
      method: "native_control_calls",
      calls: [],
      acceptedAgentCount: null,
      submittedExecCalls: null,
      truncated: false,
    },
  };
  const status = async (observations: unknown[]) => {
    const result = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        observations,
        extensionData: selected.extensionData,
      }),
    );
    return result.value.result.checks.find(
      (check) => check.id === "darrow.evals.transcript.1",
    )?.status;
  };
  expect(await status([native])).toBe("passed");
  for (const name of ["Agent", "Task", "create_goal", "update_goal"])
    expect(
      await status([
        {
          ...native,
          data: {
            ...native.data,
            calls: [{ ordinal: 1, namespace: "claude", name }],
          },
        },
      ]),
    ).toBe("failed");
  for (const altered of [
    { ...native, completeness: "partial" },
    { ...native, source: "foreign.host" },
    { ...native, data: { ...native.data, truncated: true } },
    { ...native, data: { ...native.data, acceptedAgentCount: 0 } },
    {
      ...native,
      data: {
        ...native.data,
        calls: [{ ordinal: 1, namespace: "functions", name: "Read" }],
      },
    },
    {
      ...native,
      data: {
        ...native.data,
        calls: [
          { ordinal: 1, namespace: "claude", name: "Read" },
          { ordinal: 1, namespace: "claude", name: "Read" },
        ],
      },
    },
  ])
    expect(await status([altered])).toBe("unavailable");
  expect(await status([])).toBe("unavailable");
  expect(await status([native, native])).toBe("unavailable");
  const legacy = {
    id: "sevro.claude.tool-calls",
    source: "sevro.host.claude",
    completeness: "complete",
    data: {
      method: "stream_tool_calls",
      truncated: false,
      calls: [
        {
          ordinal: 1,
          actor: "parent",
          parentToolUseId: null,
          name: "Agent",
          toolUseId: "owner-call",
          subagentType: "worker",
          runInBackground: false,
          model: null,
          promptSha256: "a".repeat(64),
          promptFirstLineSha256: "b".repeat(64),
        },
      ],
    },
  };
  expect(await status([native, legacy])).toBe("unavailable");
});

test("Darrow doctor controls require intact negative evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-doctor-"));
  roots.push(root);
  const eventPath = join(root, "events.jsonl");
  const events = async (content: string) => {
    await writeFile(eventPath, content);
    return {
      id: "sevro.codex.events",
      path: pathToFileURL(eventPath).href,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  };
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const skills = {
    id: "sevro.codex.skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: null,
      observedSkills: [],
    },
  };
  const clean = await events("turn.completed\n");
  const evaluate = async (
    selectedCase: ExtensionReply["result"]["cases"][number],
    observations: unknown[],
    artifacts: unknown[],
  ) => {
    const reply = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
        artifacts,
      }),
    );
    expect(reply.code, reply.stderr).toBe(0);
    return reply.value.result.checks.find(
      (check) => check.id === "darrow.evals.transcript.1",
    )?.status;
  };
  for (const suffix of [
    "counterexample-depth",
    "direct-codex",
    "effective-project",
    "incomplete-host",
    "indirect-claude",
    "nonactivation-delivery",
    "unknown-project-trust",
  ]) {
    const selected = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [`doctor-adaptive-delivery-${suffix}`] },
        configuration: {},
      }),
    );
    expect(selected.code, selected.stderr).toBe(0);
    const selectedCase = selected.value.result.cases[0]!;
    expect(selectedCase.requiredEvidence).toContain("sevro.codex.events");
    expect(await evaluate(selectedCase, [native, skills], [clean])).toBe(
      "passed",
    );
    expect(await evaluate(selectedCase, [native, skills], [])).toBe(
      "unavailable",
    );
    expect(
      await evaluate(
        selectedCase,
        [native, { ...skills, completeness: "partial" }],
        [clean],
      ),
    ).toBe(
      suffix === "effective-project" ||
        suffix === "incomplete-host" ||
        suffix === "unknown-project-trust"
        ? "passed"
        : "unavailable",
    );
  }
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["doctor-adaptive-delivery-direct-codex"] },
      configuration: {},
    }),
  );
  const selectedCase = selected.value.result.cases[0]!;
  expect(
    await evaluate(
      selectedCase,
      [
        native,
        {
          ...skills,
          data: {
            ...skills.data,
            primarySkill: "adaptive-delivery",
            observedSkills: ["adaptive-delivery"],
          },
        },
      ],
      [clean],
    ),
  ).toBe("failed");
  expect(
    await evaluate(
      selectedCase,
      [native, skills],
      [await events("adaptive-delivery-preflight\n")],
    ),
  ).toBe("failed");
  expect(
    await evaluate(
      selectedCase,
      [native, skills],
      [await events('{"skill":"adaptive-delivery"}\n')],
    ),
  ).toBe("failed");
  expect(
    await evaluate(
      selectedCase,
      [
        {
          ...native,
          data: {
            ...native.data,
            calls: [
              {
                ordinal: 1,
                namespace: "collaboration",
                name: "spawn_agent",
                evidence: "invocation_attempt",
              },
            ],
            toolCalls: [
              { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
            ],
          },
        },
        skills,
      ],
      [await events("turn.completed\n")],
    ),
  ).toBe("failed");
  expect(
    await evaluate(
      selectedCase,
      [
        {
          ...native,
          data: {
            ...native.data,
            toolCalls: [{ ordinal: 1, namespace: "functions", name: "Agent" }],
          },
        },
        skills,
      ],
      [await events("turn.completed\n")],
    ),
  ).toBe("failed");
});

test("Darrow keeps adaptive delivery inactive for ordinary engineering", async () => {
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-ordinary-engineering-does-not-activate"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  expect(selectedCase.requiredEvidence).toContain("sevro.codex.skill-reads");
  expect(selectedCase.requiredEvidence).toContain("sevro.codex.events");
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-ordinary-"));
  roots.push(root);
  const events = async (name: string, content: string) => {
    const path = join(root, name);
    await writeFile(path, content);
    return {
      id: "sevro.codex.events",
      path: pathToFileURL(path).href,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  };
  const clean = await events("clean.jsonl", "turn.completed\n");
  const owner = await events(
    "owner.jsonl",
    '{"name":"Agent","phase":"adaptive-delivery-owner"}\n',
  );
  const skills = {
    id: "sevro.codex.skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: null,
      observedSkills: [],
    },
  };
  const status = async (observations: unknown[], artifacts: unknown[]) => {
    const response = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
        artifacts,
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks.find(
      (check) => check.id === "darrow.evals.transcript.1",
    )?.status;
  };
  expect(await status([skills], [clean])).toBe("passed");
  expect(await status([skills], [owner])).toBe("failed");
  expect(
    await status(
      [
        {
          ...skills,
          data: {
            ...skills.data,
            primarySkill: "adaptive-delivery",
            observedSkills: ["adaptive-delivery"],
          },
        },
      ],
      [clean],
    ),
  ).toBe("failed");
  expect(await status([skills], [])).toBe("unavailable");
  expect(await status([], [clean])).toBe("unavailable");
  expect(await status([skills], [{ ...clean, sha256: "0".repeat(64) }])).toBe(
    "unavailable",
  );
});

test("Darrow guards advice-only and missing-ticket delegation", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-delegation-"));
  roots.push(root);
  const artifact = async (name: string, content: string) => {
    const path = join(root, name);
    await writeFile(path, content);
    return {
      id: "sevro.codex.events",
      path: pathToFileURL(path).href,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  };
  const clean = await artifact("clean.jsonl", "turn.completed\n");
  const skillCall = await artifact(
    "skill.jsonl",
    '{"name":"Skill","skill":"adaptive-delivery"}\n',
  );
  const preflight = await artifact(
    "preflight.jsonl",
    "adaptive-delivery-preflight prepare\n",
  );
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const skills = {
    id: "sevro.codex.skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: null,
      observedSkills: [],
    },
  };
  for (const [caseId, adviceOnly] of [
    ["goal-blocked-retry-existing-publication", true],
    ["goal-blocked-retry-observes-publication", true],
    ["ticket-to-pr-missing-ticket", false],
    ["ticket-to-pr-ambiguous-ticket", false],
  ] as const) {
    const selected = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [caseId] },
        configuration: {},
      }),
    );
    expect(selected.code, selected.stderr).toBe(0);
    const selectedCase = selected.value.result.cases[0]!;
    expect(selectedCase.requiredEvidence).toContain("sevro.codex.events");
    const status = async (observations: unknown[], artifacts: unknown[]) => {
      const reply = await command<{
        result: { checks: Array<{ id: string; status: string }> };
      }>(
        [process.execPath, extension],
        request("evaluate", {
          extensionData: selectedCase.extensionData,
          observations,
          artifacts,
        }),
      );
      expect(reply.code, reply.stderr).toBe(0);
      return reply.value.result.checks.find(
        (check) => check.id === "darrow.evals.transcript.1",
      )?.status;
    };
    const observations = adviceOnly ? [native] : [skills];
    expect(await status(observations, [clean])).toBe("passed");
    expect(
      await status(observations, [adviceOnly ? preflight : skillCall]),
    ).toBe("failed");
    expect(await status(observations, [])).toBe("unavailable");
    expect(await status([], [clean])).toBe("unavailable");
  }
});

test("Darrow grades ticket delegation from supporting reads and forbidden calls", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-ticket-delegation-"));
  roots.push(root);
  const artifact = async (name: string, content: string) => {
    const path = join(root, name);
    await writeFile(path, content);
    return {
      id: "sevro.codex.events",
      path: pathToFileURL(path).href,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  };
  const clean = await artifact("clean.jsonl", "turn.completed\n");
  const forbidden = await artifact(
    "forbidden.jsonl",
    '{"name":"Skill","skill":"prepare-task-branch"}\n',
  );
  const skills = {
    id: "sevro.codex.skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: "adaptive-delivery",
      observedSkills: ["adaptive-delivery"],
    },
  };
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const resolveTicket = async (caseId: string) => {
    const reply = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [caseId] },
        configuration: {},
      }),
    );
    expect(reply.code, reply.stderr).toBe(0);
    return reply.value.result.cases[0]!;
  };
  const statuses = async (
    selectedCase: ExtensionReply["result"]["cases"][number],
    observations: unknown[],
    artifacts: unknown[] = [],
  ) => {
    const reply = await command<{
      result: { checks: Array<{ id: string; status: string }> };
      error?: { message: string };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
        artifacts,
      }),
    );
    expect(reply.code, reply.stderr).toBe(0);
    expect(reply.value.result, reply.value.error?.message).toBeDefined();
    return reply.value.result.checks
      .filter((check) => check.id.startsWith("darrow.evals.transcript."))
      .map((check) => check.status);
  };
  const explicit = await resolveTicket(
    "ticket-to-pr-explicit-options-delegation",
  );
  expect(explicit.requiredEvidence).toContain("sevro.codex.skill-reads");
  expect(await statuses(explicit, [skills])).toEqual(["passed"]);
  expect(await statuses(explicit, [])).toEqual(["unavailable"]);
  const shortcut = await resolveTicket("ticket-to-pr-shortcut-delegation");
  expect(await statuses(shortcut, [skills], [clean])).toEqual([
    "passed",
    "passed",
  ]);
  expect((await statuses(shortcut, [skills], [forbidden]))[1]).toBe("failed");
  const unavailable = await resolveTicket(
    "ticket-to-pr-adaptive-delivery-unavailable",
  );
  const ticketReads = {
    ...skills,
    data: {
      ...skills.data,
      primarySkill: "ticket-to-pr",
      observedSkills: ["ticket-to-pr"],
    },
  };
  expect(await statuses(unavailable, [native, ticketReads], [clean])).toEqual([
    "passed",
  ]);
  expect(await statuses(unavailable, [native, ticketReads], [])).toEqual([
    "unavailable",
  ]);
  expect(
    await statuses(
      unavailable,
      [
        native,
        {
          ...ticketReads,
          data: {
            ...ticketReads.data,
            observedSkills: ["ticket-to-pr", "prepare-task-branch"],
          },
        },
      ],
      [clean],
    ),
  ).toEqual(["failed"]);
  expect(
    await statuses(
      unavailable,
      [
        {
          ...native,
          data: {
            ...native.data,
            calls: [
              {
                ordinal: 1,
                namespace: "collaboration",
                name: "spawn_agent",
                evidence: "invocation_attempt",
              },
            ],
            toolCalls: [
              { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
            ],
          },
        },
        ticketReads,
      ],
      [clean],
    ),
  ).toEqual(["failed"]);
});

test("Darrow binds composed publisher reads to the accepted child", async () => {
  const accepted = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 1,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 1,
          startedOrdinal: 2,
          acceptedOrdinal: 3,
          agentRef: "/root/owner",
          threadId: "child-thread",
        },
      ],
      childSessions: [
        {
          threadId: "child-thread",
          status: "available",
          resultStatus: "completed",
          readDiagnostics: {
            completeness: "complete",
            observedSkills: ["create-pr"],
            commandExecutions: 1,
            readAttempts: 1,
            truncated: false,
          },
          nestedSpawns: [],
          requestsTruncated: false,
        },
      ],
      childrenTruncated: false,
      submittedExecCalls: 0,
    },
  };
  for (const [caseId, publisher] of [
    ["ticket-to-pr-composition-existing-pr", "create-pr"],
    ["ticket-to-pr-composition-replacement", "ship-proposal"],
  ] as const) {
    const resolved = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [caseId] },
        configuration: {},
      }),
    );
    expect(resolved.code, resolved.stderr).toBe(0);
    const selectedCase = resolved.value.result.cases[0]!;
    expect(selectedCase.requiredEvidence).toContain("sevro.codex.native-calls");
    const statuses = async (observation: unknown) => {
      const reply = await command<{
        result: { checks: Array<{ id: string; status: string }> };
        error?: { message: string };
      }>(
        [process.execPath, extension],
        request("evaluate", {
          extensionData: selectedCase.extensionData,
          observations: observation ? [observation] : [],
        }),
      );
      expect(reply.code, reply.stderr).toBe(0);
      expect(reply.value.result, reply.value.error?.message).toBeDefined();
      return reply.value.result.checks
        .filter((check) => check.id.startsWith("darrow.evals.transcript."))
        .map((check) => check.status);
    };
    const bound = {
      ...accepted,
      data: {
        ...accepted.data,
        childSessions: [
          {
            ...accepted.data.childSessions[0]!,
            readDiagnostics: {
              ...accepted.data.childSessions[0]!.readDiagnostics,
              observedSkills: [publisher],
            },
          },
        ],
      },
    };
    expect(await statuses(bound)).toEqual(["passed", "passed", "passed"]);
    expect((await statuses(accepted))[1]).toBe(
      publisher === "create-pr" ? "passed" : "failed",
    );
    expect(
      (
        await statuses({
          ...bound,
          data: {
            ...bound.data,
            childSessions: [
              { ...bound.data.childSessions[0], status: "partial" },
            ],
          },
        })
      )[1],
    ).toBe("unavailable");
    expect(
      (
        await statuses({
          ...bound,
          data: {
            ...bound.data,
            toolCalls: [
              ...bound.data.toolCalls,
              { ordinal: 4, namespace: "other", name: "exec" },
            ],
          },
        })
      )[2],
    ).toBe("failed");
  }
});

test("Darrow grades skill nonactivation from complete reads and native calls", async () => {
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const skillReads = {
    id: "sevro.codex.skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: null,
      observedSkills: [],
    },
  };
  for (const [caseId, forbiddenSkill] of [
    [
      "publish-pr-evidence-generic-comment-nonactivation",
      "publish-pr-evidence",
    ],
    ["ticket-to-pr-ordinary-engineering-nonactivation", "ticket-to-pr"],
  ]) {
    const selected = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [caseId] },
        configuration: {},
      }),
    );
    expect(selected.code, selected.stderr).toBe(0);
    const selectedCase = selected.value.result.cases[0]!;
    expect(selectedCase.requiredEvidence).toContain("sevro.codex.skill-reads");
    expect(selectedCase.requiredEvidence).toContain("sevro.codex.native-calls");
    const status = async (observations: unknown[]) => {
      const response = await command<{
        result: { checks: Array<{ id: string; status: string }> };
      }>(
        [process.execPath, extension],
        request("evaluate", {
          extensionData: selectedCase.extensionData,
          observations,
        }),
      );
      expect(response.code, response.stderr).toBe(0);
      return response.value.result.checks.find(
        (check) => check.id === "darrow.evals.transcript.1",
      )?.status;
    };
    expect(await status([native, skillReads])).toBe("passed");
    expect(
      await status([
        native,
        {
          ...skillReads,
          data: {
            ...skillReads.data,
            primarySkill: forbiddenSkill,
            observedSkills: [forbiddenSkill],
          },
        },
      ]),
    ).toBe("failed");
    expect(
      await status([
        {
          ...native,
          data: {
            ...native.data,
            toolCalls: [{ ordinal: 0, namespace: "other", name: "Skill" }],
          },
        },
        skillReads,
      ]),
    ).toBe("failed");
    expect(
      await status([native, { ...skillReads, completeness: "partial" }]),
    ).toBe("unavailable");
    if (caseId === "ticket-to-pr-ordinary-engineering-nonactivation") {
      const spawn = {
        ordinal: 0,
        namespace: "collaboration",
        name: "spawn_agent",
        evidence: "invocation_attempt",
      };
      expect(
        await status([
          {
            ...native,
            data: {
              ...native.data,
              calls: [spawn],
              toolCalls: [spawn],
            },
          },
          skillReads,
        ]),
      ).toBe("failed");
    }
  }
});

test("Darrow grades accepted owner assertions from correlated native receipts", async () => {
  const accepted = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 1,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 1,
          startedOrdinal: 2,
          acceptedOrdinal: 3,
          agentRef: "/root/owner",
          threadId: "child-thread",
        },
      ],
      submittedExecCalls: 0,
    },
  };
  for (const id of [
    "goal-post-launch-reassessment",
    "goal-verification-combined-repair",
  ]) {
    const selected = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [id] },
        configuration: {},
      }),
    );
    expect(selected.code, selected.stderr).toBe(0);
    const selectedCase = selected.value.result.cases[0]!;
    expect(selectedCase.requiredEvidence).toContain("sevro.codex.native-calls");
    const transcript = selectedCase.checks.find(
      (check) => check.grader === "darrow.evals.transcript",
    )!;
    const status = async (observations: unknown[]) => {
      const response = await command<{
        result: { checks: Array<{ id: string; status: string }> };
      }>(
        [process.execPath, extension],
        request("evaluate", {
          extensionData: selectedCase.extensionData,
          observations,
        }),
      );
      expect(response.code, response.stderr).toBe(0);
      return response.value.result.checks.find(
        (check) => check.id === transcript.id,
      )?.status;
    };
    expect(await status([accepted])).toBe("passed");
    expect(
      await status([
        { ...accepted, data: { ...accepted.data, acceptedSpawns: [] } },
      ]),
    ).toBe("failed");
    expect(
      await status([
        {
          ...accepted,
          data: {
            ...accepted.data,
            acceptedSpawns: [
              { ...accepted.data.acceptedSpawns[0], requestedOrdinal: 0 },
            ],
          },
        },
      ]),
    ).toBe("unavailable");
    expect(await status([])).toBe("unavailable");
  }
});

test("Darrow grades the selected Codex owner route from native acceptance", async () => {
  const accepted = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 1,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 1,
          startedOrdinal: 2,
          acceptedOrdinal: 3,
          agentRef: "/root/owner",
          threadId: "child-thread",
          model: "gpt-6-luna",
          reasoningEffort: "medium",
        },
      ],
      submittedExecCalls: 0,
    },
  };
  for (const [caseId, model, reasoningEffort] of [
    ["goal-preflight-high-risk-routine", "gpt-6-luna", "medium"],
    ["goal-preflight-quality-sensitive-localized", "gpt-6-luna", "high"],
    [
      "goal-preflight-routing-difficult-routine-diagnosis",
      "gpt-6-astra",
      "high",
    ],
  ] as const) {
    const selected = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [caseId] },
        configuration: {},
      }),
    );
    expect(selected.code, selected.stderr).toBe(0);
    const selectedCase = selected.value.result.cases[0]!;
    expect(selectedCase.requiredEvidence).toContain("sevro.codex.native-calls");
    const status = async (observation: unknown) => {
      const reply = await command<{
        result: { checks: Array<{ id: string; status: string }> };
      }>(
        [process.execPath, extension],
        request("evaluate", {
          extensionData: selectedCase.extensionData,
          observations: observation ? [observation] : [],
          builtinChecks: [],
          execution: { status: "completed" },
        }),
      );
      expect(reply.code, reply.stderr).toBe(0);
      expect(reply.value.result, JSON.stringify(reply.value)).toBeDefined();
      return reply.value.result.checks.find(
        (check) => check.id === "darrow.evals.transcript.1",
      )?.status;
    };
    const routed = {
      ...accepted,
      data: {
        ...accepted.data,
        acceptedSpawns: [
          { ...accepted.data.acceptedSpawns[0], model, reasoningEffort },
        ],
      },
    };
    expect(await status(routed)).toBe("passed");
    expect(
      await status({
        ...routed,
        data: {
          ...routed.data,
          acceptedSpawns: [
            { ...routed.data.acceptedSpawns[0], model: "gpt-6-sol" },
          ],
        },
      }),
    ).toBe("failed");
    expect(
      await status({
        ...routed,
        data: {
          ...routed.data,
          acceptedSpawns: [
            { ...routed.data.acceptedSpawns[0], model: undefined },
          ],
        },
      }),
    ).toBe("unavailable");
    expect(await status({ ...routed, completeness: "partial" })).toBe(
      "unavailable",
    );
  }
  const bounded = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-preflight-bounded-native-goal"] },
      configuration: {},
    }),
  );
  expect(bounded.code, bounded.stderr).toBe(0);
  const selectedCase = bounded.value.result.cases[0]!;
  const statuses = async (observation: unknown) => {
    const reply = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations: [observation],
        builtinChecks: [],
        execution: { status: "completed" },
      }),
    );
    expect(reply.code, reply.stderr).toBe(0);
    return reply.value.result.checks
      .filter((check) => check.id.startsWith("darrow.evals.transcript."))
      .map((check) => check.status);
  };
  expect((await statuses(accepted)).slice(0, 3)).toEqual([
    "passed",
    "passed",
    "passed",
  ]);
  expect(
    (
      await statuses({
        ...accepted,
        data: {
          ...accepted.data,
          calls: [
            ...accepted.data.calls,
            {
              ordinal: 4,
              namespace: "collaboration",
              name: "spawn_agent",
              evidence: "invocation_attempt",
            },
          ],
          toolCalls: [
            ...accepted.data.toolCalls,
            { ordinal: 4, namespace: "collaboration", name: "spawn_agent" },
          ],
          acceptedSpawns: [
            ...accepted.data.acceptedSpawns,
            {
              requestedOrdinal: 4,
              startedOrdinal: 5,
              acceptedOrdinal: 6,
              agentRef: "/root/second",
              threadId: "second-thread",
            },
          ],
        },
      })
    )[2],
  ).toBe("failed");
});

test("Darrow grades completed independent readers through nested native receipts", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-readers-"));
  roots.push(root);
  const eventPath = join(root, "events.jsonl");
  const eventText = "inspect-candidate\n";
  await writeFile(eventPath, eventText);
  const artifact = {
    id: "sevro.codex.events",
    path: pathToFileURL(eventPath).href,
    sha256: createHash("sha256").update(eventText).digest("hex"),
  };
  const spec = {
    requestedOrdinal: 0,
    status: "accepted",
    taskName: "spec_reader",
    model: "gpt-6-luna",
    reasoningEffort: "high",
    forkTurns: "none",
    agentRef: "/root/spec_reader",
    threadId: "spec-thread",
    sessionStatus: "available",
    readerResultStatus: "completed",
  };
  const standards = {
    ...spec,
    requestedOrdinal: 3,
    taskName: "standards_reader",
    agentRef: "/root/standards_reader",
    threadId: "standards-thread",
  };
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 1,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 1,
          startedOrdinal: 2,
          acceptedOrdinal: 3,
          agentRef: "/root/provider",
          threadId: "provider-thread",
          forkTurns: "none",
        },
      ],
      childSessions: [
        {
          threadId: "provider-thread",
          status: "available",
          resultStatus: "completed",
          nestedSpawns: [spec],
          requestsTruncated: false,
        },
      ],
      childrenTruncated: false,
      submittedExecCalls: 0,
    },
  };
  const statuses = async (
    selectedCase: ExtensionReply["result"]["cases"][number],
    observation: unknown,
    artifacts: unknown[] = [],
  ) => {
    const reply = await command<{
      result: { checks: Array<{ id: string; status: string }> };
      error?: { message: string };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations: observation ? [observation] : [],
        artifacts,
        builtinChecks: [],
        execution: { status: "completed" },
      }),
    );
    expect(reply.code, reply.stderr).toBe(0);
    expect(reply.value.result, reply.value.error?.message).toBeDefined();
    return reply.value.result.checks
      .filter((check) => check.id.startsWith("darrow.evals.transcript."))
      .map((check) => check.status);
  };
  for (const caseId of [
    "verification-followup-clear",
    "verification-followup-no-progress",
    "verification-followup-progress",
    "verification-followup-regression",
  ]) {
    const selected = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [caseId] },
        configuration: {},
      }),
    );
    expect(selected.code, selected.stderr).toBe(0);
    const selectedCase = selected.value.result.cases[0]!;
    expect(selectedCase.requiredEvidence).toContain("sevro.codex.native-calls");
    expect(await statuses(selectedCase, native)).toEqual([
      "passed",
      "passed",
      "passed",
    ]);
    expect(
      (
        await statuses(selectedCase, {
          ...native,
          data: {
            ...native.data,
            childSessions: [
              {
                ...native.data.childSessions[0],
                nestedSpawns: [{ ...spec, readerResultStatus: "unavailable" }],
              },
            ],
          },
        })
      )[0],
    ).toBe("failed");
    expect(
      (
        await statuses(selectedCase, {
          ...native,
          data: {
            ...native.data,
            childSessions: [
              { ...native.data.childSessions[0], requestsTruncated: true },
            ],
          },
        })
      )[0],
    ).toBe("unavailable");
    if (caseId === "verification-followup-clear") {
      expect(
        (
          await statuses(selectedCase, {
            ...native,
            data: {
              ...native.data,
              calls: [
                ...native.data.calls,
                {
                  ordinal: 4,
                  namespace: "collaboration",
                  name: "spawn_agent",
                  evidence: "invocation_attempt",
                },
              ],
              toolCalls: [
                ...native.data.toolCalls,
                { ordinal: 4, namespace: "collaboration", name: "spawn_agent" },
              ],
            },
          })
        )[0],
      ).toBe("unavailable");
    }
  }
  const replacement = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["verification-replacement"] },
      configuration: {},
    }),
  );
  expect(replacement.code, replacement.stderr).toBe(0);
  const selectedCase = replacement.value.result.cases[0]!;
  const dual = {
    ...native,
    data: {
      ...native.data,
      childSessions: [
        { ...native.data.childSessions[0], nestedSpawns: [spec, standards] },
      ],
    },
  };
  expect(await statuses(selectedCase, dual, [artifact])).toEqual([
    "passed",
    "passed",
    "passed",
    "passed",
  ]);
  expect((await statuses(selectedCase, native, [artifact]))[0]).toBe("failed");
  expect(
    (
      await statuses(
        selectedCase,
        {
          ...dual,
          data: {
            ...dual.data,
            childSessions: [
              {
                ...dual.data.childSessions[0],
                nestedSpawns: [spec, { ...standards, forkTurns: "all" }],
              },
            ],
          },
        },
        [artifact],
      )
    )[0],
  ).toBe("failed");
  expect((await statuses(selectedCase, dual))[1]).toBe("unavailable");
});

test("Darrow grades a resumed conversation and its unchanged workspace boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-continuation-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/sample/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "continuation.yaml"),
    JSON.stringify({
      id: "continuation",
      invariant: "CONTINUATION-C1",
      prompt: "Wait for the next request.",
      follow_up_prompt: "Continue now.",
      fixture: {
        commits: [
          { message: "chore: init", files: { "README.md": "ready\n" } },
        ],
      },
      checks: [],
      transcript_checks: [
        {
          name: "same conversation resumed",
          expect_regex: String.raw`"type":"darrow\.eval\.follow_up_turn"`,
        },
        {
          name: "workspace unchanged before reply",
          not_regex: String.raw`"type":"darrow\.eval\.follow_up_turn"(?![^\n]*"pre_feedback_worktree_unchanged":true)[^\n]*[\s\S]*"type":"darrow\.codex_native_`,
        },
      ],
    }),
  );
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["continuation"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  expect(selectedCase.requiredEvidence).toEqual([]);
  const observation = {
    id: "sevro.codex.continuation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "same_thread_resume",
      threadId: "thread-1",
      preFollowUpWorktreeUnchanged: true,
    },
  };
  const statuses = async (observations: unknown[]) => {
    const response = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks.map((check) => check.status);
  };
  expect(await statuses([observation])).toEqual(["passed", "passed"]);
  expect(
    await statuses([
      {
        ...observation,
        data: { ...observation.data, preFollowUpWorktreeUnchanged: false },
      },
    ]),
  ).toEqual(["passed", "failed"]);
  expect(
    await statuses([
      {
        ...observation,
        completeness: "partial",
        data: { ...observation.data, preFollowUpWorktreeUnchanged: null },
      },
    ]),
  ).toEqual(["passed", "unavailable"]);
  expect(await statuses([])).toEqual(["unavailable", "unavailable"]);
  expect(await statuses([observation, observation])).toEqual([
    "unavailable",
    "unavailable",
  ]);
});

test("Darrow orders accepted owners around the native follow-up boundary", async () => {
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-readiness-iterative-resolution"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  expect(selectedCase.requiredEvidence).toContain("sevro.codex.native-calls");
  const continuation = {
    id: "sevro.codex.continuation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "same_thread_resume",
      threadId: "thread-1",
      nativeAfterOrdinal: 5,
      preFollowUpWorktreeUnchanged: true,
    },
  };
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 6,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 6, namespace: "collaboration", name: "spawn_agent" },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 6,
          startedOrdinal: 7,
          acceptedOrdinal: 8,
          agentRef: "/root/owner",
          threadId: "child-thread",
        },
      ],
      submittedExecCalls: 0,
    },
  };
  const statuses = async (observations: unknown[]) => {
    const response = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks
      .filter((check) => check.id.startsWith("darrow.evals.transcript."))
      .map((check) => check.status);
  };
  expect(await statuses([continuation, native])).toEqual([
    "passed",
    "passed",
    "unavailable",
    "passed",
  ]);
  expect(
    await statuses([
      {
        ...continuation,
        data: { ...continuation.data, nativeAfterOrdinal: 9 },
      },
      native,
    ]),
  ).toEqual(["failed", "failed", "unavailable", "passed"]);
  expect(
    await statuses([
      {
        ...continuation,
        data: { ...continuation.data, nativeAfterOrdinal: null },
      },
      native,
    ]),
  ).toEqual(["unavailable", "unavailable", "unavailable", "passed"]);
  expect(await statuses([continuation])).toEqual([
    "unavailable",
    "unavailable",
    "unavailable",
    "unavailable",
  ]);
  const updateGoal = {
    ordinal: 9,
    namespace: "functions",
    name: "update_goal",
    evidence: "invocation_attempt",
  };
  expect(
    (
      await statuses([
        continuation,
        {
          ...native,
          data: {
            ...native.data,
            calls: [...native.data.calls, updateGoal],
            toolCalls: [...native.data.toolCalls, updateGoal],
          },
        },
      ])
    ).at(-1),
  ).toBe("failed");
});

test("Darrow grades readiness skill reads on their actual turn", async () => {
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-readiness-prior-assessed-omitted"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  expect(selectedCase.requiredEvidence).toContain(
    "sevro.codex.initial-skill-reads",
  );
  expect(selectedCase.requiredEvidence).toContain(
    "sevro.codex.follow-up-skill-reads",
  );
  const initial = {
    id: "sevro.codex.initial-skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: "assess-implementation-readiness",
      observedSkills: ["assess-implementation-readiness"],
    },
  };
  const followUp = {
    id: "sevro.codex.follow-up-skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: null,
      observedSkills: [],
    },
  };
  const statuses = async (observations: unknown[]) => {
    const response = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks
      .filter((check) =>
        ["darrow.evals.transcript.1", "darrow.evals.transcript.2"].includes(
          check.id,
        ),
      )
      .map((check) => check.status);
  };
  expect(await statuses([initial, followUp])).toEqual(["passed", "passed"]);
  expect(
    await statuses([
      {
        ...initial,
        data: { ...initial.data, primarySkill: null, observedSkills: [] },
      },
      followUp,
    ]),
  ).toEqual(["failed", "passed"]);
  expect(
    await statuses([
      initial,
      {
        ...followUp,
        data: {
          ...followUp.data,
          primarySkill: "assess-implementation-readiness",
          observedSkills: ["assess-implementation-readiness"],
        },
      },
    ]),
  ).toEqual(["passed", "failed"]);
  expect(
    await statuses([initial, { ...followUp, completeness: "partial" }]),
  ).toEqual(["passed", "unavailable"]);
});

test("Darrow rejects a recipe read or Skill call in the follow-up turn", async () => {
  const source = parseYaml(
    await readFile(
      join(
        projectRoot,
        "plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/feedback-relay.yaml",
      ),
      "utf8",
    ),
  ) as { transcript_checks: Array<{ not_regex?: string }> };
  const pattern = source.transcript_checks[4]?.not_regex;
  expect(pattern).toBeTruthy();
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-turn-skill-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/sample/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "turn-skill.yaml"),
    JSON.stringify({
      id: "turn-skill",
      invariant: "TURN-SKILL-C1",
      prompt: "Wait for feedback.",
      follow_up_prompt: "Continue after feedback.",
      fixture: {
        commits: [
          { message: "chore: init", files: { "README.md": "ready\n" } },
        ],
      },
      checks: [],
      transcript_checks: [
        { name: "recipe is not read again", not_regex: pattern },
      ],
    }),
  );
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["turn-skill"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  const followUp = {
    id: "sevro.codex.follow-up-skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: null,
      observedSkills: [],
    },
  };
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const continuation = {
    id: "sevro.codex.continuation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "same_thread_resume",
      threadId: "thread-1",
      nativeAfterOrdinal: 5,
      preFollowUpWorktreeUnchanged: true,
    },
  };
  const status = async (observations: unknown[]) => {
    const response = await command<{
      result: { checks: Array<{ status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks[0]?.status;
  };
  expect(await status([followUp, native, continuation])).toBe("passed");
  expect(
    await status([
      {
        ...followUp,
        data: {
          ...followUp.data,
          primarySkill: "ticket-to-pr",
          observedSkills: ["ticket-to-pr"],
        },
      },
      native,
      continuation,
    ]),
  ).toBe("failed");
  expect(
    await status([
      followUp,
      {
        ...native,
        data: {
          ...native.data,
          toolCalls: [{ ordinal: 6, namespace: "other", name: "Skill" }],
        },
      },
      continuation,
    ]),
  ).toBe("failed");
  expect(
    await status([
      followUp,
      {
        ...native,
        data: {
          ...native.data,
          toolCalls: [{ ordinal: 4, namespace: "other", name: "Skill" }],
        },
      },
      continuation,
    ]),
  ).toBe("passed");
  expect(
    await status([
      followUp,
      native,
      {
        ...continuation,
        data: { ...continuation.data, nativeAfterOrdinal: null },
      },
    ]),
  ).toBe("unavailable");
});

test("Darrow grades same-owner feedback across the turn boundary", async () => {
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-cross-turn-feedback-answer"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  expect(selectedCase.requiredEvidence).toContain(
    "sevro.codex.follow-up-events",
  );
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-cross-turn-"));
  roots.push(root);
  const artifact = async (name: string, content: string) => {
    const path = join(root, name);
    await writeFile(path, content);
    return {
      id: "sevro.codex.follow-up-events",
      path: pathToFileURL(path).href,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  };
  const clean = await artifact("clean.jsonl", "turn.completed\n");
  const preflight = await artifact(
    "preflight.jsonl",
    "adaptive-delivery-preflight step\n",
  );
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 1,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
        {
          ordinal: 6,
          namespace: "collaboration",
          name: "followup_task",
          target: "owner",
        },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 1,
          startedOrdinal: 2,
          acceptedOrdinal: 3,
          agentRef: "/root/owner",
          threadId: "child-thread",
        },
      ],
      feedbackCalls: [
        {
          ordinal: 6,
          tool: "followup_task",
          target: "owner",
          responseObserved: false,
        },
      ],
      submittedExecCalls: 0,
    },
  };
  const continuation = {
    id: "sevro.codex.continuation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "same_thread_resume",
      threadId: "thread-1",
      nativeAfterOrdinal: 5,
      preFollowUpWorktreeUnchanged: true,
    },
  };
  const statuses = async (
    observations: unknown[],
    artifacts: unknown[] = [clean],
  ) => {
    const response = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
        artifacts,
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks
      .filter((check) => check.id.startsWith("darrow.evals.transcript."))
      .map((check) => check.status);
  };
  expect(await statuses([native, continuation])).toEqual([
    "passed",
    "passed",
    "passed",
    "passed",
  ]);
  expect(
    await statuses([
      native,
      {
        ...continuation,
        data: { ...continuation.data, preFollowUpWorktreeUnchanged: false },
      },
    ]),
  ).toEqual(["failed", "passed", "passed", "passed"]);
  expect(
    (
      await statuses([
        native,
        {
          ...continuation,
          data: { ...continuation.data, nativeAfterOrdinal: 0 },
        },
      ])
    )[1],
  ).toBe("failed");
  expect(
    (
      await statuses([
        {
          ...native,
          data: {
            ...native.data,
            toolCalls: native.data.toolCalls.map((call) =>
              call.name === "followup_task"
                ? { ...call, target: "other" }
                : call,
            ),
            feedbackCalls: [
              { ...native.data.feedbackCalls[0], target: "other" },
            ],
          },
        },
        continuation,
      ])
    )[2],
  ).toBe("failed");
  const replacement = {
    ordinal: 7,
    namespace: "collaboration",
    name: "spawn_agent",
  };
  expect(
    (
      await statuses([
        {
          ...native,
          data: {
            ...native.data,
            calls: [
              ...native.data.calls,
              { ...replacement, evidence: "invocation_attempt" },
            ],
            toolCalls: [...native.data.toolCalls, replacement],
          },
        },
        continuation,
      ])
    )[3],
  ).toBe("failed");
  const newGoal = {
    ordinal: 7,
    namespace: "functions",
    name: "create_goal",
  };
  expect(
    (
      await statuses([
        {
          ...native,
          data: {
            ...native.data,
            calls: [
              ...native.data.calls,
              { ...newGoal, evidence: "invocation_attempt" },
            ],
            toolCalls: [...native.data.toolCalls, newGoal],
          },
        },
        continuation,
      ])
    )[3],
  ).toBe("failed");
  expect((await statuses([native, continuation], [preflight]))[3]).toBe(
    "failed",
  );
  expect((await statuses([native, continuation], []))[3]).toBe("unavailable");
  expect(
    (
      await statuses(
        [native, continuation],
        [{ ...clean, sha256: "0".repeat(64) }],
      )
    )[3],
  ).toBe("unavailable");
});

test("Darrow binds readiness reads to the parent before owner launch", async () => {
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-readiness-artifact-selected"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  expect(selectedCase.requiredEvidence).toContain("sevro.codex.native-calls");
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-pre-owner-"));
  roots.push(root);
  const path = join(root, "events.jsonl");
  const content = "turn.completed\n";
  await writeFile(path, content);
  const artifact = {
    id: "sevro.codex.events",
    path: pathToFileURL(path).href,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 4,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 4, namespace: "collaboration", name: "spawn_agent" },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 4,
          startedOrdinal: 5,
          acceptedOrdinal: 6,
          agentRef: "/root/owner",
          threadId: "child-thread",
        },
      ],
      parentReadDiagnostics: {
        completeness: "complete",
        observedSkills: ["assess-implementation-readiness"],
        completedReads: [
          { skill: "assess-implementation-readiness", ordinal: 2 },
        ],
        commandExecutions: 1,
        readAttempts: 1,
        truncated: false,
      },
      submittedExecCalls: 0,
    },
  };
  const statuses = async (observations: unknown[], artifacts = [artifact]) => {
    const response = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
        artifacts,
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks
      .filter((check) => check.id.startsWith("darrow.evals.transcript."))
      .map((check) => check.status);
  };
  expect(await statuses([native])).toEqual(["passed", "passed"]);
  expect(
    (
      await statuses([
        {
          ...native,
          data: {
            ...native.data,
            parentReadDiagnostics: {
              ...native.data.parentReadDiagnostics,
              completedReads: [
                { skill: "assess-implementation-readiness", ordinal: 7 },
              ],
            },
          },
        },
      ])
    )[0],
  ).toBe("failed");
  expect(
    (
      await statuses([
        {
          ...native,
          data: { ...native.data, parentReadDiagnostics: undefined },
        },
      ])
    )[0],
  ).toBe("unavailable");
  expect((await statuses([native], []))[1]).toBe("unavailable");
});

test("Darrow grades one readiness read and no owner on a non-ready result", async () => {
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-readiness-nonready-stops"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-nonready-"));
  roots.push(root);
  const artifact = async (name: string, content: string) => {
    const path = join(root, name);
    await writeFile(path, content);
    return {
      id: "sevro.codex.events",
      path: pathToFileURL(path).href,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  };
  const clean = await artifact("clean.jsonl", "turn.completed\n");
  const ledger = await artifact("ledger.jsonl", "darrow-native-goal-report\n");
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
      parentReadDiagnostics: {
        completeness: "complete",
        observedSkills: ["assess-implementation-readiness"],
        completedReads: [
          { skill: "assess-implementation-readiness", ordinal: 2 },
        ],
        commandExecutions: 1,
        readAttempts: 1,
        truncated: false,
      },
    },
  };
  const statuses = async (
    observations: unknown[],
    artifacts: unknown[] = [clean],
  ) => {
    const response = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
        artifacts,
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks
      .filter((check) => check.id.startsWith("darrow.evals.transcript."))
      .map((check) => check.status);
  };
  expect(await statuses([native])).toEqual([
    "passed",
    "passed",
    "passed",
    "passed",
  ]);
  expect(
    await statuses([
      {
        ...native,
        data: {
          ...native.data,
          parentReadDiagnostics: {
            ...native.data.parentReadDiagnostics,
            completedReads: [
              { skill: "assess-implementation-readiness", ordinal: 2 },
              { skill: "assess-implementation-readiness", ordinal: 3 },
            ],
            commandExecutions: 2,
            readAttempts: 2,
          },
        },
      },
    ]),
  ).toEqual(["passed", "failed", "passed", "passed"]);
  expect(
    await statuses([
      {
        ...native,
        data: {
          ...native.data,
          parentReadDiagnostics: {
            ...native.data.parentReadDiagnostics,
            observedSkills: [],
            completedReads: [],
            commandExecutions: 0,
            readAttempts: 0,
          },
        },
      },
    ]),
  ).toEqual(["failed", "passed", "passed", "passed"]);
  expect(
    (
      await statuses([
        {
          ...native,
          data: {
            ...native.data,
            calls: [
              {
                ordinal: 4,
                namespace: "collaboration",
                name: "spawn_agent",
                evidence: "invocation_attempt",
              },
            ],
            toolCalls: [
              { ordinal: 4, namespace: "collaboration", name: "spawn_agent" },
            ],
          },
        },
      ])
    )[2],
  ).toBe("failed");
  expect((await statuses([native], [ledger]))[3]).toBe("failed");
  expect(
    (
      await statuses([
        {
          ...native,
          data: { ...native.data, parentReadDiagnostics: undefined },
        },
      ])
    ).slice(0, 2),
  ).toEqual(["unavailable", "unavailable"]);
  expect((await statuses([native], []))[3]).toBe("unavailable");
});

test("Darrow grades feedback to the prior owner after a real follow-up", async () => {
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 1,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
        {
          ordinal: 6,
          namespace: "collaboration",
          name: "followup_task",
          target: "owner",
        },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 1,
          startedOrdinal: 2,
          acceptedOrdinal: 3,
          agentRef: "/root/owner",
          threadId: "child-thread",
        },
      ],
      feedbackCalls: [
        {
          ordinal: 6,
          tool: "followup_task",
          target: "owner",
          responseObserved: true,
        },
      ],
      submittedExecCalls: 0,
    },
  };
  const continuation = {
    id: "sevro.codex.continuation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "same_thread_resume",
      threadId: "thread-1",
      nativeAfterOrdinal: 5,
      preFollowUpWorktreeUnchanged: true,
    },
  };
  for (const [caseId, checkId, responseRequired] of [
    ["goal-steering-without-question", "darrow.evals.transcript.3", false],
    ["ticket-to-pr-feedback-rejected", "darrow.evals.transcript.2", true],
  ] as const) {
    const selected = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(projectRoot).href,
        selectors: { caseIds: [caseId] },
        configuration: {},
      }),
    );
    expect(selected.code, selected.stderr).toBe(0);
    const selectedCase = selected.value.result.cases[0]!;
    expect(selectedCase.requiredEvidence).toContain("sevro.codex.native-calls");
    const status = async (observations: unknown[]) => {
      const response = await command<{
        result: { checks: Array<{ id: string; status: string }> };
      }>(
        [process.execPath, extension],
        request("evaluate", {
          extensionData: selectedCase.extensionData,
          observations,
        }),
      );
      expect(response.code, response.stderr).toBe(0);
      return response.value.result.checks.find((check) => check.id === checkId)
        ?.status;
    };
    expect(await status([native, continuation])).toBe("passed");
    expect(
      await status([
        native,
        {
          ...continuation,
          data: { ...continuation.data, nativeAfterOrdinal: 7 },
        },
      ]),
    ).toBe("failed");
    expect(
      await status([
        {
          ...native,
          data: {
            ...native.data,
            toolCalls: [
              native.data.toolCalls[0],
              { ...native.data.toolCalls[1], target: "other" },
            ],
            feedbackCalls: [
              { ...native.data.feedbackCalls[0], target: "other" },
            ],
          },
        },
        continuation,
      ]),
    ).toBe("failed");
    expect(
      await status([
        {
          ...native,
          data: {
            ...native.data,
            feedbackCalls: [
              { ...native.data.feedbackCalls[0], responseObserved: false },
            ],
          },
        },
        continuation,
      ]),
    ).toBe(responseRequired ? "failed" : "passed");
    expect(
      await status([
        { ...native, data: { ...native.data, feedbackCalls: [] } },
        continuation,
      ]),
    ).toBe("unavailable");
  }
});

test("Darrow grades the ticket feedback relay without retaining message text", async () => {
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["ticket-to-pr-feedback-relay"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 1,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
        {
          ordinal: 6,
          namespace: "collaboration",
          name: "followup_task",
          target: "owner",
        },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 1,
          startedOrdinal: 2,
          acceptedOrdinal: 3,
          agentRef: "/root/owner",
          threadId: "child-thread",
        },
      ],
      feedbackCalls: [
        {
          ordinal: 6,
          tool: "followup_task",
          target: "owner",
          responseObserved: true,
          messageRepresentation: "plaintext",
          messageMatchesFollowUpPrompt: true,
        },
      ],
      submittedExecCalls: 0,
    },
  };
  const continuation = {
    id: "sevro.codex.continuation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "same_thread_resume",
      threadId: "thread-1",
      nativeAfterOrdinal: 5,
      preFollowUpWorktreeUnchanged: true,
    },
  };
  const followUp = {
    id: "sevro.codex.follow-up-skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: null,
      observedSkills: [],
    },
  };
  const statuses = async (observations: unknown[]) => {
    const response = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks
      .filter((check) => check.id.startsWith("darrow.evals.transcript."))
      .map((check) => check.status);
  };
  expect(await statuses([native, continuation, followUp])).toEqual([
    "passed",
    "passed",
    "passed",
    "passed",
    "passed",
  ]);
  expect(
    (
      await statuses([
        {
          ...native,
          data: {
            ...native.data,
            feedbackCalls: [
              {
                ...native.data.feedbackCalls[0],
                messageMatchesFollowUpPrompt: false,
              },
            ],
          },
        },
        continuation,
        followUp,
      ])
    )[0],
  ).toBe("failed");
  expect(
    (
      await statuses([
        {
          ...native,
          data: {
            ...native.data,
            feedbackCalls: [
              {
                ...native.data.feedbackCalls[0],
                messageRepresentation: "encrypted",
                messageMatchesFollowUpPrompt: null,
              },
            ],
          },
        },
        continuation,
        followUp,
      ])
    )[0],
  ).toBe("passed");
  const replacement = {
    ordinal: 7,
    namespace: "collaboration",
    name: "spawn_agent",
    evidence: "invocation_attempt",
  };
  expect(
    (
      await statuses([
        {
          ...native,
          data: {
            ...native.data,
            calls: [...native.data.calls, replacement],
            toolCalls: [...native.data.toolCalls, replacement],
            acceptedSpawns: [
              ...native.data.acceptedSpawns,
              {
                requestedOrdinal: 7,
                startedOrdinal: 8,
                acceptedOrdinal: 9,
                agentRef: "/root/replacement",
                threadId: "replacement-thread",
              },
            ],
          },
        },
        continuation,
        followUp,
      ])
    )[3],
  ).toBe("failed");
});

test("Darrow ledger checks require intact events and complete goal-control evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-ledger-"));
  roots.push(root);
  const selected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-authorized-publication"] },
      configuration: {},
    }),
  );
  expect(selected.code, selected.stderr).toBe(0);
  const selectedCase = selected.value.result.cases[0]!;
  const native = {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [],
      toolCalls: [],
      acceptedSpawns: [],
      submittedExecCalls: 0,
    },
  };
  const artifact = async (name: string, content: string) => {
    const path = join(root, name);
    await writeFile(path, content);
    return {
      id: "sevro.codex.events",
      path: pathToFileURL(path).href,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  };
  const clean = await artifact("clean.jsonl", "turn.completed\n");
  const ledger = await artifact("ledger.jsonl", "Protocol ledger\n");
  const status = async (observations: unknown[], artifacts: unknown[]) => {
    const response = await command<{
      result: {
        checks: Array<{ id: string; status: string; evidenceRefs: string[] }>;
      };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: selectedCase.extensionData,
        observations,
        artifacts,
      }),
    );
    expect(response.code, JSON.stringify(response.value)).toBe(0);
    return response.value.result.checks.find(
      (check) => check.id === "darrow.evals.transcript.1",
    );
  };
  expect(await status([native], [clean])).toMatchObject({
    status: "passed",
    evidenceRefs: ["sevro.codex.events", "sevro.codex.native-calls"],
  });
  expect((await status([native], [ledger]))?.status).toBe("failed");
  const goal = {
    ...native,
    data: {
      ...native.data,
      calls: [
        {
          ordinal: 1,
          namespace: "functions",
          name: "create_goal",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [{ ordinal: 1, namespace: "functions", name: "create_goal" }],
    },
  };
  expect((await status([goal], [clean]))?.status).toBe("failed");
  expect((await status([native], []))?.status).toBe("unavailable");
  expect(
    (await status([native], [{ ...clean, sha256: "0".repeat(64) }]))?.status,
  ).toBe("unavailable");
  expect(
    (await status([{ ...native, completeness: "partial" }], [clean]))?.status,
  ).toBe("unavailable");
  const narrower = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-verification-existing-review"] },
      configuration: {},
    }),
  );
  expect(narrower.code, narrower.stderr).toBe(0);
  const alternative = await command<{
    result: { checks: Array<{ id: string; status: string }> };
  }>(
    [process.execPath, extension],
    request("evaluate", {
      extensionData: narrower.value.result.cases[0]!.extensionData,
      observations: [native],
      artifacts: [ledger],
    }),
  );
  expect(alternative.code, JSON.stringify(alternative.value)).toBe(0);
  expect(
    alternative.value.result.checks.find(
      (check) => check.id === "darrow.evals.transcript.1",
    )?.status,
  ).toBe("passed");
  const decision = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-preflight-decision-gated"] },
      configuration: {},
    }),
  );
  expect(decision.code, decision.stderr).toBe(0);
  const decisionData = decision.value.result.cases[0]!.extensionData;
  const secondStatus = async (observations: unknown[], event: unknown) => {
    const response = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        extensionData: decisionData,
        observations,
        artifacts: [event],
      }),
    );
    expect(response.code, response.stderr).toBe(0);
    return response.value.result.checks.find(
      (check) => check.id === "darrow.evals.transcript.2",
    )?.status;
  };
  expect(await secondStatus([native], clean)).toBe("passed");
  expect(
    await secondStatus(
      [native],
      await artifact("native-report.jsonl", "darrow-native-goal-report\n"),
    ),
  ).toBe("failed");
  expect(await secondStatus([goal], clean)).toBe("passed");
});

test("Sevro grades no-agent evidence through the public CLI", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-no-agent-"));
  roots.push(root);
  const skill = join(root, "plugins/capability/example/skills/probe");
  await mkdir(join(skill, "evals"), { recursive: true });
  await writeFile(
    join(skill, "SKILL.md"),
    "---\nname: probe\ndescription: Return ready.\n---\n\nReturn ready.\n",
  );
  await writeFile(
    join(skill, "evals/no-agent.yaml"),
    JSON.stringify({
      id: "no-agent-probe",
      invariant: "EXAMPLE-C1",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: init", files: { "README.md": "ready\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "response", expect_exact: "ready" }],
      transcript_checks: [
        {
          name: "advice launches no agent",
          not_regex:
            '"tool":"spawn_agent"|"type":"darrow.codex_native_spawn"|"type":"darrow.goal_agent_completion"',
        },
        {
          name: "no lifecycle ledger or nested goal is used",
          not_regex:
            'adaptive-delivery-preflight step|Protocol ledger|"tool":"create_goal"',
        },
      ],
    }),
  );
  const commandFile = join(root, "extension-command.json");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
  id: "sevro.host.codex", model: "synthetic", effort: "none",
  hostCapabilities: ["sevro.codex.native-calls"],
  async run() {
    return { finalMessage: "ready", complete: true,
      artifacts: [{ id: "sevro.codex.events", bytes: Buffer.from("turn.completed\\n") }],
      observations: [{ id: "sevro.codex.native-calls", completeness: "complete",
        data: { method: "native_session", calls: [], toolCalls: [], acceptedSpawns: [], submittedExecCalls: 0 } }] };
  },
};\n`,
  );
  const route = sevroCommand();
  const run = await command<CliReply>([
    ...route.launch,
    "run",
    "--json",
    ...route.extraArgs,
    "--extension-command-file",
    commandFile,
    "--extension-source-file",
    extension,
    "--case-id",
    "no-agent-probe",
    "--project-root",
    root,
    "--adapter-module",
    adapter,
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
    "--results-root",
    join(root, "results"),
  ]);
  const evidence = JSON.parse(await readFile(run.value.evidencePath, "utf8"));
  expect(
    run.code,
    `${run.stderr}\n${JSON.stringify(evidence.diagnostic)}`,
  ).toBe(0);
  expect(run.value.task.verdict).toBe("passed");
  expect(
    run.value.cases[0]!.trials[0]!.checks.find(
      (check) => check.id === "darrow.evals.transcript.1",
    ),
  ).toMatchObject({
    id: "darrow.evals.transcript.1",
    grader: "darrow.evals.transcript",
    status: "passed",
    detail: "Graded from complete native agent-spawn observations",
    evidenceRefs: ["sevro.codex.native-calls"],
  });
  expect(
    run.value.cases[0]!.trials[0]!.checks.find(
      (check) => check.id === "darrow.evals.transcript.2",
    ),
  ).toMatchObject({
    status: "passed",
    evidenceRefs: ["sevro.codex.events", "sevro.codex.native-calls"],
  });
});

test("Sevro grades an existing Darrow ownership case through its public CLI", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-ownership-"));
  roots.push(root);
  const commandFile = join(root, "extension-command.json");
  const adapter = join(root, "candidate.ts");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  await writeFile(
    adapter,
    `export default {
  id: "sevro.host.codex", model: "synthetic-v1", effort: "none",
  hostCapabilities: ["sevro.codex.native-calls"],
  async run() {
    return {
      finalMessage: "format: darrow-adaptive-delivery-authority-stop-v1\\nstatus: invocation_required\\nreason: explicit-orchestration-entrypoint-required",
      complete: true,
      observations: [{
        id: "sevro.codex.native-calls", completeness: "complete",
        data: { method: "native_session", calls: [], toolCalls: [], acceptedSpawns: [], submittedExecCalls: 0 },
      }],
    };
  },
};
`,
  );
  const route = sevroCommand();
  const run = await command<CliReply>([
    ...route.launch,
    "run",
    "--json",
    ...route.extraArgs,
    "--extension-command-file",
    commandFile,
    "--extension-source-file",
    extension,
    "--case-id",
    "goal-preflight-authority-stop-non-orchestration-parent",
    "--project-root",
    projectRoot,
    "--adapter-module",
    adapter,
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
    "--shell-isolation",
    "--results-root",
    join(root, "results"),
  ]);
  expect(run.code, run.stderr).toBe(0);
  expect(run.value.task.verdict).toBe("passed");
  expect(
    run.value.cases[0]!.trials[0]!.checks.filter((check) =>
      check.id.startsWith("darrow.evals.ownership."),
    ).map((check) => check.status),
  ).toEqual(["passed", "passed", "passed"]);
});

test("Claude readiness stop uses complete native calls and intact events", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-claude-readiness-"));
  roots.push(root);
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["claude-readiness-nonready-stops"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  expect(selected.requiredEvidence).toEqual([
    "sevro.claude.tool-calls",
    "sevro.claude.events",
  ]);
  const observations = [
    {
      id: "sevro.claude.tool-calls",
      source: "sevro.host.claude",
      completeness: "complete",
      data: {
        method: "stream_tool_calls",
        truncated: false,
        calls: [
          {
            ordinal: 1,
            actor: "parent",
            name: "Skill",
            skill: "assess-implementation-readiness",
            invocation: "darrow-readiness-gate:assess-implementation-readiness",
          },
        ],
      },
    },
    {
      id: "sevro.observation.final-message",
      source: "sevro.host.claude",
      completeness: "complete",
      data: { text: "Readiness needs a decision." },
    },
  ];
  const artifact = async (name: string, content: string) => {
    const path = join(root, name);
    await writeFile(path, content);
    return {
      id: "sevro.claude.events",
      path: pathToFileURL(path).href,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  };
  const clean = await artifact("clean.jsonl", '{"type":"result"}\n');
  const evaluate = (calls: unknown[], events: unknown[]) =>
    command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        observations: calls,
        artifacts: events,
        extensionData: selected.extensionData,
      }),
    );
  const passed = await evaluate(observations, [clean]);
  expect(passed.value.result.checks.map((check) => check.status)).toEqual(
    Array(7).fill("passed"),
  );
  const repeated = await evaluate(
    [
      {
        ...observations[0],
        data: {
          ...observations[0]!.data,
          calls: [
            ...observations[0]!.data!.calls!,
            { ...observations[0]!.data!.calls![0]!, ordinal: 2 },
          ],
        },
      },
      observations[1],
    ],
    [clean],
  );
  expect(repeated.value.result.checks[4]!.status).toBe("failed");
  const partial = await evaluate(
    [{ ...observations[0], completeness: "partial" }, observations[1]],
    [clean],
  );
  expect(partial.value.result.checks[3]!.status).toBe("unavailable");
  const missingEvents = await evaluate(observations, []);
  expect(missingEvents.value.result.checks[6]!.status).toBe("unavailable");
  const ledger = await artifact(
    "ledger.jsonl",
    "adaptive-delivery-preflight step\n",
  );
  const forbidden = await evaluate(observations, [ledger]);
  expect(forbidden.value.result.checks[6]!.status).toBe("failed");
});

test("Claude selected owner binds route, review, and parent handoff", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-claude-owner-"));
  roots.push(root);
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["goal-review-high-selected-claude"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  expect(selected.requiredEvidence).toEqual([
    "sevro.claude.tool-calls",
    "sevro.claude.events",
    "sevro.claude.nested-skills",
  ]);
  const ownerId = "tool-owner";
  const prepared = await command<{
    result: { claudePluginDirs: { artifactRoots: string[] } };
    error?: { message: string };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: selected,
      host: {
        id: "sevro.host.claude",
        capabilities: [
          "sevro.claude.tool-calls",
          "sevro.claude.plugin-dirs",
          "sevro.claude.explicit-invocation",
        ],
      },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.value.error).toBeUndefined();
  expect(prepared.value.result.claudePluginDirs.artifactRoots).toHaveLength(2);
  const marker = createHash("sha256")
    .update("- phase: adaptive-delivery-owner")
    .digest("hex");
  const calls = [
    {
      ordinal: 2,
      actor: "parent",
      parentToolUseId: null,
      name: "Agent",
      toolUseId: ownerId,
      subagentType: "darrow-adaptive-delivery:adaptive-delivery-sonnet-5-low",
      runInBackground: false,
      model: null,
      promptSha256: marker,
      promptFirstLineSha256: marker,
    },
    {
      ordinal: 3,
      actor: "nested",
      parentToolUseId: ownerId,
      name: "Skill",
      skill: "independent-code-review",
      invocation: "independent-code-review",
    },
  ];
  const observations = (
    selectedCalls: unknown[],
    includeNested = true,
    nestedAncestor = ownerId,
  ) => [
    {
      id: "sevro.claude.tool-calls",
      source: "sevro.host.claude",
      completeness: "complete",
      data: {
        method: "stream_tool_calls",
        truncated: false,
        calls: selectedCalls,
      },
    },
    {
      id: "sevro.observation.final-message",
      source: "sevro.host.claude",
      completeness: "complete",
      data: { text: "Status: complete" },
    },
    ...(includeNested
      ? [
          {
            id: "sevro.claude.nested-skills",
            source: "sevro.host.claude",
            completeness: "complete",
            data: {
              method: "native_session_graph",
              calls: [
                {
                  ancestorToolUseId: nestedAncestor,
                  skill: "independent-code-review",
                  invocation: "independent-code-review",
                },
              ],
            },
          },
        ]
      : []),
  ];
  const event = (type: string, content: unknown[], parent?: string) => ({
    type,
    ...(parent ? { parent_tool_use_id: parent } : {}),
    message: { content },
  });
  const route = {
    type: "tool_use",
    name: "Bash",
    id: "tool-route",
    input: {
      command:
        'cd "/tmp/fixture" && uv run --quiet --no-project "/tmp/fixture/.sevro-marketplace/plugin/backend/scripts/run_locked.py" claude-agent-route --provider anthropic --model claude-sonnet-5 --effort low 2>&1',
    },
  };
  const routeResult = {
    type: "tool_result",
    tool_use_id: "tool-route",
    content: [
      {
        type: "text",
        text:
          "format\tdarrow-claude-agent-route-v1\n" +
          "selected_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\n" +
          "subagent_type\tdarrow-adaptive-delivery:adaptive-delivery-sonnet-5-low\n" +
          "agent_file\t/tmp/darrow-adaptive-delivery/agents/adaptive-delivery-sonnet-5-low.md\n",
      },
    ],
  };
  const events = [
    event("assistant", [route]),
    event("user", [routeResult]),
    event("assistant", [
      {
        type: "tool_use",
        name: "Agent",
        id: ownerId,
        input: {
          subagent_type:
            "darrow-adaptive-delivery:adaptive-delivery-sonnet-5-low",
          run_in_background: false,
          prompt: "- phase: adaptive-delivery-owner\nDo the task",
        },
      },
    ]),
    event(
      "assistant",
      [
        {
          type: "tool_use",
          name: "Skill",
          input: { skill: "independent-code-review" },
        },
      ],
      ownerId,
    ),
    event("user", [
      { type: "tool_result", tool_use_id: ownerId, content: "done" },
    ]),
    { type: "result" },
  ];
  const artifact = async (name: string, selectedEvents: unknown[]) => {
    const content =
      selectedEvents.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    const path = join(root, name);
    await writeFile(path, content);
    return {
      id: "sevro.claude.events",
      path: pathToFileURL(path).href,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  };
  const evaluate = (
    selectedCalls: unknown[],
    selectedArtifacts: unknown[],
    includeNested = true,
    nestedAncestor = ownerId,
  ) =>
    command<{ result: { checks: Array<{ status: string }> } }>(
      [process.execPath, extension],
      request("evaluate", {
        observations: observations(
          selectedCalls,
          includeNested,
          nestedAncestor,
        ),
        artifacts: selectedArtifacts,
        extensionData: selected.extensionData,
      }),
    );
  const clean = await artifact("clean.jsonl", events);
  const passed = await evaluate(calls, [clean]);
  expect(passed.code, passed.stderr).toBe(0);
  expect(passed.value.result.checks.map((check) => check.status)).toEqual(
    Array(8).fill("passed"),
  );
  const recovered = await evaluate([calls[0]], [clean]);
  expect(recovered.value.result.checks[5]).toMatchObject({
    status: "passed",
    evidenceRefs: ["sevro.claude.nested-skills"],
  });
  const missingNested = await evaluate([calls[0]], [clean], false);
  expect(missingNested.value.result.checks[5]!.status).toBe("unavailable");
  const wrongMarker = await evaluate(
    [{ ...calls[0], promptFirstLineSha256: "0".repeat(64) }, calls[1]],
    [clean],
  );
  expect(wrongMarker.value.result.checks[3]!.status).toBe("failed");
  const unboundReview = await evaluate(
    [calls[0], { ...calls[1], parentToolUseId: "other-agent" }],
    [clean],
    true,
    "other-agent",
  );
  expect(unboundReview.value.result.checks[5]!.status).toBe("failed");
  const lateParent = await artifact("late.jsonl", [
    ...events,
    event("assistant", [{ type: "tool_use", name: "Bash", id: "late" }]),
  ]);
  const late = await evaluate(calls, [lateParent]);
  expect(late.value.result.checks[1]!.status).toBe("failed");
  const missing = await evaluate(calls, []);
  expect(missing.value.result.checks[1]!.status).toBe("unavailable");
  expect(missing.value.result.checks[6]!.status).toBe("unavailable");
  const badRoute = await artifact("bad-route.jsonl", [
    events[0],
    event("user", [{ ...routeResult, is_error: true }]),
    ...events.slice(2),
  ]);
  const rejected = await evaluate(calls, [badRoute]);
  expect(rejected.value.result.checks[6]!.status).toBe("failed");
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
          metric: "escaped_defect",
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
          metric: "defect_detection",
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
  const unavailable = await command<{
    result: { metrics: Array<{ id: string; value: number | null }> };
  }>(
    [process.execPath, extension],
    request("evaluate", {
      caseId: "stdout-case",
      execution: { status: "completed" },
      observations: [],
      builtinChecks: [
        { id: "darrow.shell.1", status: "unavailable", evidenceRefs: [] },
        { id: "darrow.output.1", status: "passed", evidenceRefs: [] },
      ],
      artifacts: [],
      extensionData: resolved.value.result.cases[0]!.extensionData,
      configuration: {},
    }),
  );
  expect(unavailable.code).toBe(0);
  expect(unavailable.value.result.metrics).toMatchObject([
    { id: "darrow.evals.metric.escaped-defect", value: null },
    { id: "darrow.evals.metric.defect-detection", value: 1 },
  ]);
  const failedExecution = await command<{
    result: { metrics: Array<{ value: number | null }> };
  }>(
    [process.execPath, extension],
    request("evaluate", {
      caseId: "stdout-case",
      execution: { status: "failed" },
      observations: [],
      builtinChecks: [
        { id: "darrow.shell.1", status: "passed", evidenceRefs: [] },
        { id: "darrow.output.1", status: "passed", evidenceRefs: [] },
      ],
      artifacts: [],
      extensionData: resolved.value.result.cases[0]!.extensionData,
      configuration: {},
    }),
  );
  expect(
    failedExecution.value.result.metrics.map((metric) => metric.value),
  ).toEqual([null, null]);

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
  const passedEvidence = JSON.parse(
    await readFile(passed.value.evidencePath, "utf8"),
  );
  expect(passedEvidence.trials[0].metrics).toEqual([
    { id: "darrow.evals.metric.escaped-defect", value: 0, unit: "count" },
    { id: "darrow.evals.metric.defect-detection", value: 1, unit: "ratio" },
  ]);
  const failed = await invoke("wait");
  expect(failed.code, failed.stderr).toBe(1);
  expect(
    failed.value.cases[0]!.trials[0]!.checks.map((check) => check.status),
  ).toEqual(["passed", "failed"]);
  const failedEvidence = JSON.parse(
    await readFile(failed.value.evidencePath, "utf8"),
  );
  expect(failedEvidence.trials[0].metrics).toEqual([
    { id: "darrow.evals.metric.escaped-defect", value: 0, unit: "count" },
    { id: "darrow.evals.metric.defect-detection", value: 0, unit: "ratio" },
  ]);
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
        {
          name: "readiness",
          proposition: "The response promises readiness.",
          metric: "false_positive",
        },
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
  const passedEvidence = JSON.parse(
    await readFile(passed.value.evidencePath, "utf8"),
  );
  expect(passedEvidence.trials[0].metrics).toEqual([
    { id: "darrow.evals.metric.false-positive", value: 0, unit: "count" },
  ]);
  const failed = await invoke("The change needs work.");
  expect(failed.code, failed.stderr).toBe(1);
  expect(failed.value.cases[0]!.trials[0]!.checks).toMatchObject([
    { id: "darrow.semantic.1", status: "failed" },
  ]);
  const failedEvidence = JSON.parse(
    await readFile(failed.value.evidencePath, "utf8"),
  );
  expect(failedEvidence.trials[0].metrics).toEqual([
    { id: "darrow.evals.metric.false-positive", value: 1, unit: "count" },
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

test("Darrow head expectations run through Sevro's Git grader", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-head-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/head/cases");
  await mkdir(cases, { recursive: true });
  for (const [id, expectHeadChange] of [
    ["head-advanced", true],
    ["head-unchanged", false],
  ] as const) {
    await writeFile(
      join(cases, `${id}.yaml`),
      JSON.stringify({
        id,
        invariant: "HEAD-EXPECTATION",
        prompt: expectHeadChange ? "Commit the update." : "Leave HEAD alone.",
        fixture: {
          commits: [
            { message: "Initialize", files: { "README.md": "fixture\n" } },
          ],
        },
        expect_head_change: expectHeadChange,
        checks: [],
      }),
    );
  }
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run({ workspace, prompt }) {
    if (prompt.includes("Commit the update.")) {
      await writeFile(join(workspace, "README.md"), "updated\\n");
      const proc = Bun.spawn(["git", "-c", "user.name=Sevro Test", "-c", "user.email=sevro@example.test", "commit", "-am", "Update fixture"], { cwd: workspace, stdout: "pipe", stderr: "pipe" });
      if ((await proc.exited) !== 0) throw new Error(await new Response(proc.stderr).text());
    }
    return { finalMessage: "ready", complete: true };
  },
};
`,
  );
  for (const [id, expectedIds] of [
    ["head-advanced", ["darrow.head.changed", "darrow.head.lineage"]],
    ["head-unchanged", ["darrow.head.unchanged"]],
  ] as const) {
    const result = await command<CliReply>([
      process.execPath,
      resolve(import.meta.dir, "../../sevro-extension/run.ts"),
      "--case-id",
      id,
      "--project-root",
      root,
      "--results-root",
      join(root, `results-${id}`),
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
    expect(result.code, result.stderr).toBe(0);
    expect(result.value.task.verdict).toBe("passed");
    expect(result.value.cases[0]!.trials[0]!.checks).toMatchObject(
      expectedIds.map((checkId) => ({ id: checkId, status: "passed" })),
    );
  }
});

test("explicit Codex skill invocation packages the owning plugin for Sevro", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-invocation-"));
  roots.push(root);
  const plugin = join(root, "plugins/capability/probe");
  const skill = join(plugin, "skills/probe");
  await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
  await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
  await mkdir(join(plugin, "backend"), { recursive: true });
  await mkdir(join(skill, "evals"), { recursive: true });
  await writeFile(
    join(plugin, ".claude-plugin/plugin.json"),
    JSON.stringify({ name: "probe", version: "0.1.0" }),
  );
  await writeFile(
    join(plugin, ".codex-plugin/plugin.json"),
    JSON.stringify({ name: "probe", version: "0.1.0", skills: "./skills/" }),
  );
  await writeFile(join(plugin, "backend/tool.txt"), "packaged tool\n");
  await writeFile(
    join(skill, "SKILL.md"),
    "---\nname: probe\ndescription: Probe skill\n---\n\nUse this skill.\n",
  );
  await writeFile(join(skill, "evals/hidden.txt"), "hidden criteria\n");
  await writeFile(
    join(skill, "evals/invocation.yaml"),
    JSON.stringify({
      id: "probe-invocation",
      invariant: "PROBE-I1",
      activation: "positive",
      prompt: "Run {{skill_invocation}} in {{repo_dir}} and return ready.",
      fixture: {
        commits: [
          { message: "Initialize", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["probe-invocation"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  expect(selected.prompt).toBe(
    "Run {{sevro.skill_invocation}} in {{sevro.workspace}} and return ready.",
  );
  const prepared = await command<{
    result: {
      codexMarketplace: {
        artifactRoot: string;
        marketplaceName: string;
        pluginNames: string[];
      };
      codexSkillInvocation: { pluginName: string; skillName: string };
      artifacts: Array<{
        relativePath: string;
        contentBase64: string;
        gitExclude: boolean;
      }>;
    };
    error?: { message: string };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: selected,
      host: {
        id: "sevro.host.codex",
        capabilities: [
          "sevro.codex.plugin-marketplace",
          "sevro.codex.explicit-invocation",
        ],
      },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.code, prepared.stderr).toBe(0);
  expect(prepared.value.result.codexMarketplace).toEqual({
    artifactRoot: ".sevro-marketplace",
    marketplaceName: "darrow-eval",
    pluginNames: ["probe"],
  });
  expect(prepared.value.result.codexSkillInvocation).toEqual({
    pluginName: "probe",
    skillName: "probe",
  });
  const paths = prepared.value.result.artifacts.map(
    (item) => item.relativePath,
  );
  expect(paths).toContain(".sevro-marketplace/.claude-plugin/marketplace.json");
  expect(paths).toContain(
    ".sevro-marketplace/plugin/.codex-plugin/plugin.json",
  );
  expect(paths).toContain(".sevro-marketplace/plugin/backend/tool.txt");
  expect(paths).toContain(".sevro-marketplace/plugin/skills/probe/SKILL.md");
  expect(paths.some((path) => path.includes("/evals/"))).toBe(false);
  expect(prepared.value.result.artifacts.every((item) => item.gitExclude)).toBe(
    true,
  );
  const refused = await command<{ error: { message: string } }>(
    [process.execPath, extension],
    request("prepare", {
      case: selected,
      host: { id: "sevro.host.codex", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(refused.value.error?.message).toMatch(
    /requires a capable plugin host/,
  );

  const route = sevroCommand();
  const commandFile = join(root, "extension-command.json");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  const dry = await command<{
    execution: { status: string };
    evidencePath: string;
  }>([
    ...route.launch,
    "run",
    "--json",
    ...route.extraArgs,
    "--extension-command-file",
    commandFile,
    "--extension-source-file",
    extension,
    "--case-id",
    "probe-invocation",
    "--project-root",
    root,
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
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
    "--results-root",
    join(root, "results"),
  ]);
  expect(dry.code, JSON.stringify(dry.value)).toBe(0);
  expect(dry.value.execution.status).toBe("not_run");
  const evidence = JSON.parse(await readFile(dry.value.evidencePath, "utf8"));
  expect(evidence.configuration.redacted.codexMarketplace).toEqual(
    prepared.value.result.codexMarketplace,
  );
  expect(evidence.trials[0].artifactRefs).toHaveLength(paths.length);
  const installedCodex = Bun.which("codex");
  if (process.platform !== "darwin" || !installedCodex) return;
  const fakeRoot = await mkdtemp(join(tmpdir(), "darrow-sevro-plugin-host-"));
  roots.push(fakeRoot);
  const fakeCodex = join(fakeRoot, "fake-codex");
  const quotedCodex = `'${installedCodex.replaceAll("'", `'"'"'`)}'`;
  await writeFile(
    fakeCodex,
    `#!/bin/sh
if [ "$1" = plugin ] || [ "$1" = sandbox ]; then exec ${quotedCodex} "$@"; fi
if [ "$1" = --version ]; then printf 'synthetic-codex\\n'; exit 0; fi
if [ "$1" != exec ]; then exit 99; fi
skill_file="$CODEX_HOME/plugins/cache/darrow-eval/probe/0.1.0/skills/probe/SKILL.md"
test -f "$skill_file" || exit 98
/bin/cat >/dev/null
/bin/cat <<SEVRO_EVENTS
{"type":"thread.started","thread_id":"plugin-turn"}
{"type":"item.completed","item":{"type":"agent_message","text":"ready"}}
{"type":"turn.completed","usage":{"input_tokens":12,"output_tokens":4}}
SEVRO_EVENTS
`,
    { mode: 0o700 },
  );
  await chmod(fakeCodex, 0o700);
  const authFile = join(root, "auth.json");
  await writeFile(authFile, "test-only-auth\n", { mode: 0o600 });
  const live = await command<CliReply>([
    ...route.launch,
    "run",
    "--json",
    ...route.extraArgs,
    "--extension-command-file",
    commandFile,
    "--extension-source-file",
    extension,
    "--case-id",
    "probe-invocation",
    "--project-root",
    root,
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
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
    "--results-root",
    join(root, "live-results"),
  ]);
  expect(live.code, live.stderr).toBe(0);
  expect(live.value.task.verdict).toBe("passed");
  expect(live.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
    {
      id: "darrow.evals.activation",
      status: "passed",
      evidenceRefs: ["sevro.codex.explicit-invocation"],
    },
  ]);
  const liveEvidence = JSON.parse(
    await readFile(live.value.evidencePath, "utf8"),
  );
  expect(liveEvidence.trials[0].observations).toContainEqual({
    id: "sevro.codex.explicit-invocation",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "explicit_invocation",
      primarySkill: "probe",
      observedSkills: ["probe"],
    },
  });
  expect(liveEvidence.trials[0].observations).toContainEqual({
    id: "sevro.codex.skill-reads",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "skill_file_read_probe",
      primarySkill: null,
      observedSkills: [],
    },
  });
});

test("Claude preparation passes filtered plugin directories to Sevro", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-claude-package-"));
  roots.push(root);
  for (const name of ["probe", "secondary"]) {
    const plugin = join(root, `plugins/capability/${name}`);
    const skill = join(plugin, `skills/${name}`);
    await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
    await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
    await mkdir(skill, { recursive: true });
    await writeFile(
      join(plugin, ".claude-plugin/plugin.json"),
      JSON.stringify({ name, version: "0.1.0" }),
    );
    await writeFile(
      join(plugin, ".codex-plugin/plugin.json"),
      JSON.stringify({ name, version: "0.1.0", skills: "./skills/" }),
    );
    await writeFile(
      join(skill, "SKILL.md"),
      `---\nname: ${name}\ndescription: Probe skill\n---\n\nUse this skill.\n`,
    );
  }
  const caseDir = join(root, "plugins/capability/probe/skills/probe/evals");
  await mkdir(caseDir, { recursive: true });
  await writeFile(
    join(caseDir, "package.yaml"),
    JSON.stringify({
      id: "claude-package-probe",
      invariant: "PROBE-I1",
      prompt: "{{skill_invocation}} Return ready.",
      additional_plugins: ["plugins/capability/secondary"],
      fixture: {
        commits: [
          { message: "Initialize", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["claude-package-probe"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  expect(resolved.value.error).toBeUndefined();
  const selected = resolved.value.result.cases[0]!;
  expect(selected.prompt).toBe("{{sevro.skill_invocation}} Return ready.");
  const prepared = await command<{
    result: {
      claudePluginDirs: { artifactRoots: string[] };
      claudeSkillInvocation: { pluginName: string; skillName: string };
      artifacts: Array<{ relativePath: string; gitExclude: boolean }>;
    };
    error?: { message: string };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: selected,
      host: {
        id: "sevro.host.claude",
        capabilities: [
          "sevro.claude.plugin-dirs",
          "sevro.claude.explicit-invocation",
        ],
      },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.value.error).toBeUndefined();
  expect(prepared.value.result.claudePluginDirs.artifactRoots).toEqual([
    ".sevro-marketplace/plugin",
    ".sevro-marketplace/plugins/0-secondary",
  ]);
  expect(prepared.value.result.claudeSkillInvocation).toEqual({
    pluginName: "probe",
    skillName: "probe",
  });
  const paths = prepared.value.result.artifacts.map(
    (item) => item.relativePath,
  );
  expect(paths).toContain(".sevro-marketplace/plugin/skills/probe/SKILL.md");
  expect(paths).toContain(
    ".sevro-marketplace/plugins/0-secondary/skills/secondary/SKILL.md",
  );
  expect(paths.every((path) => !path.includes("/evals/"))).toBe(true);
  expect(prepared.value.result.artifacts.every((item) => item.gitExclude)).toBe(
    true,
  );
  const refused = await command<{ error: { message: string } }>(
    [process.execPath, extension],
    request("prepare", {
      case: selected,
      host: { id: "sevro.host.claude", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(refused.value.error.message).toMatch(/capable plugin host/);
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
  expect(() =>
    invocation([...args, "--extension-configuration-file=other"]),
  ).toThrow(/owned by Darrow/);
  const baseline = invocation([
    "--case-id",
    "example",
    "--results-root",
    "/tmp/darrow-sevro-results",
    "--without-skill",
    "--",
  ]);
  expect(baseline.withoutSkill).toBeTrue();
  expect(baseline.command).toContain("--extension-configuration-file");
});

test("no-skill preparation omits mounts and activation grading", async () => {
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["author-agent-skill-validate-read-only"] },
      configuration: { withoutSkill: true },
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  expect(selected.extensionData["darrow.case"].activation).toBeDefined();
  const prepared = await command<{
    result: { artifacts: unknown[] };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: selected,
      host: { id: "sevro.host.codex", capabilities: [] },
      configuration: { withoutSkill: true },
    }),
  );
  expect(prepared.code, prepared.stderr).toBe(0);
  expect(prepared.value.result.artifacts).toEqual([]);
  const evaluated = await command<{
    result: { domainOutcomes: unknown[] };
  }>(
    [process.execPath, extension],
    request("evaluate", {
      extensionData: selected.extensionData,
      observations: [],
      configuration: { withoutSkill: true },
    }),
  );
  expect(evaluated.code, evaluated.stderr).toBe(0);
  expect(evaluated.value.result.domainOutcomes).toEqual([]);

  const explicit = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["grilling-direct-frontier"] },
      configuration: { withoutSkill: true },
    }),
  );
  expect(explicit.code, explicit.stderr).toBe(0);
  const rejected = await command<ExtensionReply>(
    [process.execPath, extension],
    request("prepare", {
      case: explicit.value.result.cases[0],
      host: { id: "sevro.host.codex", capabilities: [] },
      configuration: { withoutSkill: true },
    }),
  );
  expect(rejected.value.error.message).toContain(
    "explicit skill invocation cannot run without skills",
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
  await writeFile(
    caseFile,
    JSON.stringify({
      ...definition,
      fixture: {
        setup: [
          definition.fixture.setup,
          "git add SETUP.txt",
          "git -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm 'Initial setup snapshot'",
        ].join("\n"),
      },
      checks: [
        { name: "setup result", run: "test -f SETUP.txt" },
        {
          name: "setup owns the first commit",
          run: 'test "$(git rev-list --count HEAD)" -eq 1 && test -z "$(git status --porcelain)"',
        },
      ],
    }),
  );
  const setupOnly = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams),
  );
  expect(setupOnly.code, setupOnly.stderr).toBe(0);
  expect(setupOnly.value.result.cases[0]!.fixture.commits).toEqual([]);
  const initialized = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "setup-case",
    "--project-root",
    root,
    "--results-root",
    join(root, "setup-only-results"),
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
  expect(initialized.code, initialized.stderr).toBe(0);
  expect(initialized.value.task.verdict).toBe("passed");
  expect(initialized.value.cases[0]!.trials[0]!.checks).toHaveLength(3);
});

test("Darrow runs implicit and explicit repository skills without a plugin wrapper", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-repository-skill-"));
  roots.push(root);
  const skillRoot = join(root, ".agents/skills/probe");
  await mkdir(join(skillRoot, "evals"), { recursive: true });
  await mkdir(join(skillRoot, "scripts"));
  const skillBody =
    "---\nname: probe\ndescription: Return ready.\n---\n\nReturn ready.\n";
  await writeFile(join(skillRoot, "SKILL.md"), skillBody);
  await writeFile(join(skillRoot, "scripts/helper.sh"), "#!/bin/sh\nexit 0\n", {
    mode: 0o700,
  });
  await writeFile(
    join(skillRoot, "evals/probe.yaml"),
    JSON.stringify({
      id: "repository-probe",
      invariant: "EXAMPLE-R1",
      activation: "positive",
      prompt: "Use the probe capability to return ready.",
      fixture: {
        setup: [
          "printf 'fixture\\n' > README.md",
          "git add README.md",
          "git -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm Initial",
          "mkdir -p .git/fixture-bin",
          "printf '%s\\n' '#!/bin/sh' \"printf 'fixture-bin-ready\\\\n'\" > .git/fixture-bin/sevro-probe",
          "chmod +x .git/fixture-bin/sevro-probe",
        ].join("\n"),
      },
      checks: [
        {
          name: "fixture tool",
          run: "sevro-probe",
          expect_exact: "fixture-bin-ready",
        },
        {
          name: "repository unchanged",
          run: 'test "$(git rev-list --count HEAD)" -eq 1 && test -z "$(git status --porcelain)"',
        },
      ],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["repository-probe"] },
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  const prepared = await command<{
    result: {
      artifacts: Array<{ relativePath: string }>;
      codexMarketplace?: unknown;
    };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: selected,
      host: { id: "sevro.host.codex", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.code, prepared.stderr).toBe(0);
  expect(
    prepared.value.result.artifacts.map((item) => item.relativePath),
  ).toEqual([
    ".agents/skills/probe/SKILL.md",
    ".agents/skills/probe/scripts/helper.sh",
  ]);
  expect(prepared.value.result.codexMarketplace).toBeUndefined();
  const claude = await command<ExtensionReply>(
    [process.execPath, extension],
    request("prepare", {
      case: selected,
      host: {
        id: "sevro.host.claude",
        capabilities: ["sevro.claude.repository-invocation"],
      },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(claude.value.error.message).toMatch(
    /Claude repository skill mirror is missing or unsafe/,
  );
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
  id: "sevro.host.codex", model: "synthetic-v1", effort: "none",
  hostCapabilities: ["sevro.codex.repository-invocation"],
  async run({ workspace, fixtureBinDir, prompt, explicitSkillInvocation, codexMarketplace }) {
    if ((await Bun.file(workspace + "/.agents/skills/probe/SKILL.md").text()) !== ${JSON.stringify(skillBody)}) throw new Error("skill mount differs");
    if (await Bun.file(workspace + "/.agents/skills/probe/evals/probe.yaml").exists()) throw new Error("eval exposed");
    if (codexMarketplace) throw new Error("repository skill was packaged as a plugin");
    if (explicitSkillInvocation && (prompt !== "Use $probe to return ready." || JSON.stringify(explicitSkillInvocation) !== JSON.stringify({ skillName: "probe", scope: "repository", token: "$probe" }))) throw new Error("repository invocation differs");
    const child = Bun.spawn(["sevro-probe"], { cwd: workspace, env: { PATH: fixtureBinDir + ":/usr/bin:/bin" }, stdout: "pipe" });
    if ((await new Response(child.stdout).text()).trim() !== "fixture-bin-ready" || await child.exited !== 0) throw new Error("fixture tool unavailable");
    return {
      finalMessage: "ready", complete: true,
      observations: [{ id: explicitSkillInvocation ? "sevro.codex.explicit-invocation" : "sevro.codex.skill-reads", source: "sevro.host.codex", completeness: "complete", data: { method: explicitSkillInvocation ? "explicit_invocation" : "skill_file_read_probe", primarySkill: "probe", observedSkills: ["probe"] } }],
    };
  },
};
`,
  );
  const run = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "repository-probe",
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
  expect(run.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
    { id: "darrow.evals.activation", status: "passed" },
  ]);
  const caseFile = join(skillRoot, "evals/probe.yaml");
  const explicitCase = await Bun.file(caseFile).json();
  explicitCase.prompt = "Use {{skill_invocation}} to return ready.";
  await writeFile(caseFile, JSON.stringify(explicitCase));
  const explicitRun = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "repository-probe",
    "--project-root",
    root,
    "--results-root",
    join(root, "explicit-results"),
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
  expect(explicitRun.code, explicitRun.stderr).toBe(0);
  expect(explicitRun.value.task.verdict).toBe("passed");
  const explicitEvidence = await Bun.file(
    explicitRun.value.evidencePath,
  ).json();
  expect(explicitEvidence.configuration.redacted).toMatchObject({
    codexRepositorySkillInvocation: { skillName: "probe" },
  });
  expect(explicitRun.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
    { id: "darrow.evals.activation", status: "passed" },
  ]);
});

test("Claude repository activation requires its complete bound command receipt", async () => {
  const details = {
    source: ".agents/skills/probe/evals/probe.yaml",
    activation: { class: "positive", targetSkill: "probe" },
    invocation: { scope: "repository", skillName: "probe" },
  };
  const receipt = {
    id: "sevro.claude.repository-invocation",
    source: "sevro.host.claude",
    completeness: "complete",
    data: {
      method: "native_repository_command",
      accepted: true,
      skill: "probe",
      primarySkill: "probe",
      observedSkills: ["probe"],
    },
  };
  const tools = {
    id: "sevro.claude.tool-calls",
    source: "sevro.host.claude",
    completeness: "complete",
    data: {
      method: "stream_tool_calls",
      truncated: false,
      calls: [
        {
          ordinal: 1,
          actor: "parent",
          parentToolUseId: null,
          name: "Skill",
          skill: "probe",
          invocation: "probe",
        },
      ],
    },
  };
  const status = async (observations: unknown[], explicit = true) => {
    const selected: Record<string, unknown> = { ...details };
    if (!explicit) delete selected.invocation;
    const result = await command<{
      result: { domainOutcomes: Array<{ status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        observations,
        extensionData: { "darrow.case": selected },
      }),
    );
    expect(result.code, result.stderr).toBe(0);
    return result.value.result.domainOutcomes[0]!.status;
  };
  expect(await status([receipt])).toBe("passed");
  for (const observations of [
    [],
    [tools],
    [receipt, receipt],
    [{ ...receipt, source: "foreign.host" }],
    [{ ...receipt, completeness: "partial" }, tools],
    [{ ...receipt, data: { ...receipt.data, accepted: false } }, tools],
    [{ ...receipt, data: { ...receipt.data, skill: "other" } }],
  ])
    expect(await status(observations)).toBe("unavailable");
  expect(await status([tools], false)).toBe("passed");
  const foreign = {
    ...tools,
    data: {
      ...tools.data,
      calls: [{ ...tools.data.calls[0], invocation: "foreign:probe" }],
    },
  };
  expect(await status([foreign], false)).toBe("unavailable");
  expect(
    await status(
      [{ ...tools, data: { ...tools.data, truncated: true } }],
      false,
    ),
  ).toBe("unavailable");
});

test("Darrow runs native Claude repository skills using their required mirror", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-claude-repository-"));
  roots.push(root);
  const canonical = join(root, ".agents/skills/probe");
  const mirror = join(root, ".claude/skills/probe");
  await mkdir(join(canonical, "evals"), { recursive: true });
  await mkdir(join(mirror, "evals"), { recursive: true });
  await writeFile(join(canonical, "SKILL.md"), "Codex source\n");
  const body =
    "---\nname: probe\ndescription: Claude probe\n---\nReturn ready.\n";
  await writeFile(join(mirror, "SKILL.md"), body);
  await writeFile(join(mirror, "evals/hidden.txt"), "private criteria\n");
  const caseFile = join(canonical, "evals/probe.yaml");
  const definition = {
    id: "claude-repository-probe",
    invariant: "EXAMPLE-CLAUDE",
    activation: "positive",
    prompt: "Return ready with the probe capability.",
    fixture: {
      commits: [{ message: "Initial", files: { "README.md": "fixture\n" } }],
    },
    checks: [],
    output_checks: [{ name: "response", expect_exact: "ready" }],
  };
  await writeFile(caseFile, JSON.stringify(definition));
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
    id: "sevro.host.claude", model: "synthetic-v1", effort: "none",
    hostCapabilities: ["sevro.claude.repository-invocation"],
    async run({ workspace, prompt, explicitSkillInvocation, claudePluginDirs }) {
      if ((await Bun.file(workspace + "/.claude/skills/probe/SKILL.md").text()) !== ${JSON.stringify(body)}) throw new Error("Claude mirror differs");
      if (await Bun.file(workspace + "/.claude/skills/probe/evals/hidden.txt").exists()) throw new Error("eval exposed");
      if (await Bun.file(workspace + "/.agents/skills/probe/SKILL.md").exists() || claudePluginDirs) throw new Error("repository scope changed");
      if (explicitSkillInvocation && (prompt !== "/probe Return ready." || explicitSkillInvocation.scope !== "repository" || explicitSkillInvocation.token !== "/probe")) throw new Error("native invocation differs");
      return { finalMessage: "ready", complete: true, observations: [
        { id: "sevro.claude.tool-calls", completeness: "complete", data: { method: "stream_tool_calls", truncated: false, calls: [{ ordinal: 1, actor: "parent", parentToolUseId: null, name: "Skill", skill: "probe", invocation: "probe" }] } },
        ...(explicitSkillInvocation ? [{ id: "sevro.claude.repository-invocation", completeness: "complete", data: { method: "native_repository_command", accepted: true, skill: "probe", primarySkill: "probe", observedSkills: ["probe"] } }] : [])
      ] };
    }
  };`,
  );
  const invoke = (destination: string) =>
    command<CliReply>([
      process.execPath,
      resolve(import.meta.dir, "../../sevro-extension/run.ts"),
      "--case-id",
      definition.id,
      "--project-root",
      root,
      "--results-root",
      join(root, destination),
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
  const implicit = await invoke("implicit-results");
  expect(implicit.code, implicit.stderr).toBe(0);
  expect(implicit.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
    {
      id: "darrow.evals.activation",
      status: "passed",
      evidenceRefs: ["sevro.claude.tool-calls"],
    },
  ]);
  await writeFile(
    caseFile,
    JSON.stringify({
      ...definition,
      prompt: "{{skill_invocation}} Return ready.",
    }),
  );
  const explicit = await invoke("explicit-results");
  expect(explicit.code, explicit.stderr).toBe(0);
  expect(explicit.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
    {
      id: "darrow.evals.activation",
      status: "passed",
      evidenceRefs: ["sevro.claude.repository-invocation"],
    },
  ]);
  const evidence = await Bun.file(explicit.value.evidencePath).json();
  expect(
    evidence.configuration.redacted.claudeRepositorySkillInvocation,
  ).toEqual({ skillName: "probe" });
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

test("Darrow fixture binaries reach the host and hidden checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-bin-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  const stub = "#!/bin/sh\nprintf 'fixture tool\\n'\n";
  await writeFile(
    join(cases, "bin.yaml"),
    JSON.stringify({
      id: "bin-case",
      invariant: "EXAMPLE-BIN",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "Initialize", files: { "README.md": "fixture\n" } },
        ],
        bin: { "fixture-tool": stub },
      },
      checks: [
        {
          name: "fixture tool",
          run: "fixture-tool",
          expect_exact: "fixture tool",
        },
      ],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["bin-case"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  expect(resolved.value.result.cases[0]!.fixture).toMatchObject({
    kind: "generated",
    bin: { "fixture-tool": stub },
  });
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run({ workspace, fixtureBinDir }) {
    if (fixtureBinDir !== workspace + "/.git/fixture-bin") throw new Error("fixture bin missing");
    const proc = Bun.spawn(["fixture-tool"], { cwd: workspace, env: { PATH: fixtureBinDir + ":/usr/bin:/bin" }, stdout: "pipe", stderr: "pipe" });
    const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    if (code !== 0 || stdout !== "fixture tool\\n") throw new Error("fixture tool unavailable");
    return { finalMessage: "ready", complete: true };
  },
};
`,
  );
  const run = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "bin-case",
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

test("Darrow local ticket works through Sevro and binds its source", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-ticket-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  const caseFile = join(cases, "ticket.yaml");
  const definition = {
    id: "ticket-case",
    invariant: "EXAMPLE-TICKET",
    prompt: "Update the local ticket.",
    fixture: {
      commits: [{ message: "Initialize", files: { "README.md": "fixture\n" } }],
      ticket: {
        id: "17",
        title: "Owner's note",
        body: "Original's {{note}}\n",
      },
      setup: "test -L .git/ticketctl.log && test -f .git/fixture-ticket.md",
    },
    checks: [
      {
        name: "ticket updated",
        run: "grep -Fx 'Updated note' .git/fixture-ticket.md && grep -Fx 'get 17' .git/ticketctl.log && grep -Fx 'describe 17' .git/ticketctl.log",
      },
    ],
    output_checks: [{ name: "response", expect_exact: "ready" }],
  };
  await writeFile(caseFile, JSON.stringify(definition));
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["ticket-case"] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  expect(selected.fixture.bin?.ticketctl).toContain("fixture-ticket-id");
  expect(selected.extensionData["darrow.case"].ticketDigest).toMatch(
    /^[a-f0-9]{64}$/,
  );
  const prepareParams = {
    case: selected,
    host: { id: "darrow.host.synthetic", capabilities: [] },
    condition: "passive",
    configuration: {},
  };
  await writeFile(
    caseFile,
    JSON.stringify({
      ...definition,
      fixture: {
        ...definition.fixture,
        ticket: { ...definition.fixture.ticket, body: "Changed source" },
      },
    }),
  );
  const changed = await command<ExtensionReply>(
    [process.execPath, extension],
    request("prepare", prepareParams),
  );
  expect(changed.value.error.message).toMatch(
    /ticket changed after resolution/,
  );
  await writeFile(caseFile, JSON.stringify(definition));
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run({ workspace, fixtureBinDir }) {
    const proc = Bun.spawn(["ticketctl", "get", "17", "--body-file", ".git/requested.md"], {
      cwd: workspace, env: { PATH: fixtureBinDir + ":/usr/bin:/bin" }, stdout: "pipe", stderr: "pipe"
    });
    const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    if (code !== 0) throw new Error("ticketctl get failed: " + stderr);
    if ((await Bun.file(workspace + "/.git/requested.md").text()) !== "Original's {{note}}\\n") throw new Error("wrong ticket body");
    await Bun.write(workspace + "/.git/replacement.md", "Updated note\\n");
    const updated = Bun.spawn(["ticketctl", "describe", "17", "--body-file", ".git/replacement.md"], {
      cwd: workspace, env: { PATH: fixtureBinDir + ":/usr/bin:/bin" }, stdout: "pipe", stderr: "pipe"
    });
    if ((await updated.exited) !== 0) throw new Error("ticketctl describe failed");
    return { finalMessage: "ready", complete: true };
  },
};
`,
  );
  const run = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "ticket-case",
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

test("Darrow resolves skill output schemas into Sevro grading", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-schema-"));
  roots.push(root);
  const skill = join(root, "plugins/capability/example/skills/example");
  const cases = join(skill, "evals");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(skill, "SKILL.md"),
    "---\nname: example\ndescription: Example\n---\n",
  );
  const schema = {
    type: "object",
    required: ["status"],
    properties: { status: { const: "ready" } },
    additionalProperties: false,
  };
  await writeFile(join(cases, "result.schema.json"), JSON.stringify(schema));
  const caseFile = join(cases, "schema.yaml");
  const definition = {
    id: "schema-case",
    invariant: "EXAMPLE-SCHEMA",
    prompt: "Return status JSON.",
    fixture: {
      commits: [{ message: "Initialize", files: { "README.md": "fixture\n" } }],
    },
    checks: [],
    output_checks: [
      {
        name: "schema result",
        valid_json: true,
        schema: "./evals/result.schema.json",
      },
    ],
  };
  await writeFile(caseFile, JSON.stringify(definition));
  const resolveParams = {
    projectRoot: pathToFileURL(root).href,
    selectors: { caseIds: ["schema-case"] },
    configuration: {},
  };
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  expect(resolved.value.result.cases[0]!.checks[0]).toMatchObject({
    grader: "sevro.output",
    configuration: { validJson: true, schema },
  });
  const adapter = join(root, "candidate.ts");
  const invoke = async (response: string, results: string) => {
    await writeFile(
      adapter,
      `export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run() { return { finalMessage: ${JSON.stringify(response)}, complete: true }; },
};
`,
    );
    return command<CliReply>([
      process.execPath,
      resolve(import.meta.dir, "../../sevro-extension/run.ts"),
      "--case-id",
      "schema-case",
      "--project-root",
      root,
      "--results-root",
      join(root, results),
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
  };
  const passed = await invoke('{"status":"ready"}', "passed-results");
  expect(passed.code, JSON.stringify(passed.value)).toBe(0);
  expect(passed.value.cases[0]!.trials[0]!.checks[0]).toMatchObject({
    id: "darrow.output.1",
    status: "passed",
  });
  const failed = await invoke('{"status":"waiting"}', "failed-results");
  expect(failed.code).toBe(1);
  expect(failed.value.cases[0]!.trials[0]!.checks[0]).toMatchObject({
    id: "darrow.output.1",
    status: "failed",
  });
  await writeFile(
    caseFile,
    JSON.stringify({
      ...definition,
      output_checks: [
        { name: "schema result", schema: "../../../../outside.json" },
      ],
    }),
  );
  const escaped = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams),
  );
  expect(escaped.value.error.message).toMatch(/schema path is invalid/);

  const realCase = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["readiness-json-explicit"] },
      configuration: {},
    }),
  );
  expect(realCase.code, realCase.stderr).toBe(0);
  expect(realCase.value.result.cases[0]!.checks[2]).toMatchObject({
    configuration: { schema: { type: "object" } },
  });
});

test("additional plugins and selected skills remain independent Codex packages", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-providers-"));
  roots.push(root);
  for (const name of ["owner", "provider", "selective"]) {
    const plugin = join(root, `plugins/capability/${name}`);
    await mkdir(join(plugin, ".claude-plugin"), { recursive: true });
    await mkdir(join(plugin, ".codex-plugin"), { recursive: true });
    await mkdir(join(plugin, "skills", name), { recursive: true });
    await mkdir(join(plugin, "backend"), { recursive: true });
    await writeFile(
      join(plugin, ".claude-plugin/plugin.json"),
      JSON.stringify({ name, version: "0.1.0" }),
    );
    await writeFile(
      join(plugin, ".codex-plugin/plugin.json"),
      JSON.stringify({ name, version: "0.1.0", skills: "./skills/" }),
    );
    await writeFile(
      join(plugin, "skills", name, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${name} skill\n---\n\nUse this skill.\n`,
    );
    await writeFile(join(plugin, "backend/helper.txt"), `${name} tool\n`);
  }
  const unselected = join(
    root,
    "plugins/capability/selective/skills/unselected",
  );
  await mkdir(unselected);
  await writeFile(join(unselected, "SKILL.md"), "unselected skill\n");
  const cases = join(root, "plugins/capability/owner/skills/owner/evals");
  await mkdir(cases);
  const caseFile = join(cases, "providers.yaml");
  const definition = {
    id: "provider-composition",
    invariant: "PROVIDER-C1",
    activation: "positive",
    activation_includes: ["provider", "selective"],
    additional_plugins: ["plugins/capability/provider"],
    additional_skills: ["plugins/capability/selective/skills/selective"],
    prompt: "Use the owner and provider skills to report ready.",
    fixture: {
      commits: [{ message: "Initialize", files: { "README.md": "fixture\n" } }],
    },
    checks: [],
  };
  await writeFile(caseFile, JSON.stringify(definition));
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: [definition.id] },
      configuration: {},
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  const prepare = async (host: Record<string, unknown>) =>
    command<{
      result: {
        codexMarketplace?: { pluginNames: string[] };
        codexSkillInvocation?: unknown;
        artifacts: Array<{ relativePath: string; contentBase64: string }>;
      };
      error?: { message: string };
    }>(
      [process.execPath, extension],
      request("prepare", {
        case: selected,
        host,
        condition: "passive",
        configuration: {},
      }),
    );
  const prepared = await prepare({
    id: "sevro.host.codex",
    capabilities: ["sevro.codex.plugin-marketplace"],
  });
  expect(prepared.code, prepared.stderr).toBe(0);
  expect(prepared.value.result.codexMarketplace?.pluginNames).toEqual([
    "owner",
    "provider",
    "selective",
  ]);
  expect(prepared.value.result.codexSkillInvocation).toBeUndefined();
  const artifacts = prepared.value.result.artifacts;
  const paths = artifacts.map((item) => item.relativePath);
  expect(paths).toContain(".sevro-marketplace/plugin/skills/owner/SKILL.md");
  expect(paths).toContain(
    ".sevro-marketplace/plugins/0-provider/skills/provider/SKILL.md",
  );
  expect(paths).toContain(
    ".sevro-marketplace/plugins/0-provider/backend/helper.txt",
  );
  expect(paths).toContain(
    ".sevro-marketplace/plugins/1-selective/skills/selective/SKILL.md",
  );
  expect(paths).not.toContain(
    ".sevro-marketplace/plugins/1-selective/skills/unselected/SKILL.md",
  );
  const marketplace = artifacts.find(
    (item) =>
      item.relativePath ===
      ".sevro-marketplace/.claude-plugin/marketplace.json",
  );
  expect(
    JSON.parse(Buffer.from(marketplace!.contentBase64, "base64").toString()),
  ).toMatchObject({
    plugins: [
      { name: "owner", source: "./plugin" },
      { name: "provider", source: "./plugins/0-provider" },
      { name: "selective", source: "./plugins/1-selective" },
    ],
  });
  const synthetic = await prepare({
    id: "darrow.host.synthetic",
    capabilities: [],
  });
  expect(synthetic.code, synthetic.stderr).toBe(0);
  expect(
    synthetic.value.result.artifacts.map((item) => item.relativePath),
  ).toEqual(
    expect.arrayContaining([
      ".agents/skills/owner/SKILL.md",
      ".agents/skills/provider/SKILL.md",
      ".agents/skills/selective/SKILL.md",
    ]),
  );
  const commandFile = join(root, "extension-command.json");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  const route = sevroCommand();
  const dry = await command<{
    execution: { status: string };
    evidencePath: string;
  }>([
    ...route.launch,
    "run",
    "--json",
    ...route.extraArgs,
    "--extension-command-file",
    commandFile,
    "--extension-source-file",
    extension,
    "--case-id",
    definition.id,
    "--project-root",
    root,
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
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
    "--results-root",
    join(root, "results"),
  ]);
  expect(dry.code, JSON.stringify(dry.value)).toBe(0);
  expect(dry.value.execution.status).toBe("not_run");
  const evidence = JSON.parse(await readFile(dry.value.evidencePath, "utf8"));
  expect(evidence.configuration.redacted.codexMarketplace.pluginNames).toEqual([
    "owner",
    "provider",
    "selective",
  ]);
  const repositoryOwner = join(root, ".agents/skills/owner");
  await mkdir(join(repositoryOwner, "evals"), { recursive: true });
  await writeFile(
    join(repositoryOwner, "SKILL.md"),
    "---\nname: owner\ndescription: Repository owner\n---\nUse this skill.\n",
  );
  await writeFile(
    join(repositoryOwner, "evals/composed.yaml"),
    JSON.stringify({
      ...definition,
      id: "repository-composition",
      prompt:
        "Use {{skill_invocation}} with the provider and selective skills to report ready.",
      activation_sequence: ["owner", "provider", "selective"],
      output_checks: [{ name: "ready", expect_exact: "ready" }],
    }),
  );
  const repositoryResolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["repository-composition"] },
    }),
  );
  expect(repositoryResolved.code, repositoryResolved.stderr).toBe(0);
  const repositoryPrepared = await command<{
    result: {
      artifacts: Array<{ relativePath: string }>;
      codexMarketplace: { pluginNames: string[] };
      codexRepositorySkillInvocation: { skillName: string };
    };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: repositoryResolved.value.result.cases[0],
      host: {
        id: "sevro.host.codex",
        capabilities: [
          "sevro.codex.plugin-marketplace",
          "sevro.codex.repository-invocation",
        ],
      },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(repositoryPrepared.code, repositoryPrepared.stderr).toBe(0);
  expect(repositoryPrepared.value.result.codexMarketplace.pluginNames).toEqual([
    "provider",
    "selective",
  ]);
  expect(
    repositoryPrepared.value.result.codexRepositorySkillInvocation,
  ).toEqual({ skillName: "owner" });
  expect(
    repositoryPrepared.value.result.artifacts.map((item) => item.relativePath),
  ).toContain(".agents/skills/owner/SKILL.md");
  expect(
    repositoryPrepared.value.result.artifacts.map((item) => item.relativePath),
  ).not.toContain(".sevro-marketplace/plugin/skills/owner/SKILL.md");
  const candidate = join(root, "repository-candidate.ts");
  await writeFile(
    candidate,
    `export default {
    id: "sevro.host.codex", model: "synthetic-v1", effort: "none",
    hostCapabilities: ["sevro.codex.plugin-marketplace", "sevro.codex.repository-invocation"],
    async run({ prompt, workspace, explicitSkillInvocation, codexMarketplace }) {
      if (prompt !== "Use $owner with the provider and selective skills to report ready." || explicitSkillInvocation?.scope !== "repository") throw new Error("native repository dispatch lost");
      if (JSON.stringify(codexMarketplace.pluginNames) !== JSON.stringify(["provider", "selective"])) throw new Error("provider packages differ");
      for (const path of [".agents/skills/owner/SKILL.md", ".sevro-marketplace/plugins/0-provider/skills/provider/SKILL.md", ".sevro-marketplace/plugins/1-selective/skills/selective/SKILL.md"]) {
        if (!(await Bun.file(workspace + "/" + path).exists())) throw new Error("composed mount missing");
      }
      return { finalMessage: "ready", complete: true, observations: [{ id: "sevro.codex.explicit-invocation", source: "sevro.host.codex", completeness: "complete", data: { method: "explicit_invocation", primarySkill: "owner", observedSkills: ["owner", "provider", "selective"] } }] };
    }
  };`,
  );
  const composedRun = await command<CliReply>([
    process.execPath,
    resolve(import.meta.dir, "../../sevro-extension/run.ts"),
    "--case-id",
    "repository-composition",
    "--project-root",
    root,
    "--results-root",
    join(root, "repository-results"),
    "--",
    "--adapter-module",
    candidate,
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
  ]);
  expect(composedRun.code, composedRun.stderr).toBe(0);
  expect(composedRun.value.task.verdict).toBe("passed");
  expect(composedRun.value.cases[0]!.trials[0]!.domainOutcomes).toMatchObject([
    { id: "darrow.evals.activation", status: "passed" },
  ]);
  await writeFile(
    caseFile,
    JSON.stringify({ ...definition, additional_plugins: ["../provider"] }),
  );
  const unsafe = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: [definition.id] },
      configuration: {},
    }),
  );
  expect(unsafe.value.error.message).toMatch(/repository plugin/);
  await writeFile(
    caseFile,
    JSON.stringify({ ...definition, additional_skills: ["../selective"] }),
  );
  const unsafeSkill = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: [definition.id] },
      configuration: {},
    }),
  );
  expect(unsafeSkill.value.error.message).toMatch(/plugin skill/);
});

test("Claude guide composition retains repository scope and independent providers", async () => {
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: ["guide-visual-present"] },
    }),
  );
  expect(resolved.code, resolved.stderr).toBe(0);
  const unavailable = await command<{ error: { message: string } }>(
    [process.execPath, extension],
    request("prepare", {
      case: resolved.value.result.cases[0],
      host: { id: "sevro.host.claude", capabilities: [] },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(unavailable.value.error.message).toMatch(/--claude-project-settings/);
  const prepared = await command<{
    result: {
      claudeRepositorySkillInvocation: { skillName: string };
      claudePluginDirs: { artifactRoots: string[] };
      artifacts: Array<{ relativePath: string }>;
    };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: resolved.value.result.cases[0],
      host: {
        id: "sevro.host.claude",
        capabilities: [
          "sevro.claude.plugin-dirs",
          "sevro.claude.repository-invocation",
        ],
      },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.code, prepared.stderr).toBe(0);
  expect(prepared.value.result.claudeRepositorySkillInvocation).toEqual({
    skillName: "darrow-guide",
  });
  expect(prepared.value.result.claudePluginDirs.artifactRoots).toEqual([
    ".sevro-marketplace/plugins/0-darrow-explanation",
  ]);
  expect(
    prepared.value.result.artifacts.map((item) => item.relativePath),
  ).toContain(".claude/skills/darrow-guide/SKILL.md");
  expect(
    prepared.value.result.artifacts.map((item) => item.relativePath),
  ).toContain(
    ".sevro-marketplace/plugins/0-darrow-explanation/skills/explain-visually/SKILL.md",
  );
});

test("real composition providers fit the Sevro preparation boundary", async () => {
  const skillDir =
    "plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery";
  const projectUrl = pathToFileURL(projectRoot).href;
  const prepared = await command<{
    result: {
      codexMarketplace: { pluginNames: string[] };
      artifacts: Array<{ relativePath: string }>;
    };
    error?: { message: string };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: {
        id: "real-provider-package",
        extensionData: {
          "darrow.case": {
            projectRoot: projectUrl,
            source: `${skillDir}/evals/verification-existing-review.yaml`,
            mount: {
              projectRoot: projectUrl,
              skillDir,
              mountPluginSkills: true,
            },
            additionalPlugins: [
              "plugins/capability/darrow-verification",
              "plugins/capability/darrow-review",
            ],
            activation: {
              class: "positive",
              targetSkill: "adaptive-delivery",
              includes: ["verify-change", "code-review"],
            },
          },
        },
      },
      host: {
        id: "sevro.host.codex",
        capabilities: ["sevro.codex.plugin-marketplace"],
      },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.code, prepared.stderr).toBe(0);
  expect(prepared.value.result.codexMarketplace.pluginNames).toEqual([
    "darrow-adaptive-delivery",
    "darrow-verification",
    "darrow-review",
  ]);
  expect(
    prepared.value.result.artifacts.map((item) => item.relativePath),
  ).toEqual(
    expect.arrayContaining([
      ".sevro-marketplace/plugin/skills/adaptive-delivery/SKILL.md",
      ".sevro-marketplace/plugins/0-darrow-verification/skills/verify-change/SKILL.md",
      ".sevro-marketplace/plugins/1-darrow-review/skills/code-review/SKILL.md",
    ]),
  );
});

test("ticket composition packages only selected Git skills", async () => {
  const skillDir =
    "plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr";
  const projectUrl = pathToFileURL(projectRoot).href;
  const prepared = await command<{
    result: {
      codexMarketplace: { pluginNames: string[] };
      artifacts: Array<{ relativePath: string }>;
    };
    error?: { message: string };
  }>(
    [process.execPath, extension],
    request("prepare", {
      case: {
        id: "ticket-provider-package",
        extensionData: {
          "darrow.case": {
            projectRoot: projectUrl,
            source: `${skillDir}/evals/composition-existing-pr.yaml`,
            mount: {
              projectRoot: projectUrl,
              skillDir,
              mountPluginSkills: true,
            },
            additionalPlugins: [
              "plugins/orchestration/darrow-adaptive-delivery",
              "plugins/capability/darrow-readiness-gate",
            ],
            additionalSkills: [
              "plugins/capability/darrow-git/skills/prepare-task-branch",
              "plugins/capability/darrow-git/skills/create-commit",
              "plugins/capability/darrow-git/skills/create-pr",
            ],
            activation: {
              class: "positive",
              targetSkill: "ticket-to-pr",
              sequence: ["ticket-to-pr", "adaptive-delivery"],
            },
          },
        },
      },
      host: {
        id: "sevro.host.codex",
        capabilities: ["sevro.codex.plugin-marketplace"],
      },
      condition: "passive",
      configuration: {},
    }),
  );
  expect(prepared.code, prepared.stderr).toBe(0);
  expect(prepared.value.result.codexMarketplace.pluginNames).toEqual([
    "darrow-ticket-to-pr",
    "darrow-adaptive-delivery",
    "darrow-readiness-gate",
    "darrow-git",
  ]);
  const paths = prepared.value.result.artifacts.map(
    (item) => item.relativePath,
  );
  expect(paths).toEqual(
    expect.arrayContaining([
      ".sevro-marketplace/plugins/2-darrow-git/skills/prepare-task-branch/SKILL.md",
      ".sevro-marketplace/plugins/2-darrow-git/skills/create-commit/SKILL.md",
      ".sevro-marketplace/plugins/2-darrow-git/skills/create-pr/SKILL.md",
    ]),
  );
  expect(paths).not.toContain(
    ".sevro-marketplace/plugins/2-darrow-git/skills/create-branch/SKILL.md",
  );
});
