import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveCase } from "../sevro-extension/index";
import { expect, test } from "bun:test";
import {
  fixtureExtensionRequest,
  readFixtureCase,
  runFixtureChecks,
} from "./fixture-command";
import { gitPluginFixtureFiles } from "./fixture-git-plugin";
import { prepareUvFixtureRuntime } from "./fixture-runtime";
import { activationReceipt } from "./policy-project";

const plugin = new URL(
  "../../plugins/task-recipe/darrow-ticket-to-pr/",
  import.meta.url,
);
const cases = new URL("skills/ticket-to-pr/evals/", plugin);

test("unavailable orchestration oracle accepts the advertised name and rejects missing boundary evidence", async () => {
  const source = new URL("adaptive-goal-unavailable.yaml", cases);
  const canonical = await readFixtureCase(source);
  for (const [finalMessage, passes] of [
    [
      "Status: launch_required. I could not find a host-advertised Adaptive Goal orchestration skill. Native goal controls alone do not meet that boundary.",
      true,
    ],
    [
      "Status: launch_required. The adaptive-goal capability is unavailable.",
      true,
    ],
    ["Status: launch_required. Supply a ticket reference.", false],
    ["The Adaptive Goal capability is available; work will continue.", false],
  ] as const) {
    const result = await runFixtureChecks({
      source,
      checks: [],
      outputChecks: canonical.output_checks,
      finalMessage,
    });
    expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
    expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
  }
}, 20_000);

function assertPassed(result: Awaited<ReturnType<typeof runFixtureChecks>>) {
  expect(
    result.exitCode,
    `${result.diagnostic}\nChecks: ${JSON.stringify(result.checks)}`,
  ).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.every((check) => check.status === "passed")).toBe(true);
}

test("composition records only successful UV publication", async () => {
  const source = new URL("composition-existing-pr.yaml", cases);
  const { fixture } = await readFixtureCase(source);
  const runtime = await prepareUvFixtureRuntime();
  fixture.files = {
    ...fixture.files,
    ...(await gitPluginFixtureFiles()),
    ".fixture-uv": runtime.bin.uv!,
  };
  fixture.bin = { ...fixture.bin, ...runtime.bin };
  fixture.setup = `${runtime.setupPrefix}\n${fixture.setup ?? ""}\nmv .fixture-plugin .git/eval-plugin\nmv .fixture-uv .git/eval-plugin/fixture-uv\nchmod +x .git/eval-plugin/fixture-uv\nprintf '%s\\n' "$PWD/.git/eval-plugin/fixture-uv" >.git/fixture-bin/uv-command\nuv sync --quiet --frozen --no-dev --project .git/eval-plugin/backend`;
  const command =
    "uv run --quiet --frozen --no-dev --project .git/eval-plugin/backend darrow-create-pr";
  const result = await runFixtureChecks({
    source,
    fixture,
    fixtureAssets: plugin,
    checks: [
      {
        name: "inspection is not publication",
        run: `${command} inspect && test ! -e .fixture-state/builtin-publications`,
      },
      {
        name: "stale remote refuses verification",
        run: `${command} verify --expected-head "$(git rev-parse HEAD)"`,
        exit_code: 4,
      },
      {
        name: "failure is not evidence",
        run: "test ! -e .fixture-state/builtin-publications",
      },
      {
        name: "publish current commit",
        run: `${command} publish-existing --expected-head "$(git rev-parse HEAD)"`,
      },
      {
        name: "verify current commit",
        run: `${command} verify --expected-head "$(git rev-parse HEAD)"`,
      },
      {
        name: "exact successful observations",
        run: 'test "$(wc -l < .fixture-state/builtin-publications | tr -d " ")" = 2 && test "$(sort -u .fixture-state/builtin-publications)" = "$(git rev-parse HEAD)" && test ! -e .fixture-state/forbidden-forge-effects',
      },
    ],
  });
  assertPassed(result);
}, 30_000);

test("ticket-to-pr options oracle preserves a stricter caller repair limit", async () => {
  const source = new URL("explicit-options-delegation.yaml", cases);
  const { fixture, checks } = await readFixtureCase(source);
  const check = checks[0];
  if (!check) throw new Error("canonical explicit-options oracle is missing");
  const record =
    "record-ticket-to-pr-options https://example.invalid/tickets/99 release/2.x draft";
  const result = await runFixtureChecks({
    source,
    fixture: { commits: fixture.commits, bin: fixture.bin },
    checks: [
      { name: "missing repair limit is rejected", run: record, exit_code: 1 },
      {
        name: "default cannot replace explicit limit",
        run: `${record} 2 && (${check.run})`,
        exit_code: 1,
      },
      {
        name: "omitted caller limit fails the oracle",
        run: `${record} unspecified && (${check.run})`,
        exit_code: 1,
      },
      { name: "explicit limit is accepted", run: `${record} 1` },
      check,
      {
        name: "changed receipt fails the oracle",
        run: `printf '%s\\t%s\\t%s\\t%s\\n' https://example.invalid/tickets/99 release/2.x draft 2 >.fixture-state/ticket-to-pr-options && (${check.run})`,
        exit_code: 1,
      },
    ],
  });
  assertPassed(result);
}, 20_000);

test("unattended handoff recorder and oracle require the exact ticket", async () => {
  const source = new URL("unattended-grant.yaml", cases);
  const { fixture, checks } = await readFixtureCase(source);
  const oracle = checks[1];
  if (!oracle)
    throw new Error("canonical unattended receipt oracle is missing");
  const receipt =
    "unattended recurring grant grant-157 grantor maintainer repository fixture/repo " +
    "delivery delivery-157 activation activation-157 reserved worktree /fixture/worktree-157 " +
    "branch feat/157-existing effects claims,questions,worktrees,recipe,commits,push,pr,archives; " +
    "not authorized: merge, deploy, release, ticket mutation, destructive Git operations, " +
    "unrelated changes, generic comments or any other external effect";
  const result = await runFixtureChecks({
    source,
    fixture,
    checks: [
      {
        name: "recorder is an executable shell command",
        run: "command -v record-unattended-request",
      },
      {
        name: "missing exact ticket fails the oracle",
        run: `record-unattended-request '${receipt}' && (${oracle.run})`,
        exit_code: 1,
      },
      {
        name: "wrong exact ticket fails the oracle",
        run: `record-unattended-request '${receipt} https://github.com/fixture/repo/issues/158' && (${oracle.run})`,
        exit_code: 1,
      },
      {
        name: "longer issue number fails the oracle",
        run: `record-unattended-request '${receipt} https://github.com/fixture/repo/issues/1570' && (${oracle.run})`,
        exit_code: 1,
      },
      {
        name: "suffixed URL fails the oracle",
        run: `record-unattended-request '${receipt} https://github.com/fixture/repo/issues/157/comments' && (${oracle.run})`,
        exit_code: 1,
      },
      {
        name: "complete exact-ticket receipt passes",
        run: `record-unattended-request '${receipt} https://github.com/fixture/repo/issues/157' && (${oracle.run})`,
      },
      {
        name: "exact ticket with prose punctuation passes",
        run: `record-unattended-request '${receipt} Deliver (https://github.com/fixture/repo/issues/157).' && (${oracle.run})`,
      },
    ],
  });
  assertPassed(result);
}, 20_000);

test.each(["bash", "/bin/bash"])(
  "feedback fixture validates branch creation without consuming it (%s)",
  async (shell) => {
    const source = new URL("feedback-relay.yaml", cases);
    const { fixture, checks } = await readFixtureCase(source);
    const runtime = await prepareUvFixtureRuntime(true);
    fixture.bin = { ...fixture.bin, ...runtime.bin };
    const branchCheck = checks[3];
    if (!branchCheck) throw new Error("feedback branch oracle is missing");
    const create = `${shell} .git/fixture-bin/fixture-create-branch`;
    const result = await runFixtureChecks({
      source,
      fixture,
      fixtureAssets: plugin,
      checks: [
        {
          name: "authoritative ticket is read",
          run: "fixture-read-ticket https://example.invalid/tickets/42",
        },
        {
          name: "first readiness assessment succeeds",
          run: "fixture-readiness https://example.invalid/tickets/42",
        },
        {
          name: "additional read-only readiness assessment succeeds",
          run: "fixture-readiness https://example.invalid/tickets/42",
        },
        {
          name: "retain initial branch state",
          run: "git for-each-ref --format='%(refname) %(objectname)' refs/heads >.fixture-state/branches-before",
        },
        {
          name: "the observed lowercase ticket name explains the valid format",
          run: `${create} dar-42-strict-migration-policy 2>&1`,
          exit_code: 5,
          expect_regex: "Invalid branch name: expected <type>/DAR-42-",
        },
        {
          name: "the observed missing type is rejected before mutation",
          run: `${shell} .git/fixture-bin/fixture-prepare-branch DAR-42-strict-migration-policy 2>&1`,
          exit_code: 5,
          expect_regex: "Invalid branch name",
        },
        {
          name: "another ticket branch is rejected",
          run: `${create} feat/DAR-99-migration 2>&1`,
          exit_code: 5,
        },
        {
          name: "repeated ticket ID is rejected",
          run: `${create} feat/DAR-42-DAR-42-migration 2>&1`,
          exit_code: 5,
        },
        {
          name: "unsupported conventional type is rejected",
          run: `${create} feature/DAR-42-migration 2>&1`,
          exit_code: 5,
        },
        {
          name: "overlong name is rejected",
          run: `suffix=$(printf '%049d' 0); ${create} "feat/DAR-42-$suffix" 2>&1`,
          exit_code: 5,
        },
        {
          name: "invalid input leaves branches and product state unchanged",
          run: "git for-each-ref --format='%(refname) %(objectname)' refs/heads >.fixture-state/branches-after && cmp .fixture-state/branches-before .fixture-state/branches-after && test \"$(git branch --show-current)\" = main && test ! -e .fixture-state/branch-invocations && git diff --exit-code",
        },
        {
          name: "prepare a known existing branch for refusal",
          run: "git branch feat/DAR-42-existing",
        },
        {
          name: "creation refuses an existing branch instead of reusing it",
          run: `${create} feat/DAR-42-existing 2>&1`,
          exit_code: 1,
          expect_regex: "Safety refusal: the requested branch already exists",
        },
        {
          name: "existing-branch refusal preserves the active checkout",
          run: 'test "$(git branch --show-current)" = main && test ! -e .fixture-state/branch-invocations && test "$(git rev-parse feat/DAR-42-existing)" = "$(git rev-parse HEAD)"',
        },
        {
          name: "decision is discovered and exact answer acknowledged",
          run: "decisionctl discover && decisionctl acknowledge migration-policy 'Use the strict migration policy. Approval reference: cobalt-7391.'",
        },
        {
          name: "valid corrected input creates the intended branch",
          run: `${create} feat/DAR-42-migration-policy`,
        },
        {
          name: "another successful preparation is refused",
          run: `${create} fix/DAR-42-other 2>&1`,
          exit_code: 1,
          expect_regex: "Safety refusal: a branch was already prepared",
        },
        {
          name: "refusal does not create another branch or receipt",
          run: 'test "$(git branch --show-current)" = feat/DAR-42-migration-policy && test "$(cat .fixture-state/branch-invocations)" = feat/DAR-42-migration-policy && ! git show-ref --verify --quiet refs/heads/fix/DAR-42-other',
        },
        {
          name: "scoped implementation is committed and published",
          run: "printf '%s\\n' 'export const identity = (value) => value;' 'export const migrationMode = () => \"strict\";' >src/migration.js && fixture-create-commit && fixture-create-pr && bash .git/fixture-bin/fixture-ci \"$(git rev-parse HEAD)\"",
        },
        ...checks,
        {
          name: "changed selected branch fails the canonical binding check",
          run: `printf '%s\\n' feat/DAR-42-other >.fixture-state/branch-invocations && (${branchCheck.run})`,
          exit_code: 1,
        },
      ],
    });
    assertPassed(result);
  },
  20_000,
);

for (const variant of ["existing-pr", "replacement"]) {
  test(`composition ${variant} ticket and oracle agree on trailing newlines`, async () => {
    const source = new URL(`composition-${variant}.yaml`, cases);
    const { fixture } = await readFixtureCase(source);
    const result = await runFixtureChecks({
      source,
      fixture: { commits: fixture.commits, bin: fixture.bin },
      checks: [
        {
          name: "ticket states the oracle's newline policy",
          run: "fetch-work-item https://example.invalid/tickets/42",
          expect_regex: "Trailing newlines are insignificant",
        },
        {
          name: "exact content without a newline passes",
          run: `printf '%s' '{"timeoutMs":2500}' >config.json && bash check.sh`,
        },
        {
          name: "exact content with trailing newlines passes",
          run: `printf '%s\\n\\n' '{"timeoutMs":2500}' >config.json && bash check.sh`,
        },
        {
          name: "wrong value remains rejected",
          run: `printf '%s\\n' '{"timeoutMs":2501}' >config.json && bash check.sh`,
          exit_code: 1,
        },
        {
          name: "extra content remains rejected",
          run: `printf '%s\\n' '{"timeoutMs":2500}' 'extra' >config.json && bash check.sh`,
          exit_code: 1,
        },
      ],
    });
    assertPassed(result);
  }, 20_000);
}

test("Ticket publication reads belong to the retained main thread", async () => {
  for (const id of [
    "ticket-to-pr-composition-existing-pr",
    "ticket-to-pr-composition-replacement",
  ]) {
    const { cases } = await resolveCase({
      projectRoot: pathToFileURL(resolve(import.meta.dir, "../..")).href,
      selectors: { caseIds: [id] },
    });
    const selected = cases[0]!;
    const details = selected.extensionData["darrow.case"] as {
      transcriptChecks: { kind: string; skill?: string }[];
    };
    const check = details.transcriptChecks.find(
      (x) => x.skill === "create-pr" || x.skill === "ship-proposal",
    );
    expect(check?.kind).toBe("supporting-skill-read");
    const observation = activationReceipt([check!.skill!]);
    const grade = async (observations: unknown[]) => {
      const result = await fixtureExtensionRequest<{
        checks: { status: string }[];
      }>("evaluate", {
        extensionData: {
          "darrow.case": { transcriptChecks: [{ ...check, id: "publisher" }] },
        },
        observations,
      });
      return result.checks[0]!.status;
    };
    expect(await grade([observation])).toBe("passed");
    expect(
      await grade([
        {
          ...observation,
          data: { ...observation.data, primarySkill: null, observedSkills: [] },
        },
      ]),
    ).toBe("failed");
    expect(
      await grade([
        {
          ...observation,
          data: {
            ...observation.data,
            primarySkill: "unrelated",
            observedSkills: ["unrelated"],
          },
        },
      ]),
    ).toBe("failed");
    for (const observations of [
      [],
      [observation, observation],
      [{ ...observation, completeness: "partial" }],
      [{ ...observation, source: "other" }],
    ])
      expect(await grade(observations)).toBe("unavailable");
  }
}, 30_000);
