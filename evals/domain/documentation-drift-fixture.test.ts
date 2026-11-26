import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { captureTestCommand } from "../test-command";

const cases = new URL(
  "../../plugins/task-recipe/darrow-documentation-drift/skills/documentation-drift/evals/",
  import.meta.url,
);
const fixtures = fileURLToPath(new URL("fixtures/", cases));
const equivalent = parse(
  await Bun.file(new URL("reworded-equivalent.yaml", cases)).text(),
) as { checks: { name: string; run: string }[] };
const coverage = equivalent.checks.find(
  (check) => check.name === "complete relevant issue pages were returned",
)!.run;

const riskCase = parse(
  await Bun.file(new URL("high-risk-repair.yaml", cases)).text(),
) as { checks: { name: string; run: string }[] };
const reviewedIssues = riskCase.checks.find((check) =>
  /exact candidate|every created/.test(check.name),
)!.run;

const reviewScenarios = [
  { name: "valid", before: [0, 1], after: [] },
  { name: "stale", before: [2], after: [] },
  { name: "omitted", before: [], after: [] },
  { name: "one missing", before: [0], after: [] },
  { name: "late", before: [], after: [0, 1] },
];

for (const { name, before, after } of reviewScenarios) {
  test(`published draft review oracle: ${name}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "documentation-drift-review-"));
    try {
      const options = { cwd: root };
      await captureTestCommand(["git", "init", "-q"], undefined, options);
      await captureTestCommand(["mkdir", ".fixture-state"], undefined, options);
      const bodies = [
        "Offline availability remains supported on every plan. Correct the paid prerequisite; preserve the disabled default.\n",
        "No paid upgrade is needed. Offline availability remains supported on every plan. Verify the second document.\n",
      ];
      const digests: string[] = [];
      for (const body of bodies) {
        await Bun.write(join(root, "draft.md"), body);
        const hash = await captureTestCommand(
          ["git", "hash-object", "draft.md"],
          undefined,
          options,
        );
        digests.push(hash.stdout.trim());
      }
      digests.push("old-draft");
      const reviewPath = join(root, ".fixture-state/reviewed-drafts");
      const reviewHistory = (cleared: number[]) =>
        [
          "old-draft finding-open entitlement",
          ...cleared.map((index) => `${digests[index]} resolved-cleared`),
          "",
        ].join("\n");
      if (before.length) await Bun.write(reviewPath, reviewHistory(before));
      for (const body of bodies) {
        await Bun.write(join(root, "draft.md"), body);
        const filed = await captureTestCommand(
          [
            "bash",
            join(fixtures, "gh"),
            "issue",
            "create",
            "--repo",
            "fixture/manual",
            "--title",
            "Correct offline access",
            "--body-file",
            "draft.md",
          ],
          undefined,
          options,
        );
        expect(filed.exitCode, filed.stderr).toBe(0);
      }
      if (after.length) await Bun.write(reviewPath, reviewHistory(after));
      const result = await captureTestCommand(
        ["bash", "-c", reviewedIssues],
        undefined,
        options,
      );
      expect(result.exitCode).toBe(name === "valid" ? 0 : 1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

const query = "repos/fixture/manual/issues?state=open&per_page=100";
const traversals = [
  {
    name: "automatic",
    commands: [["api", "--paginate", query]],
    complete: true,
  },
  {
    name: "explicit pages",
    commands: [
      ["api", `${query}&page=1`],
      ["api", `${query}&page=2`],
    ],
    complete: true,
  },
  {
    name: "explicit smaller pages",
    commands: [1, 2, 3].map((page) => [
      "api",
      `repos/fixture/manual/issues?state=open&per_page=50&page=${page}`,
    ]),
    complete: true,
  },
  {
    name: "sufficient limit 200",
    commands: [["issue", "list", "--repo", "fixture/manual", "--limit", "200"]],
    complete: true,
  },
  {
    name: "sufficient equals limit",
    commands: [["issue", "list", "--repo", "fixture/manual", "--limit=200"]],
    complete: true,
  },
  {
    name: "sufficient short limit",
    commands: [["issue", "list", "--repo", "fixture/manual", "-L200"]],
    complete: true,
  },
  {
    name: "insufficient limit 50",
    commands: [["issue", "list", "--repo", "fixture/manual", "--limit", "50"]],
    complete: false,
  },
  {
    name: "insufficient equals limit",
    commands: [["issue", "list", "--repo", "fixture/manual", "--limit=100"]],
    complete: false,
  },
  {
    name: "default limit",
    commands: [["issue", "list", "--repo", "fixture/manual"]],
    complete: false,
  },
  {
    name: "incomplete API page",
    commands: [["api", `${query}&page=1`]],
    complete: false,
  },
];

for (const shell of ["bash", "/bin/bash"]) {
  for (const traversal of traversals) {
    test(`${shell}: ${traversal.name} reports actual issue coverage`, async () => {
      const root = await mkdtemp(join(tmpdir(), "documentation-drift-pages-"));
      const options = { cwd: root };
      try {
        expect(
          (await captureTestCommand(["git", "init", "-q"], undefined, options))
            .exitCode,
        ).toBe(0);
        const setup = await captureTestCommand(
          [shell, join(fixtures, "setup.sh"), fixtures, "equivalent"],
          undefined,
          options,
        );
        expect(setup.exitCode, setup.stderr).toBe(0);
        let matchingIssueReturned = false;
        for (const command of traversal.commands) {
          const response = await captureTestCommand(
            [shell, join(fixtures, "gh"), ...command],
            undefined,
            options,
          );
          expect(response.exitCode, response.stderr).toBe(0);
          const issues = JSON.parse(response.stdout) as { number: number }[];
          matchingIssueReturned ||= issues.some(
            (issue) => issue.number === 101,
          );
        }
        expect(matchingIssueReturned).toBe(traversal.complete);
        const result = await captureTestCommand(
          [shell, "-c", coverage],
          undefined,
          options,
        );
        expect(result.exitCode).toBe(traversal.complete ? 0 : 1);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
}
