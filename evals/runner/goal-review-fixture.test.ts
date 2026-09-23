import { expect, test } from "bun:test";
import { parse } from "yaml";
import { gradeActivation, validateActivationCase } from "./activation";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/high-risk-routine.yaml",
  import.meta.url,
);
const backendSource = new URL(
  "../../plugins/capability/darrow-review/backend/",
  import.meta.url,
);
const pluginSource = new URL(
  "../../plugins/capability/darrow-review/",
  import.meta.url,
);
const fixtureBackend = new URL("../../../backend/", source);

async function proofFiles() {
  const files: Record<string, string> = {};
  for (const name of ["pyproject.toml", "uv.lock"])
    files[`.git/fixture-backend/${name}`] = await Bun.file(
      new URL(name, fixtureBackend),
    ).text();
  const glob = new Bun.Glob("src/**/*.{py,typed,md}");
  for await (const name of glob.scan(fixtureBackend.pathname))
    files[`.git/fixture-backend/${name}`] = await Bun.file(
      new URL(name, fixtureBackend),
    ).text();
  return files;
}

function proofCommand(...args: string[]) {
  return [
    "uv",
    "run",
    "--quiet",
    "--frozen",
    "--no-dev",
    "--project",
    ".git/fixture-backend",
    "adaptive-delivery-fixture",
    "proof",
    ...args,
  ];
}

async function reviewFiles(prefix = ".git/review-plugin/backend") {
  const files: Record<string, string> = {};
  for (const name of ["pyproject.toml", "uv.lock", "scripts/run_locked.py"])
    files[`${prefix}/${name}`] = await Bun.file(
      new URL(name, backendSource),
    ).text();
  const pluginRoot = prefix.slice(0, -"/backend".length);
  for (const manifest of [
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
  ])
    files[`${pluginRoot}/${manifest}`] = await Bun.file(
      new URL(manifest, pluginSource),
    ).text();
  const glob = new Bun.Glob("src/darrow_review/*.{py,typed}");
  for await (const name of glob.scan(backendSource.pathname))
    files[`${prefix}/${name}`] = await Bun.file(
      new URL(name, backendSource),
    ).text();
  return files;
}

async function duplicateReview(repo: string, conflict?: boolean) {
  const copied = await reviewFiles(".git/plugin-cache/backend");
  for (const [path, text] of Object.entries(copied))
    await Bun.write(`${repo}/${path}`, text);
  if (conflict)
    await Bun.write(
      `${repo}/.git/plugin-cache/backend/src/darrow_review/scope.py`,
      "raise RuntimeError('conflicting copy')\n",
    );
}

function reviewCommand(command: string, ...args: string[]) {
  return [
    "uv",
    "run",
    "--quiet",
    "--frozen",
    "--no-dev",
    "--project",
    ".git/review-plugin/backend",
    command,
    ...args,
  ];
}

test("high-risk composition requires verification and supporting review reads", async () => {
  const evalCase = parse(await Bun.file(source).text()) as EvalCase;
  evalCase.owningSkillName = "adaptive-delivery";
  evalCase.skillDir = new URL("..", source).pathname;
  expect(validateActivationCase(evalCase)).toEqual([]);
  expect(evalCase.activation).toBe("positive");
  for (const [skills, passed] of [
    [["adaptive-delivery", "verify-change", "code-review"], true],
    [["adaptive-delivery", "code-review", "verify-change"], true],
    [["adaptive-delivery", "code-review"], false],
    [["adaptive-delivery", "verify-change"], false],
    [["adaptive-delivery"], false],
  ] as const) {
    const grade = gradeActivation(
      "positive",
      "adaptive-delivery",
      {
        source: "skill_file_read_probe",
        complete: true,
        primarySkill: "adaptive-delivery",
        observedSkills: [...skills],
      },
      { includes: evalCase.activation_includes },
    );
    expect(grade.passed).toBe(passed);
  }
});

function repairState(scenario: { unresolved?: boolean; blocked?: boolean }) {
  if (scenario.unresolved)
    return ["unresolved", "progressing", "continue"] as const;
  if (scenario.blocked) return ["blocked", "unavailable", "blocked"] as const;
  return ["resolved", "resolved", "clear"] as const;
}

function fixtureGuidance(
  scenario: {
    guidance?: boolean;
    omittedGuidance?: boolean;
    forgedGuidance?: boolean;
    forgedResolution?: boolean;
  },
  handoff = false,
): string[] {
  if (!scenario.guidance || (handoff && scenario.omittedGuidance)) return [];
  return [
    handoff && scenario.forgedGuidance
      ? "forged guidance"
      : "Advisory: restore the value; preserve the API",
    handoff && scenario.forgedResolution
      ? "forged resolution evidence"
      : "Reading value returns the required value",
  ];
}

async function selectedArtifact(
  repo: string,
  record: string,
  scenario: { markdown?: boolean; tampered?: boolean },
): Promise<string> {
  if (!scenario.markdown) return record;
  const verification = record.endsWith("verification.tsv");
  const rendered = Bun.spawnSync(
    reviewCommand(
      "review-report",
      verification ? "render-verification" : "render",
      record,
    ),
    { cwd: repo },
  );
  expect(rendered.exitCode).toBe(0);
  const artifact = record.replace(
    /(?:verification|result)\.tsv$/,
    verification ? "verification.md" : "review.md",
  );
  await Bun.write(
    artifact,
    rendered.stdout.toString() + (scenario.tampered ? "Altered\n" : ""),
  );
  return artifact;
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
    const evalCase = parse(await Bun.file(source).text()) as EvalCase;
    const check = evalCase.checks.find(
      (entry) =>
        entry.name === "independent review artifact is canonical and clear",
    );
    expect(check).toBeDefined();
    const records = [
      ["format", "darrow-review-result-v1"],
      ["base", "HEAD"],
      ["target", "WORKTREE@synthetic"],
      ["changed_file", "/synthetic/auth-config.js"],
      ["standards", scenario.standards],
      ["standards_source", "AGENTS.md"],
      ["spec", "pass"],
      ["spec_source", "user request"],
      ...(scenario.disposition
        ? [
            [
              "finding",
              "standards",
              "low",
              scenario.disposition,
              "/synthetic/auth-config.js:1",
              "AGENTS.md",
              "Synthetic finding for oracle regression",
            ],
          ]
        : []),
      [
        "check",
        "bash test.sh",
        "applicable",
        scenario.check,
        "Synthetic check evidence",
      ],
      ["verdict", scenario.verdict],
      ["risk", "Synthetic risk record"],
      ["next_action", "return control to enclosing goal"],
    ];
    const repo = await buildFixture({
      fixture: {
        commits: [
          {
            message: "Create oracle regression fixture",
            files: { "README.md": "Synthetic review records only.\n" },
          },
        ],
        files: {
          ".git/darrow-review.fixture/result.tsv":
            records.map((row) => row.join("\t")).join("\n") + "\n",
          ...(await reviewFiles()),
          ...(await proofFiles()),
        },
      },
      skillDir: "",
      skillMounts: [],
    });
    try {
      const artifact = await selectedArtifact(
        repo,
        `${repo}/.git/darrow-review.fixture/result.tsv`,
        scenario,
      );
      await Bun.write(
        `${repo}/.git/fixture-state/high-risk-review-proof`,
        `${artifact}\n`,
      );
      const grade = Bun.spawnSync(["/bin/bash", "-c", check!.run], {
        cwd: repo,
      });
      expect(grade.exitCode === 0).toBe(scenario.passes);
      if (scenario.passes)
        expect(grade.stdout.toString()).toContain("valid clear review: /");
    } finally {
      await destroyFixture(repo);
    }
  });
}

for (const scenario of [
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
]) {
  test(`high-risk completion: ${scenario.name}`, async () => {
    const repo = await buildFixture({
      fixture: {
        commits: [{ message: "Initial", files: { "value.txt": "before\n" } }],
        files: {
          ...(await reviewFiles()),
          ...(await proofFiles()),
        },
      },
      skillDir: "",
      skillMounts: [],
    });
    const run = (...args: string[]) =>
      Bun.spawnSync(
        args[0]!.startsWith("review-")
          ? reviewCommand(args[0]!, ...args.slice(1))
          : proofCommand(...args.slice(1)),
        { cwd: repo },
      );
    const scope = () => {
      const result = run(
        "review-scope",
        "prepare",
        "--repo",
        repo,
        "--base",
        "HEAD",
        "--target",
        "WORKTREE",
      );
      expect(result.exitCode).toBe(0);
      return result.stdout.toString().match(/^target\t(.+)$/m)![1]!;
    };
    const serialize = (rows: string[][]) =>
      rows.map((row) => row.join("\t")).join("\n") + "\n";
    try {
      if (scenario.duplicate) {
        await duplicateReview(repo, scenario.conflict);
      }
      await Bun.write(`${repo}/value.txt`, "incorrect change\n");
      const original = scope();
      const finding = [
        "standards",
        "high",
        "blocking",
        `${repo}/value.txt:1`,
        "user request",
        "wrong value",
      ];
      const guidance = fixtureGuidance(scenario);
      const advisory = [
        "spec",
        "low",
        "advisory",
        `${repo}/value.txt:1`,
        "user request",
        "optional clarity",
      ];
      const resultPath = `${repo}/.git/darrow-review.original/result.tsv`;
      if (!scenario.missing)
        await Bun.write(
          resultPath,
          serialize([
            ["format", "darrow-review-result-v1"],
            ["base", "HEAD"],
            ["target", original],
            ["changed_file", `${repo}/value.txt`],
            ["standards", "fail"],
            ["standards_source", "user request"],
            ["spec", "pass"],
            ["spec_source", "user request"],
            ["finding", ...finding, ...guidance],
            ...(scenario.advisory || scenario.omitted
              ? [["finding", ...advisory]]
              : []),
            ["check", "test value", "applicable", "pass", "checked"],
            ["verdict", "fail"],
            ["risk", "incorrect value"],
            ["next_action", "return findings to enclosing goal"],
          ]),
        );
      await Bun.write(`${repo}/value.txt`, "correct change\n");
      const current = scope();
      const key = `standards:1:${original}`;
      const [state, progress, outcome] = repairState(scenario);
      const record = `${repo}/.git/darrow-review.repaired/verification.tsv`;
      await Bun.write(
        record,
        serialize([
          ["format", "darrow-review-verification-v1"],
          ["original_target", original],
          ["prior_target", original],
          ["current_target", current],
          ["previous_verification", "none", "none"],
          [
            "original_finding",
            key,
            finding[0]!,
            "1",
            ...finding.slice(1, -1),
            scenario.forged ? "different original evidence" : finding.at(-1)!,
            ...fixtureGuidance(scenario, true),
          ],
          ...(scenario.advisory
            ? [
                [
                  "original_finding",
                  `spec:2:${original}`,
                  advisory[0]!,
                  "2",
                  ...advisory.slice(1),
                ],
              ]
            : []),
          ["attempt", key, state, progress, "repair evidence"],
          ["check", "test value", "applicable", "pass", "checked"],
          ["outcome", outcome],
          ["next_action", "resume the enclosing goal"],
        ]),
      );
      // Every negative is a valid public artifact: rejection must be the gate's
      // outcome, current-content, or original-evidence check, not bad test TSV.
      expect(
        run("review-result", "validate-verification", record).exitCode,
      ).toBe(0);
      if (scenario.stale)
        await Bun.write(`${repo}/value.txt`, "changed after review\n");
      const artifact = await selectedArtifact(repo, record, scenario);
      const result = run("fixture-proof", "complete", artifact);
      expect({
        passes: result.exitCode === 0,
        detail: result.stderr.toString(),
      }).toMatchObject({ passes: scenario.passes });
      expect(await Bun.file(`${repo}/.git/goal-complete`).exists()).toBe(
        scenario.passes,
      );
      if (scenario.passes) {
        expect(run("fixture-proof", "artifact").exitCode).toBe(0);
        expect(run("fixture-proof", "current").exitCode).toBe(0);
        await Bun.write(`${repo}/value.txt`, "changed after completion\n");
        expect(run("fixture-proof", "current").exitCode).not.toBe(0);
      }
    } finally {
      await destroyFixture(repo);
    }
  }, 30_000);
}
