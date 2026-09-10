import { expect, test } from "bun:test";
import { parse } from "yaml";
import { gradeActivation, validateActivationCase } from "./activation";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/high-risk-routine.yaml",
  import.meta.url,
);
const validatorSource = new URL(
  "../../plugins/capability/darrow-review/bin/review-result",
  import.meta.url,
);
const proofSource = new URL("fixtures/require-clear-review.sh", source);
const scopeSource = new URL("review-scope", validatorSource);

test("high-risk composition requires the supporting review body read", async () => {
  const evalCase = parse(await Bun.file(source).text()) as EvalCase;
  evalCase.owningSkillName = "adaptive-delivery";
  evalCase.skillDir = new URL("..", source).pathname;
  expect(validateActivationCase(evalCase)).toEqual([]);
  expect(evalCase.activation).toBe("positive");
  for (const [skills, passed] of [
    [["adaptive-delivery", "code-review"], true],
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
      { sequence: evalCase.activation_sequence },
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

for (const scenario of [
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
          ".git/review-plugin/bin/review-result":
            await Bun.file(validatorSource).text(),
          ".git/fixture-bin/review-proof": await Bun.file(proofSource).text(),
        },
      },
      skillDir: "",
      skillMounts: [],
    });
    try {
      await Bun.write(
        `${repo}/.git/fixture-state/high-risk-review-proof`,
        `${repo}/.git/darrow-review.fixture/result.tsv\n`,
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
  { name: "linked clear repair", passes: true },
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
          ".git/review-plugin/bin/review-result":
            await Bun.file(validatorSource).text(),
          ".git/review-plugin/bin/review-scope":
            await Bun.file(scopeSource).text(),
          ".git/fixture-bin/review-proof": await Bun.file(proofSource).text(),
        },
      },
      skillDir: "",
      skillMounts: [],
    });
    const run = (...args: string[]) =>
      Bun.spawnSync(["/bin/bash", ...args], { cwd: repo });
    const scope = () => {
      const result = run(
        ".git/review-plugin/bin/review-scope",
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
        await Bun.write(
          `${repo}/.git/plugin-cache/bin/review-result`,
          await Bun.file(validatorSource).text(),
        );
        await Bun.write(
          `${repo}/.git/plugin-cache/bin/review-scope`,
          scenario.conflict ? "exit 1\n" : await Bun.file(scopeSource).text(),
        );
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
            ["finding", ...finding],
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
        run(
          ".git/review-plugin/bin/review-result",
          "validate-verification",
          record,
        ).exitCode,
      ).toBe(0);
      if (scenario.stale)
        await Bun.write(`${repo}/value.txt`, "changed after review\n");
      const result = run(".git/fixture-bin/review-proof", "complete", record);
      expect({
        passes: result.exitCode === 0,
        detail: result.stderr.toString(),
      }).toMatchObject({ passes: scenario.passes });
      expect(await Bun.file(`${repo}/.git/goal-complete`).exists()).toBe(
        scenario.passes,
      );
      if (scenario.passes) {
        expect(run(".git/fixture-bin/review-proof", "artifact").exitCode).toBe(
          0,
        );
        expect(run(".git/fixture-bin/review-proof", "current").exitCode).toBe(
          0,
        );
        await Bun.write(`${repo}/value.txt`, "changed after completion\n");
        expect(
          run(".git/fixture-bin/review-proof", "current").exitCode,
        ).not.toBe(0);
      }
    } finally {
      await destroyFixture(repo);
    }
  });
}
