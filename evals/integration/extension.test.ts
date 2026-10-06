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

import { sevroCommand } from "../sevro-extension/sevro-command";

const extension = resolve(import.meta.dir, "../sevro-extension/index.ts");

const projectRoot = resolve(import.meta.dir, "../..");

const roots: string[] = [];

test("Darrow separates case discovery from imported Codex configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-project-root-"));
  const configRoot = await mkdtemp(join(tmpdir(), "darrow-sevro-config-root-"));
  roots.push(root, configRoot);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  await mkdir(join(configRoot, ".codex"));
  await writeFile(
    join(configRoot, ".codex/config.toml"),
    'model = "ignored-config-route"\n[agents]\nmax_concurrent_threads_per_session = 7\n',
  );
  await writeFile(
    join(cases, "selected.yaml"),
    JSON.stringify({
      id: "separate-configuration",
      invariant: "SE-C29",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: initial", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "answer", expect_exact: "ready" }],
    }),
  );
  const run = await command<{
    task: { verdict: string };
    execution: { status: string };
    evidencePath: string;
    cases: Array<{ caseId: string }>;
  }>([
    process.execPath,
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
    "--case-id",
    "separate-configuration",
    "--project-root",
    root,
    "--results-root",
    join(root, "results"),
    "--",
    "--config-root",
    configRoot,
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
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
    "--dry",
  ]);
  expect(run.code, run.stderr + JSON.stringify(run.value)).toBe(0);
  expect(run.value.execution.status).toBe("not_run");
  expect(run.value.task.verdict).toBe("not_assessed");
  expect(run.value.cases[0]!.caseId).toBe("separate-configuration");
  const evidence = JSON.parse(await readFile(run.value.evidencePath, "utf8"));
  expect(evidence.configuration.redacted.hostConfiguration).toEqual({
    candidate: { "sevro.codex.agent-concurrency-limit": 7 },
  });
  expect(evidence.routes[0]).toMatchObject({
    model: "synthetic-codex",
    effort: "low",
  });
  expect(JSON.stringify(evidence)).not.toContain("ignored-config-route");
});

test("Darrow condition files render the actual candidate route through Sevro", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-condition-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  const conditionFile = join(root, "instructions.md");
  const text = "  Route {{harness}}|{{model}}|{{effort}}.  \n";
  await writeFile(conditionFile, text);
  const runCommand = resolve(import.meta.dir, "../sevro-extension/run.ts");
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
      resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
        resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
          activation?: {
            class: string;
            targetSkill: string;
            excludes?: string[];
          };
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
            'adaptive-goal-preflight step|Protocol ledger|"tool":"create_goal"',
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
      resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
      resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
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
