import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  fixtureExtensionRequest,
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/high-risk-routine.yaml",
  import.meta.url,
);
const reviewPlugin = new URL(
  "../../plugins/capability/darrow-review/",
  import.meta.url,
);
const proofBackend = new URL("../../../backend/", source);
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const state =
  'export DARROW_REVIEW_STATE_DIR="$(cat .git/oracle-review-state)" DARROW_CACHE_DIR="$PWD/.git/fixture-runtime-cache"';
const proof =
  "uv run --quiet --frozen --no-dev --project .git/fixture-backend adaptive-goal-fixture proof";
const review =
  "uv run --quiet --frozen --no-dev --project .git/review-plugin/backend";

type RepairScenario = {
  name: string;
  passes: boolean;
  markdown?: boolean;
  tampered?: boolean;
  guidance?: boolean;
  forgedGuidance?: boolean;
  omittedGuidance?: boolean;
  forgedResolution?: boolean;
  advisory?: boolean;
  stale?: boolean;
  missing?: boolean;
  forged?: boolean;
  omitted?: boolean;
  unresolved?: boolean;
  blocked?: boolean;
  duplicate?: boolean;
  conflict?: boolean;
};

async function packageFiles(backend: URL, prefix: string, launcher = false) {
  const files: Record<string, string> = {};
  for (const name of [
    "pyproject.toml",
    "uv.lock",
    ...(launcher ? ["scripts/run_locked.py"] : []),
  ])
    files[`${prefix}/${name}`] = await Bun.file(new URL(name, backend)).text();
  for await (const name of new Bun.Glob("src/**/*.{py,typed,md}").scan(
    backend.pathname,
  ))
    files[`${prefix}/${name}`] = await Bun.file(new URL(name, backend)).text();
  return files;
}

async function reviewFiles(prefix = ".fixture-review-plugin") {
  const files = await packageFiles(
    new URL("backend/", reviewPlugin),
    `${prefix}/backend`,
    true,
  );
  for (const name of [
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
  ])
    files[`${prefix}/${name}`] = await Bun.file(
      new URL(name, reviewPlugin),
    ).text();
  return files;
}

async function proofFixture(scenario: RepairScenario | undefined = undefined) {
  const runtime = await prepareUvFixtureRuntime();
  const files = {
    ...(await packageFiles(proofBackend, ".fixture-proof")),
    ...(await reviewFiles()),
    ...(scenario?.duplicate ? await reviewFiles(".fixture-review-cache") : {}),
  };
  if (scenario?.conflict)
    files[".fixture-review-cache/backend/src/darrow_review/scope.py"] =
      "raise RuntimeError('conflicting copy')\n";
  const providerBackends = [
    ".git/review-plugin/backend",
    ...(scenario?.duplicate ? [".git/plugin-cache/backend"] : []),
  ];
  const prepareProviders = providerBackends
    .map(
      (backend) =>
        `uv run --quiet --no-project ${backend}/scripts/run_locked.py python -c pass`,
    )
    .join("\n");
  return {
    commits: [{ message: "Initial", files: { "value.txt": "before\n" } }],
    files,
    bin: runtime.bin,
    setup: `${runtime.setupPrefix}\nmv .fixture-proof .git/fixture-backend\nmv .fixture-review-plugin .git/review-plugin\n${scenario?.duplicate ? "mv .fixture-review-cache .git/plugin-cache\n" : ""}uv sync --quiet --frozen --no-dev --project .git/fixture-backend\nuv sync --quiet --frozen --no-dev --project .git/review-plugin/backend\nexport DARROW_CACHE_DIR="$PWD/.git/fixture-runtime-cache"\n${prepareProviders}`,
  };
}

test("high-risk composition requires verification and supporting review reads", async () => {
  const canonical = await readFixtureCase(source);
  const resolved = await fixtureExtensionRequest<{
    cases: { id: string; extensionData: Record<string, unknown> }[];
  }>("resolve", {
    projectRoot: pathToFileURL(resolve(import.meta.dir, "../..")).href,
    selectors: { caseIds: [canonical.id] },
    configuration: {},
  });
  expect(resolved.cases).toHaveLength(1);
  const selected = resolved.cases[0]!;
  expect(selected.id).toBe(canonical.id);
  expect(
    (selected.extensionData["darrow.case"] as Record<string, unknown>)
      .activation,
  ).toEqual({
    class: "positive",
    targetSkill: "adaptive-goal",
    includes: ["verify-change", "code-review"],
  });
  for (const [skills, passed] of [
    [["adaptive-goal", "verify-change", "code-review"], true],
    [["adaptive-goal", "code-review", "verify-change"], true],
    [["adaptive-goal", "code-review"], false],
    [["adaptive-goal", "verify-change"], false],
    [["adaptive-goal"], false],
  ] as const) {
    const evaluated = await fixtureExtensionRequest<{
      domainOutcomes: { id: string; status: string }[];
    }>("evaluate", {
      extensionData: selected.extensionData,
      observations: [
        {
          id: "sevro.codex.explicit-invocation",
          source: "sevro.host.codex",
          completeness: "complete",
          data: {
            method: "explicit_invocation",
            primarySkill: "adaptive-goal",
            observedSkills: [...skills],
          },
        },
      ],
    });
    expect(
      evaluated.domainOutcomes.find(
        (outcome) => outcome.id === "darrow.evals.activation",
      )?.status,
    ).toBe(passed ? "passed" : "failed");
  }
});

function guidance(scenario: RepairScenario, handoff = false): string[] {
  if (handoff && scenario.omittedGuidance) return [];
  return [
    handoff && scenario.forgedGuidance
      ? "forged guidance"
      : "Advisory: restore the value; preserve the API",
    handoff && scenario.forgedResolution
      ? "forged resolution evidence"
      : "Reading value returns the required value",
  ];
}

function guidanceFields(scenario: RepairScenario, handoff = false) {
  const values = guidance(scenario, handoff);
  return values.length === 2
    ? { repair_guidance: values[0], resolution_evidence: values[1] }
    : {};
}

function artifactPath(path: string) {
  return path.startsWith("review-state/")
    ? `"$DARROW_REVIEW_STATE_DIR/${path.slice("review-state/".length)}"`
    : quote(path);
}

function writeRecord(name: string, path: string, data: object): OracleCheck {
  const contents = JSON.stringify(data);
  const bindings = ["original", "current"]
    .filter((key) => contents.includes(`{{${key}}}`))
    .map((key) => `${key}=$(cat .git/${key}-target) && test -n "$${key}"`)
    .join("\n");
  const script = `import json,sys
replacements = dict(zip(["{{repo}}","{{original}}","{{current}}"],sys.argv[2:]))
def bind(value):
    if isinstance(value,str):
        for key,replacement in replacements.items(): value=value.replace(key,replacement)
        return value
    if isinstance(value,list): return [bind(item) for item in value]
    if isinstance(value,dict): return {key:bind(item) for key,item in value.items()}
    return value
json.dump(bind(json.loads(sys.argv[1])),sys.stdout)`;
  return {
    name,
    run: `${state}\n${bindings}\nmkdir -p "$(dirname ${artifactPath(path)})"\npython3 -c ${quote(script)} ${quote(contents)} "$PWD" "\${original:-}" "\${current:-}" >${artifactPath(path)}`,
  };
}

function selectArtifact(
  record: string,
  scenario: { markdown?: boolean; tampered?: boolean },
): OracleCheck {
  const verification = record.endsWith("verification.json");
  const artifact = scenario.markdown
    ? record.replace(
        /(?:verification|result)\.json$/,
        verification ? "verification.md" : "review.md",
      )
    : record;
  const render = scenario.markdown
    ? `${review} review-report ${verification ? "render-verification" : "render"} ${artifactPath(record)} >${artifactPath(artifact)}\n${scenario.tampered ? `printf '%s\\n' Altered >>${artifactPath(artifact)}\n` : ""}`
    : "";
  return {
    name: "select the canonical machine or human artifact",
    run: `${state}\n${render}printf '%s\\n' ${artifactPath(artifact)} >.git/selected-review-artifact`,
  };
}

function assertChecks(
  result: Awaited<ReturnType<typeof runFixtureChecks>>,
  checks: OracleCheck[],
  rejectedIndex = -1,
) {
  const passes = rejectedIndex < 0;
  expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
  expect(
    result.checks.map((entry) => entry.status),
    result.diagnostic,
  ).toEqual(
    checks.map((_, index) => (index === rejectedIndex ? "failed" : "passed")),
  );
}

for (const scenario of [
  {
    name: "canonical human comprehensive report",
    standards: "pass",
    check: "pass",
    verdict: "pass",
    disposition: null,
    markdown: true,
    passes: true,
  },
  {
    name: "altered human comprehensive report",
    standards: "pass",
    check: "pass",
    verdict: "pass",
    disposition: null,
    markdown: true,
    tampered: true,
    passes: false,
  },
  {
    name: "clear without findings",
    standards: "pass",
    check: "pass",
    verdict: "pass",
    disposition: null,
    passes: true,
  },
  {
    name: "clear with advisory",
    standards: "pass",
    check: "pass",
    verdict: "pass",
    disposition: "advisory",
    passes: true,
  },
  {
    name: "blocking finding",
    standards: "fail",
    check: "pass",
    verdict: "fail",
    disposition: "blocking",
    passes: false,
  },
  {
    name: "blocking finding disguised as pass",
    standards: "pass",
    check: "pass",
    verdict: "pass",
    disposition: "blocking",
    passes: false,
  },
  {
    name: "blocked check",
    standards: "pass",
    check: "blocked",
    verdict: "blocked",
    disposition: null,
    passes: false,
  },
  {
    name: "invalid fail axis with advisory only",
    standards: "fail",
    check: "pass",
    verdict: "fail",
    disposition: "advisory",
    passes: false,
  },
]) {
  test(`high-risk review oracle: ${scenario.name}`, async () => {
    const canonical = await readFixtureCase(source);
    const check = canonical.checks.find(
      (entry) =>
        entry.name === "independent review artifact is canonical and clear",
    );
    if (!check) throw new Error("canonical clear-review oracle is missing");
    const record = "review-state/darrow-review.fixture/result.json";
    const records = {
      format: "darrow-review-result-v3",
      base: "HEAD",
      target: "WORKTREE@synthetic",
      changed_files: ["/synthetic/auth-config.js"],
      standards: scenario.standards,
      standards_sources: ["AGENTS.md"],
      spec: "pass",
      spec_source: "user request",
      findings: scenario.disposition
        ? [
            {
              axis: "standards",
              severity: "low",
              disposition: scenario.disposition,
              location: "/synthetic/auth-config.js:1",
              source: "AGENTS.md",
              evidence: "Synthetic finding for oracle regression",
              ...guidanceFields({ name: "synthetic", passes: true }),
            },
          ]
        : [],
      checks: [
        {
          command: "bash test.sh",
          applicability: "applicable",
          status: scenario.check,
          evidence: "Synthetic check evidence",
        },
      ],
      verdict: scenario.verdict,
      risks: ["Synthetic risk record"],
      next_action: "return control to enclosing goal",
    };
    const checks = [
      writeRecord("write comprehensive fixture record", record, records),
      selectArtifact(record, scenario),
      {
        name: "retain the selected proof",
        run: "cp .git/selected-review-artifact .git/fixture-state/high-risk-review-proof",
      },
      {
        ...check,
        run: `${state}\n${check.run}`,
        ...(scenario.passes ? { expect_regex: "valid clear review: /" } : {}),
      },
    ];
    const result = await runFixtureChecks({
      source,
      fixture: await proofFixture(),
      reviewState: true,
      checks,
    });
    assertChecks(result, checks, scenario.passes ? -1 : checks.length - 1);
  }, 30_000);
}

function originalRecord(scenario: RepairScenario) {
  return {
    format: "darrow-review-result-v3",
    base: "HEAD",
    target: "{{original}}",
    changed_files: ["{{repo}}/value.txt"],
    standards: "fail",
    standards_sources: ["user request"],
    spec: "pass",
    spec_source: "user request",
    findings: [
      {
        axis: "standards",
        severity: "high",
        disposition: "blocking",
        location: "{{repo}}/value.txt:1",
        source: "user request",
        evidence: "wrong value",
        ...guidanceFields(scenario),
      },
      ...(scenario.advisory || scenario.omitted
        ? [
            {
              axis: "spec",
              severity: "low",
              disposition: "advisory",
              location: "{{repo}}/value.txt:1",
              source: "user request",
              evidence: "optional clarity",
              ...guidanceFields({ name: "advisory", passes: true }),
            },
          ]
        : []),
    ],
    checks: [
      {
        command: "test value",
        applicability: "applicable",
        status: "pass",
        evidence: "checked",
      },
    ],
    verdict: "fail",
    risks: ["incorrect value"],
    next_action: "return findings to enclosing goal",
  };
}

function repairRecord(scenario: RepairScenario) {
  const [status, progress, outcome] = scenario.unresolved
    ? ["unresolved", "progressing", "continue"]
    : scenario.blocked
      ? ["blocked", "unavailable", "blocked"]
      : ["resolved", "resolved", "clear"];
  return {
    format: "darrow-review-verification-v3",
    original_target: "{{original}}",
    prior_target: "{{original}}",
    current_target: "{{current}}",
    previous_verification: { checksum: "none", path: "none" },
    original_findings: [
      {
        key: "standards:1:{{original}}",
        axis: "standards",
        order: "1",
        severity: "high",
        disposition: "blocking",
        location: "{{repo}}/value.txt:1",
        source: "user request",
        evidence: scenario.forged
          ? "different original evidence"
          : "wrong value",
        ...guidanceFields(scenario, true),
      },
      ...(scenario.advisory
        ? [
            {
              key: "spec:2:{{original}}",
              axis: "spec",
              order: "2",
              severity: "low",
              disposition: "advisory",
              location: "{{repo}}/value.txt:1",
              source: "user request",
              evidence: "optional clarity",
              ...guidanceFields({ name: "advisory", passes: true }),
            },
          ]
        : []),
    ],
    attempts: [
      {
        key: "standards:1:{{original}}",
        status,
        progress,
        evidence: "repair evidence",
      },
    ],
    checks: [
      {
        command: "test value",
        applicability: "applicable",
        status: "pass",
        evidence: "checked",
      },
    ],
    outcome,
    next_action: "resume the enclosing goal",
  };
}

function scope(name: string): OracleCheck {
  return {
    name: `capture ${name} current target`,
    run: `${state}\n${review} review-scope prepare --repo "$PWD" --base HEAD --target WORKTREE >.git/${name}-scope\npython3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["target"])' .git/${name}-scope >.git/${name}-target\ntest -s .git/${name}-target`,
  };
}

function repairActions(scenario: RepairScenario): OracleCheck[] {
  const record = "review-state/darrow-review.repaired/verification.json";
  return [
    {
      name: "write the initial incorrect change",
      run: "printf '%s\\n' 'incorrect change' >value.txt",
    },
    scope("original"),
    ...(scenario.missing
      ? []
      : [
          writeRecord(
            "retain the original comprehensive finding set",
            "review-state/darrow-review.original/result.json",
            originalRecord(scenario),
          ),
        ]),
    {
      name: "write the repaired change",
      run: "printf '%s\\n' 'correct change' >value.txt",
    },
    scope("current"),
    writeRecord(
      "write additive repair verification",
      record,
      repairRecord(scenario),
    ),
    {
      name: scenario.omittedGuidance
        ? "omitted required guidance fails public verification syntax"
        : "negative fixtures retain valid public verification syntax",
      run: `${state}\n${review} review-result validate-verification ${artifactPath(record)}`,
      ...(scenario.omittedGuidance ? { exit_code: 4 } : {}),
    },
    ...(scenario.stale
      ? [
          {
            name: "change content after review",
            run: "printf '%s\\n' 'changed after review' >value.txt",
          },
        ]
      : []),
    selectArtifact(record, scenario),
  ];
}

const repairScenarios: RepairScenario[] = [
  { name: "canonical human repair report", markdown: true, passes: true },
  {
    name: "altered human repair report",
    markdown: true,
    tampered: true,
    passes: false,
  },
  { name: "linked clear repair", passes: true },
  { name: "original guidance preserved", guidance: true, passes: true },
  {
    name: "forged original guidance",
    guidance: true,
    forgedGuidance: true,
    passes: false,
  },
  {
    name: "omitted original guidance",
    guidance: true,
    omittedGuidance: true,
    passes: false,
  },
  {
    name: "forged resolution evidence",
    guidance: true,
    forgedResolution: true,
    passes: false,
  },
  { name: "advisory preserved in original set", advisory: true, passes: true },
  { name: "stale repaired content", stale: true, passes: false },
  { name: "missing original artifact", missing: true, passes: false },
  { name: "forged original evidence", forged: true, passes: false },
  { name: "omitted original advisory", omitted: true, passes: false },
  { name: "unresolved repair", unresolved: true, passes: false },
  { name: "blocked repair", blocked: true, passes: false },
  {
    name: "identical marketplace and installed tools",
    duplicate: true,
    passes: true,
  },
  {
    name: "conflicting installed tools",
    duplicate: true,
    conflict: true,
    passes: false,
  },
];

for (const scenario of repairScenarios) {
  test(`high-risk completion: ${scenario.name}`, async () => {
    const actions = repairActions(scenario);
    const checks: OracleCheck[] = [
      ...actions,
      {
        name: "only clear exact-target verification completes the fixture goal",
        run: `${state}\n${proof} complete "$(cat .git/selected-review-artifact)"`,
      },
      {
        name: "completion marker matches the verification gate",
        run: scenario.passes
          ? 'test "$(cat .git/goal-complete)" = complete'
          : "test ! -e .git/goal-complete",
      },
      ...(scenario.passes
        ? [
            {
              name: "retained artifact is independently valid",
              run: `${state}\n${proof} artifact`,
            },
            {
              name: "retained review is still current",
              run: `${state}\n${proof} current`,
            },
            {
              name: "change content after completion",
              run: "printf '%s\\n' 'changed after completion' >value.txt",
            },
            {
              name: "changed content invalidates retained current proof",
              run: `${state}\n${proof} current`,
              exit_code: 1,
            },
          ]
        : []),
    ];
    const result = await runFixtureChecks({
      source,
      fixture: await proofFixture(scenario),
      reviewState: true,
      checks,
    });
    assertChecks(result, checks, scenario.passes ? -1 : actions.length);
  }, 30_000);
}
