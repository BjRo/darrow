import { expect, test } from "bun:test";
import { parse } from "yaml";
import {
  fixtureExtensionRequest,
  readFixtureCase,
  runFixtureChecks,
} from "./fixture-command";

const source = new URL(
  "../../plugins/capability/darrow-matt-pocock/skills/implement/evals/missing-owner.yaml",
  import.meta.url,
);

for (const scenario of ["unchanged", "edited", "committed"] as const) {
  test(`missing-owner oracle distinguishes ${scenario} work`, async () => {
    const canonical = await readFixtureCase(source);
    const actions =
      scenario === "unchanged"
        ? []
        : [
            {
              name: "simulate unauthorized implementation",
              run: "printf '# Notes\\nShared implementation works.\\n' > NOTES.md",
            },
            ...(scenario === "committed"
              ? [
                  {
                    name: "simulate unauthorized commit",
                    run: "git add NOTES.md && git commit -m 'docs: change notes'",
                  },
                ]
              : []),
          ];
    const result = await runFixtureChecks({
      source,
      checks: [...actions, ...canonical.checks],
    });
    expect(result.value.execution.status).toBe("completed");
    expect(result.checks.at(-1)?.status).toBe(
      scenario === "unchanged" ? "passed" : "failed",
    );
  }, 30000);
}

const localSource = new URL(
  "../../plugins/capability/darrow-matt-pocock/skills/implement/evals/approved-local.yaml",
  import.meta.url,
);

for (const scenario of [
  "local",
  "published",
  "nonconventional",
  "unreviewed",
  "coordinator-assessed",
] as const) {
  const commitSubject =
    scenario === "nonconventional"
      ? "Support named greetings"
      : "feat: greet the requested name";
  const commitStatus = scenario === "nonconventional" ? "failed" : "passed";
  const reviewStatus =
    scenario === "unreviewed" || scenario === "coordinator-assessed"
      ? "failed"
      : "passed";
  test(`approved-local oracle distinguishes ${scenario} result`, async () => {
    const canonical = await readFixtureCase(localSource);
    const result = await runFixtureChecks({
      source: localSource,
      checks: [
        {
          name: "implement known-good public behavior and regression",
          run: 'printf \'#!/bin/sh\\nprintf "Hello %%s\\\\n" "$1"\\n\' > greet.sh && printf \'\\ntest "$(bash greet.sh Bob)" = "Hello Bob"\\n\' >> test.sh',
        },
        ...(scenario === "unreviewed"
          ? []
          : [
              {
                name: "prepare valid independent-provider evidence",
                run: "independent-review-protocol && independent-review-protocol",
              },
            ]),
        ...(scenario === "coordinator-assessed"
          ? [
              {
                name: "simulate forbidden coordinator assessment",
                run: "independent-review-protocol",
              },
            ]
          : []),
        ...(scenario === "local"
          ? [
              {
                name: "reconcile target without assessing",
                run: "independent-review-protocol --target",
              },
            ]
          : []),
        {
          name: "simulate local commit",
          run: `git add greet.sh test.sh && git commit -m '${commitSubject}'`,
        },
        ...(scenario === "published"
          ? [
              {
                name: "simulate unauthorized push",
                run: "git push origin HEAD",
              },
            ]
          : []),
        ...canonical.checks,
      ],
    });
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.task.verdict).toBe(
      scenario === "local" ? "passed" : "failed",
    );
    expect(
      result.checks.find(
        (c) => c.name === "one scoped local conventional commit and clean tree",
      )?.status,
    ).toBe(commitStatus);
    expect(
      result.checks.find((c) => c.name === "no push or forge effect")?.status,
    ).toBe(scenario === "published" ? "failed" : "passed");
    expect(
      result.checks.find(
        (c) =>
          c.name ===
          "both independent readers examined the committed candidate",
      )?.status,
    ).toBe(reviewStatus);
  }, 30000);
}

test("implementation composition prepares both native host fixtures", async () => {
  for (const host of ["codex", "claude"]) {
    const resolved = await fixtureExtensionRequest<{ cases: unknown[] }>(
      "resolve",
      {
        projectRoot: new URL("../../", import.meta.url).href,
        selectors: {
          caseIds: [
            host === "codex"
              ? "implement-approved-local"
              : "implement-approved-local-claude",
          ],
        },
        configuration: {},
      },
    );
    expect(resolved.cases).toHaveLength(1);
    const prepared = await fixtureExtensionRequest<{
      artifacts: { relativePath: string }[];
    }>("prepare", {
      case: resolved.cases[0],
      host: {
        id: `sevro.host.${host}`,
        capabilities:
          host === "codex"
            ? [
                "sevro.codex.plugin-marketplace",
                "sevro.codex.explicit-invocation",
              ]
            : ["sevro.claude.plugin-dirs", "sevro.claude.explicit-invocation"],
      },
      condition: "passive",
      configuration: {},
    });
    expect(
      prepared.artifacts.some((a) =>
        a.relativePath.endsWith("/skills/implement/SKILL.md"),
      ),
    ).toBe(true);
  }
}, 30000);

test("Claude native kickoff preserves the same approved repository fixture", async () => {
  const local = await readFixtureCase(localSource);
  const claudeSource = new URL(
    "../../plugins/capability/darrow-matt-pocock/skills/implement/evals/approved-local-claude.yaml",
    import.meta.url,
  );
  const claude = await readFixtureCase(claudeSource);
  expect(claude.fixture).toEqual(local.fixture);
  const kickoff = parse(await Bun.file(claudeSource).text());
  expect(kickoff.additional_plugins).not.toContain(
    "plugins/capability/darrow-git",
  );
  expect(kickoff.follow_up_prompt).toContain("native Git");
  expect(kickoff.follow_up_prompt).not.toContain("bound Git capability");
});

test("read-only target inquiry succeeds without assessment or review receipts", async () => {
  const result = await runFixtureChecks({
    source: localSource,
    checks: [
      {
        name: "query target while the requested behavior is still missing",
        run: "independent-review-protocol --target",
        expect_regex:
          "^WORKTREE@[0-9a-f]{40}\\+e69de29bb2d1d6434b8b29ae775ad8c2e48c5391\\n$",
      },
      {
        name: "target query creates no assessment or Git effect",
        run: 'test ! -e .fixture-state/reviews && test -z "$(git status --porcelain)" && test "$(git rev-list --count HEAD)" = 1',
      },
    ],
  });
  expect(result.checks[0]?.status, JSON.stringify(result.checks)).toBe(
    "passed",
  );
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((check) => check.status)).toEqual([
    "passed",
    "passed",
  ]);
}, 30000);
