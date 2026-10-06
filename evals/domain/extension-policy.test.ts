import { afterEach, expect, test } from "bun:test";

import { createHash } from "node:crypto";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";

import { tmpdir } from "node:os";

import { join, resolve } from "node:path";

import { pathToFileURL } from "node:url";

import { invocation } from "../sevro-extension/run";

const extension = resolve(import.meta.dir, "../sevro-extension/index.ts");

const projectRoot = resolve(import.meta.dir, "../..");

const roots: string[] = [];

test("Darrow record checks require one complete final response and unique integer records", async () => {
  const complete =
    "ready\nevaluation_child_invocations\t2\nevaluation_human_interruptions: 0\n";
  const evaluate = async (observations: unknown[]) => {
    const reply = await command<{
      result: { checks: Array<{ id: string; status: string }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        configuration: { requireEvaluationRecords: true },
        extensionData: { "darrow.case": { benchmarkRecords: true } },
        observations,
      }),
    );
    expect(reply.code, reply.stderr).toBe(0);
    return reply.value.result.checks.map((check) => check.status);
  };
  for (const source of ["sevro.host.codex", "sevro.host.claude"]) {
    const observation = {
      id: "sevro.observation.final-message",
      source,
      completeness: "complete",
      data: { text: complete },
    };
    expect(await evaluate([observation])).toEqual(["passed", "passed"]);
    for (const [text, statuses] of [
      [complete + "evaluation_child_invocations: 2", ["failed", "passed"]],
      [complete + "evaluation_human_interruptions\t0", ["passed", "failed"]],
      [
        "evaluation_child_invocations: -1\nevaluation_human_interruptions: 0.5",
        ["failed", "failed"],
      ],
      ["ready", ["failed", "failed"]],
    ] as const)
      expect(await evaluate([{ ...observation, data: { text } }])).toEqual([
        ...statuses,
      ]);
    expect(
      await evaluate([{ ...observation, completeness: "partial" }]),
    ).toEqual(["unavailable", "unavailable"]);
    expect(await evaluate([observation, observation])).toEqual([
      "unavailable",
      "unavailable",
    ]);
    expect(await evaluate([{ ...observation, source: "other.host" }])).toEqual([
      "unavailable",
      "unavailable",
    ]);
  }
  expect(await evaluate([])).toEqual(["unavailable", "unavailable"]);
});

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

function request(method: string, params: Record<string, unknown>) {
  return {
    protocol:
      method === "describe" ? "sevro.discovery.v1" : "sevro.extension.v1",
    id: `request-${method}`,
    method,
    params,
  };
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
    request("resolve", resolveParams("audit-agent-skill-validate-read-only")),
  );
  expect(activationCase.code, activationCase.stderr).toBe(0);
  expect(
    activationCase.value.result.cases[0]!.extensionData["darrow.case"]
      .activation,
  ).toEqual({
    class: "positive",
    targetSkill: "audit-agent-skill",
    excludes: ["create-agent-skill"],
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
      adaptive_goal_composition: true,
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
        selectors: { caseIds: [`doctor-adaptive-goal-${suffix}`] },
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
      selectors: { caseIds: ["doctor-adaptive-goal-direct-codex"] },
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
            primarySkill: "adaptive-goal",
            observedSkills: ["adaptive-goal"],
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
      [await events("adaptive-goal-preflight\n")],
    ),
  ).toBe("failed");
  expect(
    await evaluate(
      selectedCase,
      [native, skills],
      [await events('{"skill":"adaptive-goal"}\n')],
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

test("Darrow keeps Adaptive Goal inactive for ordinary engineering", async () => {
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
    "adaptive-goal-preflight prepare\n",
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
            primarySkill: "adaptive-goal",
            observedSkills: ["adaptive-goal"],
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
    '{"name":"Skill","skill":"adaptive-goal"}\n',
  );
  const preflight = await artifact(
    "preflight.jsonl",
    "adaptive-goal-preflight prepare\n",
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
      primarySkill: "adaptive-goal",
      observedSkills: ["adaptive-goal"],
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
    "ticket-to-pr-adaptive-goal-unavailable",
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

test("Darrow current ledger exclusions use intact host events", async () => {
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
    evidenceRefs: ["sevro.codex.events"],
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
  expect((await status([goal], [clean]))?.status).toBe("passed");
  expect((await status([native], []))?.status).toBe("unavailable");
  expect(
    (await status([native], [{ ...clean, sha256: "0".repeat(64) }]))?.status,
  ).toBe("unavailable");
  expect(
    (await status([{ ...native, completeness: "partial" }], [clean]))?.status,
  ).toBe("passed");
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
});

test("Darrow extension translates shell and final-message assertions and grades domain metrics", async () => {
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

  for (const [statuses, expected] of [
    [
      ["passed", "passed"],
      [0, 1],
    ],
    [
      ["failed", "failed"],
      [1, 0],
    ],
  ] as const) {
    const evaluated = await command<{
      result: { metrics: Array<{ value: number | null }> };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        execution: { status: "completed" },
        builtinChecks: ["darrow.shell.1", "darrow.output.1"].map(
          (id, index) => ({
            id,
            status: statuses[index],
            evidenceRefs: [],
          }),
        ),
        observations: [],
        artifacts: [],
        extensionData: resolved.value.result.cases[0]!.extensionData,
        configuration: {},
      }),
    );
    expect(
      evaluated.value.result.metrics.map((metric) => metric.value),
    ).toEqual([...expected]);
  }
});

test("Darrow translates semantic propositions and grades false-positive metrics", async () => {
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
  for (const [status, value] of [
    ["passed", 0],
    ["failed", 1],
  ] as const) {
    const evaluated = await command<{
      result: {
        metrics: Array<{ id: string; value: number | null; unit: string }>;
      };
    }>(
      [process.execPath, extension],
      request("evaluate", {
        caseId: "semantic-case",
        execution: { status: "completed" },
        builtinChecks: [{ id: "darrow.semantic.1", status, evidenceRefs: [] }],
        observations: [],
        artifacts: [],
        extensionData: resolved.value.result.cases[0]!.extensionData,
        configuration: {},
      }),
    );
    expect(evaluated.code, evaluated.stderr).toBe(0);
    expect(evaluated.value.result.metrics).toEqual([
      { id: "darrow.evals.metric.false-positive", value, unit: "count" },
    ]);
  }
});

test("Darrow translates head expectations to the public Git grader", async () => {
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

  for (const [id, kinds] of [
    ["head-advanced", ["changed", "base-ancestor"]],
    ["head-unchanged", ["unchanged"]],
  ] as const) {
    const result = await command<ExtensionReply>(
      [process.execPath, extension],
      request("resolve", {
        projectRoot: pathToFileURL(root).href,
        selectors: { caseIds: [id] },
        configuration: {},
      }),
    );
    expect(result.code, result.stderr).toBe(0);
    expect(result.value.result.cases[0]!.checks).toEqual(
      kinds.map((kind) => ({
        id:
          kind === "base-ancestor"
            ? "darrow.head.lineage"
            : `darrow.head.${kind}`,
        grader: "sevro.git-head",
        configuration: { kind },
      })),
    );
  }
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
      selectors: { caseIds: ["audit-agent-skill-validate-read-only"] },
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
    "plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal";
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
              targetSkill: "adaptive-goal",
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
    "darrow-adaptive-goal",
    "darrow-verification",
    "darrow-review",
  ]);
  expect(
    prepared.value.result.artifacts.map((item) => item.relativePath),
  ).toEqual(
    expect.arrayContaining([
      ".sevro-marketplace/plugin/skills/adaptive-goal/SKILL.md",
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
              "plugins/orchestration/darrow-adaptive-goal",
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
              sequence: ["ticket-to-pr", "adaptive-goal"],
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
    "darrow-adaptive-goal",
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
