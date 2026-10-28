import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import {
  reviewOutputCheck,
  reviewOutputOutcomes,
  reviewOutputPolicy,
} from "../sevro-extension/review-output";
import { fixtureExtensionRequest, readFixtureCase } from "./fixture-command";

const cases = new URL(
  "../../plugins/capability/darrow-review/skills/code-review/evals/",
  import.meta.url,
);
const finalId = "sevro.observation.final-message";
const canonicalId = "sevro.observation.shell.darrow.shell.1";
const human = reviewOutputPolicy({
  checks: [],
  output_checks: [{ name: "human", review_format: "human" }],
});
const machine = reviewOutputPolicy({
  checks: [{ name: "canonical", expect_regex: "^\\{" }],
  output_checks: [
    { name: "machine", review_format: "machine", canonical_check: "canonical" },
  ],
});
function message(text: string) {
  return {
    id: finalId,
    source: "sevro.host.codex",
    completeness: "complete",
    data: { text },
  };
}
function canonical(text: string) {
  return {
    id: canonicalId,
    source: "sevro.shell",
    completeness: "complete",
    data: {
      exitCode: 0,
      expectedExitCode: 0,
      stdoutSha256: createHash("sha256").update(text).digest("hex"),
      stdoutByteLength: Buffer.byteLength(text),
    },
  };
}

test("Review shell checks have no retired response-file dependency", async () => {
  for (const name of await readdir(cases)) {
    if (!name.endsWith(".yaml")) continue;
    const selected = await readFixtureCase(new URL(name, cases));
    for (const check of selected.checks)
      expect(check.run, `${name}: ${check.name}`).not.toContain(
        ".git/last-message.md",
      );
  }
});

test("human output accepts ordinary Markdown and rejects appended machine records", () => {
  const check = human.details.reviewOutputChecks;
  for (const text of [
    "Review failed: restore parseName's guard.",
    'Review passed for darrow-review-result-v3. Example `{"count":2}`; malformed `{text}`.',
    'Ordinary braces { and {"format":"darrow-review-result-v3" without a JSON object.',
  ])
    expect(reviewOutputOutcomes(check, [message(text)])[0]!.status).toBe(
      "passed",
    );
  for (const format of ["result", "verification"]) {
    const record = JSON.stringify({
      format: `darrow-review-${format}-v3`,
      evidence: 'brace } and quote "',
    });
    for (const text of [
      record,
      `Review failed.\n${record}`,
      `Review failed.\n\n\`\`\`json\n${record}\n\`\`\``,
      JSON.stringify({ nested: JSON.parse(record) }),
    ])
      expect(reviewOutputOutcomes(check, [message(text)])[0]!.status).toBe(
        "failed",
      );
  }
});

test("machine output preserves every canonical value while ignoring object order and whitespace", () => {
  const record = {
    format: "darrow-review-result-v3",
    findings: [{ evidence: "é 😀\nline", severity: "high" }],
    target: "current",
  };
  const normalized =
    '{"findings":[{"evidence":"é 😀\\nline","severity":"high"}],"format":"darrow-review-result-v3","target":"current"}\n';
  const output = machine.details.reviewOutputChecks;
  const evidence = canonical(normalized);
  for (const text of [
    JSON.stringify(record),
    JSON.stringify(record, null, 2),
    `\n ${JSON.stringify(record)}\n`,
  ])
    expect(
      reviewOutputOutcomes(output, [message(text), evidence])[0]!.status,
    ).toBe("passed");
  for (const text of [
    JSON.stringify({ ...record, target: "stale" }),
    JSON.stringify({ ...record, findings: [] }),
    JSON.stringify({ ...record, extra: "invented" }),
    "{}",
    "not JSON",
    `\`\`\`json\n${JSON.stringify(record)}\n\`\`\``,
  ])
    expect(
      reviewOutputOutcomes(output, [message(text), evidence])[0]!.status,
    ).toBe("failed");
});

test("machine equality preserves array order", () => {
  const text =
    '{"findings":["first","second"],"format":"darrow-review-result-v3"}\n';
  const reversed =
    '{"format":"darrow-review-result-v3","findings":["second","first"]}';
  expect(
    reviewOutputOutcomes(machine.details.reviewOutputChecks, [
      message(reversed),
      canonical(text),
    ])[0]!.status,
  ).toBe("failed");
});

test("missing, duplicate, partial, foreign and failed evidence cannot pass", () => {
  const final = message('{"format":"darrow-review-result-v3"}');
  const retained = canonical('{"format":"darrow-review-result-v3"}\n');
  for (const evidence of [
    [],
    [final],
    [retained],
    [final, final, retained],
    [final, retained, retained],
    [{ ...final, completeness: "partial" }, retained],
    [{ ...final, source: "foreign.host" }, retained],
    [final, { ...retained, source: "foreign.shell" }],
    [final, { ...retained, completeness: "partial" }],
    [final, { ...retained, data: { ...retained.data, exitCode: 1 } }],
    [
      final,
      { ...retained, data: { ...retained.data, stdoutSha256: "invalid" } },
    ],
    [final, { ...retained, data: { ...retained.data, stdoutByteLength: 0 } }],
  ])
    expect(
      reviewOutputOutcomes(machine.details.reviewOutputChecks, evidence)[0]!
        .status,
    ).toBe("unavailable");
  expect(
    reviewOutputOutcomes(human.details.reviewOutputChecks, [
      { ...final, data: {} },
    ])[0]!.status,
  ).toBe("unavailable");
});

test("Review output declarations refuse incomplete or conflicting contracts", () => {
  for (const entry of [
    { review_format: "other" },
    { review_format: "human", canonical_check: "canonical" },
    { review_format: "machine" },
    { review_format: "human", not_regex: "pattern" },
  ])
    expect(() => reviewOutputCheck(entry, 0)).toThrow();
  for (const checks of [
    [],
    [{ name: "canonical" }],
    [
      { name: "canonical", expect_regex: "^" },
      { name: "canonical", expect_regex: "^" },
    ],
  ])
    expect(() =>
      reviewOutputPolicy({
        checks,
        output_checks: [
          { review_format: "machine", canonical_check: "canonical" },
        ],
      }),
    ).toThrow();
  expect(reviewOutputPolicy({ checks: [] }).requiredEvidence).toEqual([]);
});

test("the public extension resolves and grades migrated machine output checks", async () => {
  const resolved = await fixtureExtensionRequest<{
    cases: {
      checks: { id: string; grader: string }[];
      extensionData: Record<string, unknown>;
      requiredEvidence: string[];
    }[];
  }>("resolve", {
    projectRoot: new URL("../../", import.meta.url).href,
    selectors: { caseIds: ["code-review-presentation-machine-v1"] },
    configuration: {},
  });
  const selected = resolved.cases[0]!;
  expect(
    selected.checks.some(
      (check) => check.grader === "darrow.evals.review-output",
    ),
  ).toBe(true);
  expect(selected.requiredEvidence).toContain(canonicalId);
  const result = await fixtureExtensionRequest<{
    checks: { id: string; status: string }[];
  }>("evaluate", {
    extensionData: selected.extensionData,
    observations: [
      message('{"format":"darrow-review-result-v3"}'),
      canonical('{"format":"darrow-review-result-v3"}\n'),
    ],
    configuration: { withoutSkill: true },
  });
  expect(
    result.checks.find((check) => check.id === "darrow.evals.review-output.1")
      ?.status,
  ).toBe("passed");
});
