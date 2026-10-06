import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  copyFile,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const roots: string[] = [];
const legacyCommand = resolve(import.meta.dir, "../runner/report.ts");
const standaloneCommand = resolve(
  import.meta.dir,
  "../sevro-extension/legacy-report.ts",
);

test("empty historical result cells still validate their exit code", async () => {
  const { root, manifest } = await fixture();
  const empty = join(root, "empty.json");
  await writeFile(empty, "[]");
  const definition = JSON.parse(await readFile(manifest, "utf8"));
  definition.cells.push({
    harness: "claude",
    mode: "empty",
    result: empty,
    exitCode: "0",
  });
  await writeFile(manifest, JSON.stringify(definition));
  const original = await readFile(manifest, "utf8");
  for (const command of [legacyCommand, standaloneCommand]) {
    const run = await invoke(manifest, command);
    const report = JSON.parse(run.stdout);
    expect(run.code).toBe(1);
    expect(report.errors).toContainEqual({
      path: empty,
      message: "Invalid legacy cell exit code",
    });
    expect(report.inputs).toContainEqual({
      path: empty,
      kind: "results",
      sha256: createHash("sha256").update("[]").digest("hex"),
    });
    expect(report.rows.map((row: { caseId: string }) => row.caseId)).toEqual([
      "historical-sample",
    ]);
    expect(report.rows[0].measured.qualityPassRate).toBe(1);
  }
  expect(await readFile(empty, "utf8")).toBe("[]");
  expect(await readFile(manifest, "utf8")).toBe(original);
});

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

test.each([
  {
    verdict: "fail",
    checkPassed: true,
    recordedPassed: true,
    message: "Semantic assessment contradicts recorded check: answer",
  },
  {
    verdict: "pass",
    checkPassed: false,
    recordedPassed: false,
    message: "Semantic assessment contradicts recorded check: answer",
  },
  {
    verdict: "unknown",
    checkPassed: true,
    recordedPassed: true,
    message: "Invalid legacy semantic assessment",
  },
])(
  "historical semantic outcomes must agree with named checks: %j",
  async (scenario) => {
    const { root, result, manifest, sample } = await fixture();
    const assessment = {
      name: "answer",
      verdict: scenario.verdict,
      reason: "retained grading",
    };
    await writeFile(
      result,
      JSON.stringify([
        {
          ...sample,
          trials: [
            {
              ...sample.trials[0],
              passed: scenario.recordedPassed,
              checks: [{ name: "answer", passed: scenario.checkPassed }],
              semanticOutput: {
                ok: true,
                route: { harness: "codex", model: "grader", effort: "low" },
                assessments: [assessment],
              },
            },
          ],
        },
      ]),
    );
    const peer = join(root, "peer.json");
    await writeFile(
      peer,
      JSON.stringify([{ ...sample, caseId: "valid-peer" }]),
    );
    const definition = JSON.parse(await readFile(manifest, "utf8"));
    definition.cells.push({
      harness: "codex",
      mode: "peer",
      result: peer,
      exitCode: 0,
    });
    await writeFile(manifest, JSON.stringify(definition));
    const originalResult = await readFile(result, "utf8");
    const originalManifest = await readFile(manifest, "utf8");
    for (const command of [legacyCommand, standaloneCommand]) {
      const run = await invoke(manifest, command);
      const report = JSON.parse(run.stdout);
      expect(run.code, run.stderr + run.stdout).toBe(1);
      expect(report.errors).toContainEqual({
        path: result,
        message: scenario.message,
      });
      expect(report.rows[0]).toMatchObject({
        recorded: { passRate: 1 },
        trials: [{ semantic: { assessments: [assessment] } }],
        measured: {
          qualityPassRate: null,
          protocolPassRate: null,
          bookkeepingPassRate: null,
        },
      });
      expect(report.rows[1]).toMatchObject({
        caseId: "valid-peer",
        measured: { qualityPassRate: 1, protocolPassRate: 1 },
      });
    }
    expect(await readFile(result, "utf8")).toBe(originalResult);
    expect(await readFile(manifest, "utf8")).toBe(originalManifest);
  },
);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-history-"));
  roots.push(root);
  const result = join(root, "results.json");
  const manifest = join(root, "suite-run.json");
  const sample = {
    caseId: "historical-sample",
    harness: "codex",
    model: "recorded-model",
    effort: "medium",
    passRate: 1,
    trials: [
      {
        trial: 1,
        passed: true,
        checks: [{ name: "answer", passed: true }],
        harness: {
          ok: true,
          resultText: "",
          durationMs: 0,
          inputTokens: 0,
          outputTokens: 0,
        },
      },
    ],
  };
  await writeFile(result, JSON.stringify([sample], null, 2));
  await writeFile(
    manifest,
    JSON.stringify(
      {
        format: "darrow-orchestration-suite-v1",
        dry: false,
        trials: 1,
        runner: { revision: "a".repeat(40), dirty: false, patchSha256: null },
        cells: [{ harness: "codex", mode: "historical", result, exitCode: 0 }],
      },
      null,
      2,
    ),
  );
  return { root, result, manifest, sample };
}

async function invoke(
  input: string,
  command = legacyCommand,
  json = true,
  args: string[] = [],
) {
  const child = Bun.spawn(
    [process.execPath, command, input, ...(json ? ["--json"] : []), ...args],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        SEVRO_CHECKOUT: undefined,
        SEVRO_PACKAGE_BIN: undefined,
      },
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

test("historical report JSON retains explicit manifest provenance without rewriting inputs", async () => {
  const { result, manifest } = await fixture();
  const originalResult = await readFile(result, "utf8");
  const originalManifest = await readFile(manifest, "utf8");
  const run = await invoke(manifest);
  expect(run.code, run.stderr).toBe(0);
  const report = JSON.parse(run.stdout);
  expect(report.format).toBe("darrow-legacy-report-v1");
  expect(report.inputs).toContainEqual({
    path: result,
    kind: "results",
    sha256: createHash("sha256").update(originalResult).digest("hex"),
  });
  expect(report.rows[0]).toMatchObject({
    caseId: "historical-sample",
    executionMode: "executed",
    executionSource: "suite-manifest",
    candidateRoute: {
      harness: "codex",
      model: "recorded-model",
      effort: "medium",
    },
    recorded: { passRate: 1 },
    evaluator: {
      kind: "legacy-darrow",
      revision: "a".repeat(40),
      dirty: false,
      patchSha256: null,
    },
  });
  expect(report.comparison.status).toBe("not_assessed");
  expect(await readFile(result, "utf8")).toBe(originalResult);
  expect(await readFile(manifest, "utf8")).toBe(originalManifest);
});

test("historical reports retain owner-route applications as archival claims", async () => {
  const { result, manifest, sample } = await fixture();
  const routeApplication = {
    profile: "scaled",
    workflow: "refactor",
    risk: "elevated",
    workflowFile: "/historical/workflows/refactor.md",
    workflowSha256: "b".repeat(64),
    dimensionStage: "workflow-risk",
    verificationGate: "elevated",
    selected: {
      harness: "codex",
      provider: "openai",
      model: "archived-selected",
      effort: "high",
    },
    effective: {
      harness: "claude",
      provider: "anthropic",
      model: "archived-effective",
      effort: "medium",
    },
    appliedBy: "nested-session",
    launchBoundary: "nested_session",
    childInvocationCount: 2,
    childInputTokens: 19,
    childOutputTokens: 3,
  };
  await writeFile(
    result,
    JSON.stringify([
      {
        ...sample,
        passRate: 0,
        trials: [
          {
            ...sample.trials[0],
            passed: false,
            checks: [{ name: "answer", passed: false }],
            routeApplication: {
              ...routeApplication,
              internalContract: "private goal payload",
            },
          },
        ],
      },
      { ...sample, caseId: "historical-missing-policy" },
    ]),
  );
  const originalResult = await readFile(result, "utf8");
  const originalManifest = await readFile(manifest, "utf8");
  for (const command of [legacyCommand, standaloneCommand]) {
    const run = await invoke(manifest, command);
    expect(run.code, run.stderr).toBe(0);
    const report = JSON.parse(run.stdout);
    const row = report.rows[0];
    expect(row.trials[0].recorded?.routeApplication).toEqual(routeApplication);
    expect(row.trials[0].effectiveOwnerRoute).toBeNull();
    expect(row.candidateRoute).toEqual({
      harness: "codex",
      model: "recorded-model",
      effort: "medium",
    });
    expect(row.measured.qualityPassRate).toBe(0);
    expect(row.evaluator.kind).toBe("legacy-darrow");
    expect(report.rows[1].trials[0].recorded.routeApplication).toBeNull();
    expect(report.comparison.status).toBe("not_assessed");
    expect(run.stdout).not.toContain("private goal payload");
  }
  expect(await readFile(result, "utf8")).toBe(originalResult);
  expect(await readFile(manifest, "utf8")).toBe(originalManifest);
});

test("historical reports retain orchestration counts and reject malformed archival claims", async () => {
  const { root, result, manifest, sample } = await fixture();
  const counts = {
    childInvocationCount: 2,
    humanInterruptions: 1,
    escapedDefects: 0,
    falsePositiveVerifierFindings: 0,
  };
  await writeFile(
    result,
    JSON.stringify([
      {
        ...sample,
        trials: [
          {
            ...sample.trials[0],
            orchestrationMetrics: { ...counts, raw: "private metric payload" },
          },
        ],
      },
      {
        ...sample,
        caseId: "historical-partial-metrics",
        trials: [
          {
            ...sample.trials[0],
            orchestrationMetrics: { childInvocationCount: 0 },
          },
        ],
      },
      { ...sample, caseId: "historical-missing-metrics" },
    ]),
  );
  const originalResult = await readFile(result, "utf8");
  const originalManifest = await readFile(manifest, "utf8");
  for (const command of [legacyCommand, standaloneCommand]) {
    const run = await invoke(manifest, command);
    expect(run.code, run.stderr).toBe(0);
    const report = JSON.parse(run.stdout);
    expect(report.rows[0].trials[0].recorded?.orchestrationMetrics).toEqual(
      counts,
    );
    expect(report.rows[0].measured.qualityPassRate).toBe(1);
    expect(report.rows[0].trials[0].effectiveOwnerRoute).toBeNull();
    expect(report.rows[1].trials[0].recorded.orchestrationMetrics).toEqual({
      childInvocationCount: 0,
      humanInterruptions: null,
      escapedDefects: null,
      falsePositiveVerifierFindings: null,
    });
    expect(report.rows[2].trials[0].recorded.orchestrationMetrics).toBeNull();
    expect(report.comparison.status).toBe("not_assessed");
    expect(run.stdout).not.toContain("private metric payload");
  }

  const definition = JSON.parse(originalManifest);
  const malformed = [
    {
      policy: { orchestrationMetrics: "invalid" },
      message: "recorded orchestration metrics must be an object",
    },
    {
      policy: { orchestrationMetrics: { childInvocationCount: -1 } },
      message: "Invalid legacy child invocation count",
    },
    {
      policy: { orchestrationMetrics: { humanInterruptions: 0.5 } },
      message: "Invalid legacy human interruption count",
    },
    {
      policy: { orchestrationMetrics: { escapedDefects: "1" } },
      message: "Invalid legacy escaped defect count",
    },
    {
      policy: {
        orchestrationMetrics: {
          falsePositiveVerifierFindings: Number.MAX_SAFE_INTEGER + 1,
        },
      },
      message: "Invalid legacy false-positive verifier finding count",
    },
    {
      policy: { routeApplication: { selected: [] } },
      message: "recorded goal route must be an object",
    },
  ];
  const peers: { path: string; message: string; bytes: string }[] = [];
  for (const [index, { policy, message }] of malformed.entries()) {
    const path = join(root, `malformed-policy-${index}.json`);
    const bytes = JSON.stringify([
      {
        ...sample,
        caseId: `malformed-policy-${index}`,
        trials: [{ ...sample.trials[0], ...policy }],
      },
    ]);
    await writeFile(path, bytes);
    peers.push({ path, message, bytes });
    definition.cells.push({
      harness: "codex",
      mode: "malformed-policy",
      result: path,
      exitCode: 0,
    });
  }
  await writeFile(manifest, JSON.stringify(definition));
  const changedManifest = await readFile(manifest, "utf8");
  for (const command of [legacyCommand, standaloneCommand]) {
    const run = await invoke(manifest, command);
    expect(run.code, run.stderr).toBe(1);
    const report = JSON.parse(run.stdout);
    expect(report.rows.map((row: { caseId: string }) => row.caseId)).toEqual([
      "historical-sample",
      "historical-partial-metrics",
      "historical-missing-metrics",
    ]);
    for (const peer of peers) {
      expect(report.errors).toContainEqual({
        path: peer.path,
        message: peer.message,
      });
      expect(report.inputs).toContainEqual({
        path: peer.path,
        kind: "results",
        sha256: createHash("sha256").update(peer.bytes).digest("hex"),
      });
      expect(await readFile(peer.path, "utf8")).toBe(peer.bytes);
    }
  }
  expect(await readFile(result, "utf8")).toBe(originalResult);
  expect(await readFile(manifest, "utf8")).toBe(changedManifest);
});

test("default historical report writes the standalone archival view", async () => {
  const { root, result, manifest } = await fixture();
  const originals = await Promise.all([
    readFile(result, "utf8"),
    readFile(manifest, "utf8"),
  ]);
  const run = await invoke(manifest, legacyCommand, false);
  expect(run.code, run.stderr).toBe(0);
  expect(run.stdout).toContain(`Report: ${join(root, "report.md")}`);
  const markdown = await readFile(join(root, "report.md"), "utf8");
  expect(markdown).toContain("# Historical Darrow evaluation results");
  expect(markdown).toContain(
    "| historical-sample | codex | historical | executed | complete | 1 | 1 | 1 | unknown |",
  );
  expect(markdown).toContain("Recorded pass rates are archival claims");
  expect(markdown).toContain("SHA-256:");
  expect(
    await Promise.all([readFile(result, "utf8"), readFile(manifest, "utf8")]),
  ).toEqual(originals);
});

test.each([legacyCommand, standaloneCommand])(
  "historical report output cannot replace archive inputs (%s)",
  async (command) => {
    const { root, result, manifest } = await fixture();
    const fileAlias = join(root, "archive-alias.md");
    const hardAlias = join(root, "archive-hardlink.md");
    const directoryAlias = join(root, "archive-directory");
    await symlink(result, fileAlias);
    await link(result, hardAlias);
    await symlink(root, directoryAlias, "dir");
    const originals = await Promise.all([
      readFile(result, "utf8"),
      readFile(manifest, "utf8"),
    ]);
    for (const output of [
      manifest,
      result,
      fileAlias,
      hardAlias,
      join(directoryAlias, basename(result)),
    ]) {
      const run = await invoke(manifest, command, false, ["--output", output]);
      expect(run.code, run.stderr).toBe(64);
      expect(run.stderr).toContain("input archive");
      expect(
        await Promise.all([
          readFile(result, "utf8"),
          readFile(manifest, "utf8"),
        ]),
      ).toEqual(originals);
    }
    const output = join(root, "selected-report.md");
    await writeFile(output, "previous report");
    const run = await invoke(manifest, command, false, ["--output", output]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toContain(`Report: ${output}`);
    expect(await readFile(output, "utf8")).toContain(
      "# Historical Darrow evaluation results",
    );
    expect(
      await Promise.all([readFile(result, "utf8"), readFile(manifest, "utf8")]),
    ).toEqual(originals);
  },
);

test.each([legacyCommand, standaloneCommand])(
  "historical file reports retain unreadable child diagnostics and valid peers (%s)",
  async (command) => {
    const { root, result, manifest } = await fixture();
    const blocker = join(root, "blocker");
    const unreadable = join(blocker, "child.json");
    await writeFile(blocker, "regular file");
    const definition = JSON.parse(await readFile(manifest, "utf8"));
    definition.cells.push({
      result: "blocker/child.json",
      harness: "claude",
      mode: "unreadable",
      exitCode: 1,
    });
    await writeFile(manifest, JSON.stringify(definition));
    const inputs = [result, manifest, blocker];
    const originals = await Promise.all(inputs.map((path) => readFile(path)));
    const output = join(root, "report.md");
    const args = command === legacyCommand ? [] : ["--output", output];
    const run = await invoke(manifest, command, false, args);
    expect(run.code, run.stderr).toBe(1);
    expect(run.stdout).toContain(`Report: ${output}`);
    const markdown = await readFile(output, "utf8");
    expect(markdown).toContain("| historical-sample | codex | historical |");
    expect(markdown).toContain(`- ${unreadable}:`);
    expect(markdown).toContain("ENOTDIR");
    expect(await Promise.all(inputs.map((path) => readFile(path)))).toEqual(
      originals,
    );
    const refused = await invoke(manifest, command, false, [
      "--output",
      join(blocker, "report.md"),
    ]);
    expect(refused.code, refused.stderr).toBe(64);
    expect(await Promise.all(inputs.map((path) => readFile(path)))).toEqual(
      originals,
    );
  },
);

test("historical reporting remains usable without the generic runner or a Sevro installation", async () => {
  const { root, manifest } = await fixture();
  const consumer = join(root, "consumer");
  await mkdir(consumer);
  for (const name of [
    "legacy-report.ts",
    "legacy-evidence.ts",
    "legacy-output.ts",
  ]) {
    await copyFile(
      resolve(import.meta.dir, "../sevro-extension", name),
      join(consumer, name),
    );
  }
  const command = join(consumer, "legacy-report.ts");
  const archived = await invoke(manifest);
  const standalone = await invoke(manifest, command);
  expect(standalone.code, standalone.stderr).toBe(0);
  expect(JSON.parse(standalone.stdout)).toEqual(JSON.parse(archived.stdout));
  const human = await invoke(manifest, command, false);
  expect(human.code, human.stderr).toBe(0);
  expect(human.stdout).toContain("# Historical Darrow evaluation results");
  expect(human.stdout).toContain(
    "| historical-sample | codex | historical | executed | complete | 1 | 1 | 1 | unknown |",
  );
  expect(human.stdout).toContain(manifest);
  expect(human.stdout).toContain("a".repeat(40));
  expect(human.stdout).toContain(
    "Archive interpretation does not establish evaluator equivalence",
  );
});

test("standalone historical arrays leave missing provenance and behavioral rates unknown", async () => {
  const { result, sample } = await fixture();
  await writeFile(
    result,
    JSON.stringify([
      { ...sample, meanDurationMs: 0, meanTokens: null, totalCostUsd: null },
    ]),
  );
  const run = await invoke(result);
  expect(run.code, run.stderr).toBe(0);
  const report = JSON.parse(run.stdout);
  expect(report.errors).toEqual([]);
  expect(report.rows[0]).toMatchObject({
    executionMode: "unknown",
    executionSource: null,
    completeness: "unknown",
    evaluator: {
      kind: "legacy-darrow",
      revision: null,
      dirty: null,
      patchSha256: null,
    },
    recorded: {
      passRate: 1,
      meanDurationMs: 0,
      meanTokens: null,
      totalCostUsd: null,
    },
    measured: {
      qualityPassRate: null,
      protocolPassRate: null,
      bookkeepingPassRate: null,
    },
  });
  expect(report.comparison.status).toBe("not_assessed");
});

test("historical execution conflicts stay unknown and fail interpretation", async () => {
  const { result, manifest, sample } = await fixture();
  await writeFile(
    result,
    JSON.stringify([
      {
        ...sample,
        executionMode: "executed",
        trials: [{ ...sample.trials[0], executionMode: "executed" }],
      },
    ]),
  );
  const definition = JSON.parse(await readFile(manifest, "utf8"));
  definition.dry = true;
  await writeFile(manifest, JSON.stringify(definition));
  const run = await invoke(manifest);
  const report = JSON.parse(run.stdout);
  expect(report.rows[0]).toMatchObject({
    executionMode: "unknown",
    executionSource: "conflict",
    recorded: { passRate: 1 },
    measured: { qualityPassRate: null, protocolPassRate: null },
  });
  expect(report.errors).toContainEqual({
    path: result,
    message: "Conflicting execution declarations",
  });
  expect(run.code).toBe(1);
});

test("a retained legacy checkpoint never becomes a completed threshold run", async () => {
  const { root, sample } = await fixture();
  const checkpoint = join(root, "completed-trial.json");
  await writeFile(
    checkpoint,
    JSON.stringify({
      format: "darrow-eval-trial-v1",
      attemptId: "archived-attempt",
      plannedTrials: 1,
      case: {
        ...sample,
        executionMode: "executed",
        trials: [{ ...sample.trials[0], executionMode: "executed" }],
      },
    }),
  );
  const run = await invoke(checkpoint);
  expect(run.code, run.stderr + run.stdout).toBe(0);
  const report = JSON.parse(run.stdout);
  expect(report.inputs[0].kind).toBe("checkpoint");
  expect(report.rows[0]).toMatchObject({
    executionMode: "executed",
    completeness: "partial",
    expectedTrialCount: 1,
    observedTrialCount: 1,
    attemptId: "archived-attempt",
    recorded: { passRate: 1 },
    measured: {
      qualityPassRate: null,
      protocolPassRate: null,
      bookkeepingPassRate: null,
    },
  });
});

test("complete historical suites separate task quality and bookkeeping while retaining grader evidence", async () => {
  const { result, manifest, sample } = await fixture();
  const semanticRoute = {
    harness: "codex",
    model: "semantic-model",
    effort: "low",
  };
  const advisoryRoute = {
    harness: "claude",
    model: "advisory-model",
    effort: "medium",
  };
  await writeFile(
    result,
    JSON.stringify([
      {
        ...sample,
        executionMode: "executed",
        ownerEvaluationMode: "enforced",
        passRate: 0,
        trials: [
          {
            ...sample.trials[0],
            executionMode: "executed",
            passed: false,
            checks: [
              { name: "answer", passed: true },
              { name: "reported child invocation count", passed: false },
              { name: "reported human intervention count", passed: true },
            ],
            harness: {
              ...sample.trials[0]!.harness,
              raw: "private retained transcript",
              evaluationEnforcement: "passive",
              tokenUsageComplete: false,
            },
            activation: {
              passed: null,
              class: "implicit",
              targetSkill: "example",
              source: null,
              primarySkill: null,
              observedSkills: [],
            },
            semanticOutput: {
              ok: true,
              route: semanticRoute,
              assessments: [
                { name: "answer", verdict: "pass", reason: "correct" },
              ],
            },
            judge: {
              ok: true,
              route: advisoryRoute,
              assessment: { overallScore: 4, verdict: "pass" },
            },
            effectiveOwnerRoute: { model: "observed-child", effort: "high" },
          },
        ],
      },
    ]),
  );
  const definition = JSON.parse(await readFile(manifest, "utf8"));
  definition.cells[0].exitCode = 1;
  await writeFile(manifest, JSON.stringify(definition));
  const run = await invoke(manifest);
  expect(run.code, run.stderr + run.stdout).toBe(0);
  const report = JSON.parse(run.stdout);
  expect(report.rows[0]).toMatchObject({
    completeness: "complete",
    expectedTrialCount: 1,
    observedTrialCount: 1,
    measured: {
      qualityPassRate: 1,
      protocolPassRate: 0,
      bookkeepingPassRate: 0,
    },
    recorded: { passRate: 0 },
    policyAssistance: { requested: "enforced", actual: "passive" },
    tokenUsageComplete: false,
  });
  expect(report.rows[0].trials[0]).toMatchObject({
    passed: false,
    activation: { passed: null },
    semantic: { ok: true, route: semanticRoute },
    advisory: { ok: true, route: advisoryRoute },
    effectiveOwnerRoute: { model: "observed-child", effort: "high" },
  });
  expect(run.stdout).not.toContain("private retained transcript");
});

test.each([false, null])(
  "unavailable legacy semantic grading keeps measured rates unknown: %s",
  async (ok) => {
    const { result, manifest, sample } = await fixture();
    await writeFile(
      result,
      JSON.stringify([
        {
          ...sample,
          executionMode: "executed",
          passRate: 0,
          trials: [
            {
              ...sample.trials[0],
              executionMode: "executed",
              passed: false,
              semanticOutput: {
                ok,
                parseError: "invalid grader output",
                route: { harness: "codex", model: "grader", effort: "low" },
              },
            },
          ],
        },
      ]),
    );
    const definition = JSON.parse(await readFile(manifest, "utf8"));
    definition.cells[0].exitCode = 1;
    await writeFile(manifest, JSON.stringify(definition));
    const run = await invoke(manifest);
    expect(run.code, run.stderr + run.stdout).toBe(0);
    const report = JSON.parse(run.stdout);
    expect(report.rows[0].measured).toMatchObject({
      qualityPassRate: null,
      protocolPassRate: null,
    });
    expect(report.rows[0].trials[0].semantic).toMatchObject({
      ok,
      parseError: "invalid grader output",
    });
    expect(report.rows[0].recorded.passRate).toBe(0);
  },
);

test("missing historical cell inputs keep their own diagnostics and valid peers", async () => {
  const { root, result, manifest } = await fixture();
  const missing = join(root, "missing.json");
  const definition = JSON.parse(await readFile(manifest, "utf8"));
  definition.cells.push({
    harness: "claude",
    mode: "missing",
    result: "missing.json",
    exitCode: 1,
  });
  await writeFile(manifest, JSON.stringify(definition));
  const original = await readFile(result, "utf8");
  const run = await invoke(manifest);
  const report = JSON.parse(run.stdout);
  expect(run.code).toBe(1);
  expect(report.errors).toContainEqual({
    path: missing,
    message: expect.stringContaining("ENOENT"),
  });
  expect(report.inputs).toContainEqual({
    path: missing,
    kind: "results",
    sha256: null,
  });
  expect(report.rows.map((row: { caseId: string }) => row.caseId)).toEqual([
    "historical-sample",
  ]);
  expect(await readFile(result, "utf8")).toBe(original);
});

test("unrecognized historical formats cannot acquire suite provenance", async () => {
  const { manifest } = await fixture();
  const definition = JSON.parse(await readFile(manifest, "utf8"));
  definition.format = "darrow-localized-model-routing-comparison-v1";
  await writeFile(manifest, JSON.stringify(definition));
  const original = await readFile(manifest, "utf8");
  const run = await invoke(manifest);
  const report = JSON.parse(run.stdout);
  expect(run.code).toBe(1);
  expect(report.rows).toEqual([]);
  expect(report.errors).toEqual([
    {
      path: manifest,
      message:
        "Unsupported historical format: darrow-localized-model-routing-comparison-v1",
    },
  ]);
  expect(report.inputs).toEqual([
    {
      path: manifest,
      kind: "suite",
      sha256: createHash("sha256").update(original).digest("hex"),
    },
  ]);
  expect(await readFile(manifest, "utf8")).toBe(original);
});

test("null historical checks remain unavailable instead of an empty passing list", async () => {
  const { result, manifest, sample } = await fixture();
  await writeFile(
    result,
    JSON.stringify([
      { ...sample, trials: [{ ...sample.trials[0], checks: null }] },
    ]),
  );
  const run = await invoke(manifest);
  expect(run.code, run.stderr).toBe(0);
  const report = JSON.parse(run.stdout);
  expect(report.rows[0].trials[0].checks).toBeNull();
  expect(report.rows[0].measured).toEqual({
    qualityPassRate: null,
    protocolPassRate: null,
    bookkeepingPassRate: null,
  });
  expect(report.rows[0].recorded.passRate).toBe(1);
});

test.each(["harness", "check"])(
  "contradictory legacy trial success is never measured: %s",
  async (failure) => {
    const { result, manifest, sample } = await fixture();
    const trial = {
      ...sample.trials[0]!,
      harness: { ...sample.trials[0]!.harness, ok: failure !== "harness" },
      checks: [{ name: "answer", passed: failure !== "check" }],
    };
    await writeFile(result, JSON.stringify([{ ...sample, trials: [trial] }]));
    const run = await invoke(manifest);
    const report = JSON.parse(run.stdout);
    expect(run.code).toBe(1);
    expect(report.rows[0]).toMatchObject({
      recorded: { passRate: 1 },
      trials: [{ passed: true }],
      measured: {
        qualityPassRate: null,
        protocolPassRate: null,
        bookkeepingPassRate: null,
      },
    });
    expect(report.errors).toContainEqual({
      path: result,
      message: "Recorded trial success contradicts failed evidence",
    });
  },
);

test.each([
  ["check", "Duplicate legacy check name: answer"],
  ["trial", "Duplicate legacy trial number"],
  ["range", "Legacy trial number exceeds planned count"],
  ["exit", "Invalid legacy cell exit code"],
])("invalid historical structure is diagnosed: %s", async (kind, message) => {
  const { result, manifest, sample } = await fixture();
  const trials =
    kind === "trial"
      ? [sample.trials[0]!, sample.trials[0]!]
      : [
          {
            ...sample.trials[0]!,
            trial: kind === "range" ? 2 : 1,
            checks:
              kind === "check"
                ? [sample.trials[0]!.checks[0]!, sample.trials[0]!.checks[0]!]
                : sample.trials[0]!.checks,
          },
        ];
  await writeFile(result, JSON.stringify([{ ...sample, trials }]));
  const definition = JSON.parse(await readFile(manifest, "utf8"));
  if (kind === "trial") definition.trials = 2;
  if (kind === "exit") definition.cells[0].exitCode = "0";
  await writeFile(manifest, JSON.stringify(definition));
  const run = await invoke(manifest);
  const report = JSON.parse(run.stdout);
  expect(run.code).toBe(1);
  expect(report.errors).toContainEqual({ path: result, message });
  expect(report.rows).toEqual([]);
  expect(
    report.inputs.find((input: { path: string }) => input.path === result)
      .sha256,
  ).toBe(
    createHash("sha256")
      .update(await readFile(result))
      .digest("hex"),
  );
});
test.each([
  {
    dry: true,
    trials: 1,
    exitCode: 0,
    executionMode: "dry",
    completeness: "complete",
  },
  {
    dry: false,
    trials: 2,
    exitCode: 0,
    executionMode: "executed",
    completeness: "partial",
  },
  {
    dry: false,
    trials: 1,
    exitCode: 130,
    executionMode: "executed",
    completeness: "partial",
  },
  {
    dry: false,
    trials: 1,
    exitCode: null,
    executionMode: "executed",
    completeness: "unknown",
  },
])(
  "historical measurement requires complete live evidence: %j",
  async (scenario) => {
    const { manifest } = await fixture();
    const definition = JSON.parse(await readFile(manifest, "utf8"));
    definition.dry = scenario.dry;
    definition.trials = scenario.trials;
    definition.cells[0].exitCode = scenario.exitCode;
    await writeFile(manifest, JSON.stringify(definition));
    const run = await invoke(manifest);
    expect(run.code, run.stderr).toBe(0);
    const report = JSON.parse(run.stdout);
    expect(report.rows[0]).toMatchObject({
      executionMode: scenario.executionMode,
      completeness: scenario.completeness,
      recorded: { passRate: 1 },
      measured: {
        qualityPassRate: null,
        protocolPassRate: null,
        bookkeepingPassRate: null,
      },
    });
  },
);

test("executed standalone legacy results still lack a planned run boundary", async () => {
  const { result, sample } = await fixture();
  await writeFile(
    result,
    JSON.stringify([{ ...sample, executionMode: "executed" }]),
  );
  const run = await invoke(result);
  expect(run.code, run.stderr).toBe(0);
  expect(JSON.parse(run.stdout).rows[0]).toMatchObject({
    executionMode: "executed",
    completeness: "unknown",
    measured: {
      qualityPassRate: null,
      protocolPassRate: null,
      bookkeepingPassRate: null,
    },
  });
});

test("malformed historical JSON retains its digest and valid relative-path peers", async () => {
  const { root, manifest } = await fixture();
  const malformed = join(root, "malformed.json");
  await writeFile(malformed, "{broken");
  const definition = JSON.parse(await readFile(manifest, "utf8"));
  definition.cells[0].result = "results.json";
  definition.cells.push({
    result: "malformed.json",
    harness: "claude",
    exitCode: 1,
  });
  await writeFile(manifest, JSON.stringify(definition));
  const run = await invoke(manifest);
  const report = JSON.parse(run.stdout);
  expect(run.code).toBe(1);
  expect(report.rows.map((row: { caseId: string }) => row.caseId)).toEqual([
    "historical-sample",
  ]);
  expect(report.errors).toContainEqual({
    path: malformed,
    message: expect.any(String),
  });
  expect(report.inputs).toContainEqual({
    path: malformed,
    kind: "results",
    sha256: createHash("sha256").update("{broken").digest("hex"),
  });
  expect(await readFile(malformed, "utf8")).toBe("{broken");
});

test.each([
  {
    label: "semantic failure",
    passed: false,
    checks: [{ name: "answer", passed: false }],
    semantic: {
      ok: true,
      assessments: [{ name: "answer", verdict: "fail", reason: "incorrect" }],
    },
    quality: 0,
    protocol: 0,
  },
  {
    label: "advisory and activation failure",
    passed: true,
    checks: [{ name: "answer", passed: true }],
    semantic: undefined,
    quality: 1,
    protocol: 1,
  },
  {
    label: "missing semantic assessments",
    passed: false,
    checks: [{ name: "answer", passed: true }],
    semantic: { ok: true },
    quality: null,
    protocol: null,
  },
  {
    label: "missing semantic check",
    passed: false,
    checks: [],
    semantic: {
      ok: true,
      assessments: [{ name: "answer", verdict: "pass", reason: "correct" }],
    },
    quality: null,
    protocol: null,
  },
])(
  "historical semantic and advisory controls keep their separate meaning: $label",
  async (scenario) => {
    const { result, manifest, sample } = await fixture();
    await writeFile(
      result,
      JSON.stringify([
        {
          ...sample,
          passRate: scenario.passed ? 1 : 0,
          trials: [
            {
              ...sample.trials[0],
              passed: scenario.passed,
              checks: scenario.checks,
              semanticOutput: scenario.semantic,
              judge: {
                ok: true,
                route: { harness: "claude", model: "advisory", effort: "low" },
                assessment: { verdict: "fail", overallScore: 1 },
              },
              activation: { passed: false },
            },
          ],
        },
      ]),
    );
    for (const command of [legacyCommand, standaloneCommand]) {
      const run = await invoke(manifest, command);
      expect(run.code, run.stderr + run.stdout).toBe(0);
      const report = JSON.parse(run.stdout);
      expect(report.errors).toEqual([]);
      expect(report.rows[0].measured).toMatchObject({
        qualityPassRate: scenario.quality,
        protocolPassRate: scenario.protocol,
      });
      expect(report.rows[0].trials[0]).toMatchObject({
        advisory: { assessment: { verdict: "fail" } },
        activation: { passed: false },
      });
    }
  },
);
