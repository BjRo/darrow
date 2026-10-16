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

const plugin = new URL(
  "../../plugins/task-recipe/darrow-ticket-to-pr/",
  import.meta.url,
);
const cases = new URL("skills/ticket-to-pr/evals/", plugin);

function assertPassed(result: Awaited<ReturnType<typeof runFixtureChecks>>) {
  expect(result.exitCode, result.diagnostic).toBe(0);
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
    const observation = {
      id: "sevro.codex.skill-reads",
      source: "sevro.host.codex",
      completeness: "complete",
      data: {
        method: "skill_file_read_probe",
        primarySkill: check!.skill,
        observedSkills: [check!.skill],
      },
    };
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
