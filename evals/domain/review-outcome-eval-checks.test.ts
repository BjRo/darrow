import { describe, expect, test } from "bun:test";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";

const plugin = new URL(
  "../../plugins/capability/darrow-review/",
  import.meta.url,
);
const cases = new URL("skills/code-review/evals/", plugin);
const artifacts = "review-state/darrow-review.fixture";
const backend = ".git/eval-tools/backend";
const renderCommand = `uv run --quiet --frozen --no-dev --project ${backend} review-report render-verification`;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const state =
  'export DARROW_REVIEW_STATE_DIR="$(cat .git/oracle-review-state)"';

function assertResult(
  result: Awaited<ReturnType<typeof runFixtureChecks>>,
  passes = true,
  actions = 0,
) {
  expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
  expect(
    result.checks.map((check) => check.status),
    result.diagnostic,
  ).toEqual(
    result.checks.map((_, index) =>
      index < actions || passes ? "passed" : "failed",
    ),
  );
}

for (const name of [
  "fix-verification-resolved",
  "fix-verification-progress-advisory",
  "fix-verification-regression-scope",
  "fix-verification-regression-second-round",
  "fix-verification-unavailable",
  "goal-contract-repair-rereview",
  "repair-guidance-alternative",
  "repair-guidance-unresolved",
]) {
  test(`review package fixture setup: ${name}`, async () => {
    const source = new URL(`${name}.yaml`, cases);
    const { fixture } = await readFixtureCase(source);
    const runtime = await prepareUvFixtureRuntime();
    fixture.bin = { ...fixture.bin, ...runtime.bin };
    fixture.setup = `${runtime.setupPrefix}\nuv sync --quiet --frozen --no-dev --project "{{case_dir}}/../../../backend"\n${fixture.setup ?? ""}\n(cd "{{case_dir}}/../../../backend" && pwd -P) >.git/expected-review-backend`;
    const result = await runFixtureChecks({
      source,
      fixture,
      reviewState: true,
      fixtureAssets: plugin,
      fixtureAssetFiles: ["backend/tests/evals/eval_routes.py"],
      checks: [
        {
          name: "setup retains the owning package or requested repository manifest",
          run:
            name === "goal-contract-repair-rereview"
              ? "cmp .git/expected-review-backend .git/review-backend"
              : `manifest=$(awk -F '\\t' '$1 == "prior_manifest" { print $2 }' .git/verification-input) && test -n "$manifest" && tab=$(printf '\\t') && grep -F "repository$tab$(pwd -P)" "$manifest"`,
        },
      ],
    });
    assertResult(result);
  }, 30_000);
}

function verification(
  advisoryResolved = true,
  checkEvidence = "exited 0: no output",
) {
  const target = "a".repeat(40);
  const rows = [
    "format\tdarrow-review-verification-v1",
    `original_target\t${target}`,
    `prior_target\t${target}`,
    `current_target\t${"b".repeat(40)}`,
    "previous_verification\tnone\tnone",
  ];
  for (const [index, axis] of ["standards", "spec", "spec"].entries()) {
    const order = index + 1;
    rows.push(
      `original_finding\t${axis}:${order}:${target}\t${axis}\t${order}\t${order === 3 ? "low\tadvisory" : "high\tblocking"}\tsrc/config.js:${order}\trequirement\tOriginal evidence`,
    );
  }
  for (const [index, axis] of ["standards", "spec", "spec"].entries()) {
    const current =
      index === 2 && !advisoryResolved
        ? "unresolved\tunchanged"
        : "resolved\tresolved";
    rows.push(
      `attempt\t${axis}:${index + 1}:${target}\t${current}\tWhether resolved or unresolved, evidence prose is not the state`,
    );
  }
  return [
    ...rows,
    `check\tbash check.sh\tapplicable\tpass\t${checkEvidence}`,
    "outcome\tclear",
    "next_action\tnone",
    "",
  ].join("\n");
}

function write(name: string, path: string, contents: string): OracleCheck {
  const destination = artifactPath(path);
  return {
    name,
    run: `${state}\nmkdir -p "$(dirname ${destination})" && printf '%s' ${quote(contents)} >${destination}`,
  };
}

function artifactPath(path: string) {
  return path.startsWith("review-state/")
    ? `"$DARROW_REVIEW_STATE_DIR/${path.slice("review-state/".length)}"`
    : quote(path);
}

function render(record: string): OracleCheck[] {
  return [
    write(
      "write current verification",
      `${artifacts}/verification.tsv`,
      record,
    ),
    {
      name: "render the canonical report and final response",
      run: `${state}\n${renderCommand} ${artifactPath(`${artifacts}/verification.tsv`)} >${artifactPath(`${artifacts}/verification.md`)} && cp ${artifactPath(`${artifacts}/verification.md`)} .git/last-message.md`,
    },
  ];
}

async function runOracle(
  file: string,
  name: string,
  shell: string,
  actions: OracleCheck[],
) {
  const source = new URL(`${file}.yaml`, cases);
  const canonical = await readFixtureCase(source);
  const check = canonical.checks.find((entry) => entry.name === name);
  if (!check) throw new Error(`Missing check: ${file}: ${name}`);
  const runtime = await prepareUvFixtureRuntime();
  return runFixtureChecks({
    source,
    fixtureAssets: plugin,
    reviewState: true,
    fixture: {
      commits: [
        { message: "chore: init", files: { "README.md": "Oracle fixture.\n" } },
      ],
      bin: runtime.bin,
      setup: `${runtime.setupPrefix}\nmkdir -p .git/eval-tools\ncp -R "{{case_dir}}/../../../backend" ${backend}\nuv sync --quiet --frozen --no-dev --project ${backend}`,
    },
    checks: [
      ...actions,
      { ...check, run: `${state}\n${quote(shell)} -c ${quote(check.run)}` },
    ],
  });
}

for (const shell of ["bash", "/bin/bash"]) {
  describe(`review outcome eval checks (${shell})`, () => {
    for (const variant of [
      "captured diagnostic",
      "different diagnostic",
      "invented evidence",
      "missing capture",
    ] as const) {
      test(`unavailable check: ${variant}`, async () => {
        const diagnostic =
          variant === "different diagnostic"
            ? "exited 127: verifier service cannot be reached"
            : "exited 127: required external verifier is unavailable";
        const row = `check\tbash external-check.sh\tapplicable\tblocked\t${diagnostic}`;
        const record = verification()
          .replace(/check\tbash check[.]sh[^\n]+/, row)
          .replace(
            "outcome\tclear",
            "evidence_gap\tRequired check unavailable\noutcome\tblocked",
          );
        const actions = [
          write(
            "write blocked verification",
            `${artifacts}/verification.tsv`,
            record,
          ),
        ];
        if (variant !== "missing capture")
          actions.push(
            write(
              "write independently captured check evidence",
              `${artifacts}/check-1.tsv`,
              `format\tdarrow-review-check-v1\n${variant === "invented evidence" ? row.replace(diagnostic, "exited 127: a different observation") : row}\n`,
            ),
          );
        const result = await runOracle(
          "fix-verification-unavailable",
          "unavailable evidence produces a valid blocked artifact",
          shell,
          actions,
        );
        assertResult(
          result,
          variant !== "invented evidence" && variant !== "missing capture",
          actions.length,
        );
      }, 30_000);
    }
    for (const resolved of [true, false]) {
      test(`resolved case ${resolved ? "accepts all resolved states" : "rejects an unresolved advisory despite misleading prose"}`, async () => {
        const actions = render(verification(resolved));
        const result = await runOracle(
          "fix-verification-resolved",
          "additive verification artifact validates and clears",
          shell,
          actions,
        );
        assertResult(result, resolved, actions.length);
      }, 30_000);
    }
    for (const file of [
      "fix-verification-resolved",
      "fix-verification-regression-scope",
      "fix-verification-unavailable",
      "fix-verification-progress-advisory",
      "fix-verification-regression-second-round",
    ]) {
      for (const variant of [
        "canonical",
        "matching summaries",
        "empty reports",
        "stale artifact",
      ] as const) {
        test(`${file}: ${variant}`, async () => {
          const actions: OracleCheck[] = [];
          if (file === "fix-verification-regression-second-round") {
            // The prior artifact sorts after the current one and has no report.
            const previous =
              "review-state/darrow-review.zz-previous/verification.tsv";
            actions.push(
              write(
                "write prior verification without a report",
                previous,
                verification(true, "prior check evidence"),
              ),
              {
                name: "bind the exact prior artifact",
                run: `${state}\nprintf 'previous_verification\\tprior-checksum\\t%s\\n' ${artifactPath(previous)} >.git/verification-input`,
              },
            );
          }
          actions.push(...render(verification()));
          if (variant === "matching summaries" || variant === "empty reports") {
            const summary =
              variant === "empty reports"
                ? "\n"
                : "# Repair verification — CLEAR\n\nAll findings resolved.\n";
            actions.push(
              write(
                "replace report with a summary",
                `${artifacts}/verification.md`,
                summary,
              ),
              write(
                "replace final response with the same summary",
                ".git/last-message.md",
                summary,
              ),
            );
          } else if (variant === "stale artifact") {
            actions.push(
              write(
                "change the record after rendering",
                `${artifacts}/verification.tsv`,
                verification(true, "exited 0: fresh check output"),
              ),
            );
          } else {
            // Existing presentation gates intentionally ignore blank lines.
            actions.push({
              name: "remove blank lines from the final response",
              run: "awk 'NF' .git/last-message.md >.git/normalized-message && mv .git/normalized-message .git/last-message.md",
            });
          }
          const result = await runOracle(
            file,
            "final response is the complete rendered verification report",
            shell,
            actions,
          );
          assertResult(result, variant === "canonical", actions.length);
        }, 30_000);
      }
    }
  });
}
