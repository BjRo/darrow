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
  const unrelated = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: {
        caseIds: ["doctor-adaptive-delivery-direct-codex"],
      },
      configuration: {},
    }),
  );
  expect(unrelated.value.error.message).toContain("no Sevro evidence mapping");
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
    "Run {{sevro.codex.skill_invocation}} in {{sevro.workspace}} and return ready.",
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
    /requires the Codex plugin host/,
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
