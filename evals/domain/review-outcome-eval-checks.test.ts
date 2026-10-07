import { describe, expect, test } from "bun:test";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";
import { runReviewRecordChecks } from "./review-record-oracle";

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
      fixtureAssetFiles: [
        "backend/tests/evals/eval_routes.py",
        "backend/tests/evals/assert_records.py",
        "backend/tests/evals/assert_guidance.py",
      ],
      checks: [
        {
          name: "setup retains the owning package or requested repository manifest",
          run:
            name === "goal-contract-repair-rereview"
              ? "cmp .git/expected-review-backend .git/review-backend"
              : `manifest=$(python3 -c 'import json; print(json.load(open(".git/verification-input"))["prior_manifest"])') && python3 .git/eval-checks/review/tests/evals/assert_records.py "$manifest" has repository "$(pwd -P)"`,
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
  const record = {
    format: "darrow-review-verification-v3",
    original_target: target,
    prior_target: target,
    current_target: "b".repeat(40),
    previous_verification: { checksum: "none", path: "none" },
    original_findings: [] as Record<string, string>[],
    attempts: [] as Record<string, string>[],
    checks: [
      {
        command: "bash check.sh",
        applicability: "applicable",
        status: "pass",
        evidence: checkEvidence,
      },
    ],
    outcome: "clear",
    next_action: "none",
  };
  for (const [index, axis] of ["standards", "spec", "spec"].entries()) {
    const order = index + 1;
    record.original_findings.push({
      key: `${axis}:${order}:${target}`,
      axis,
      order: String(order),
      severity: order === 3 ? "low" : "high",
      disposition: order === 3 ? "advisory" : "blocking",
      location: `src/config.js:${order}`,
      source: "requirement",
      evidence: "Original evidence",
      repair_guidance:
        "Advisory: correct the reported behavior while preserving the public API",
      resolution_evidence: "The original reported counterexample succeeds",
    });
  }
  for (const [index, axis] of ["standards", "spec", "spec"].entries()) {
    const unresolved = index === 2 && !advisoryResolved;
    record.attempts.push({
      key: `${axis}:${index + 1}:${target}`,
      status: unresolved ? "unresolved" : "resolved",
      progress: unresolved ? "unchanged" : "resolved",
      evidence:
        "Whether resolved or unresolved, evidence prose is not the state",
    });
  }
  return JSON.stringify(record);
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
      `${artifacts}/verification.json`,
      record,
    ),
    {
      name: "render the canonical report and final response",
      run: `${state}\n${renderCommand} ${artifactPath(`${artifacts}/verification.json`)} >${artifactPath(`${artifacts}/verification.md`)} && cp ${artifactPath(`${artifacts}/verification.md`)} .git/last-message.md`,
    },
  ];
}

async function oracleCheck(
  file: string,
  name: string,
  options: { shell: string; variant: string; passes: boolean },
): Promise<OracleCheck> {
  const canonical = await readFixtureCase(new URL(`${file}.yaml`, cases));
  const check = canonical.checks.find((entry) => entry.name === name);
  if (!check) throw new Error(`Missing check: ${file}: ${name}`);
  return {
    ...check,
    name: `${options.variant}: ${name}`,
    run: `${state}\n${options.passes ? "" : "! "}${quote(options.shell)} -c ${quote(check.run)}`,
  };
}

for (const shell of ["bash", "/bin/bash"]) {
  describe(`review outcome eval checks (${shell})`, () => {
    test("unavailable checks require their exact captured evidence", async () => {
      const actions: OracleCheck[] = [];
      for (const variant of [
        "captured diagnostic",
        "different diagnostic",
        "invented evidence",
        "missing capture",
      ] as const) {
        const diagnostic =
          variant === "different diagnostic"
            ? "exited 127: verifier service cannot be reached"
            : "exited 127: required external verifier is unavailable";
        const check = {
          command: "bash external-check.sh",
          applicability: "applicable",
          status: "blocked",
          evidence: diagnostic,
        };
        const record = JSON.stringify({
          ...JSON.parse(verification()),
          checks: [check],
          evidence_gaps: ["Required check unavailable"],
          outcome: "blocked",
        });
        actions.push(
          {
            name: `${variant}: discard the preceding capture`,
            run: `${state}\nrm -f ${artifactPath(`${artifacts}/check-1.json`)}`,
          },
          write(
            "write blocked verification",
            `${artifacts}/verification.json`,
            record,
          ),
        );
        if (variant !== "missing capture")
          actions.push(
            write(
              "write independently captured check evidence",
              `${artifacts}/check-1.json`,
              JSON.stringify({
                format: "darrow-review-check-v3",
                checks: [
                  {
                    ...check,
                    evidence:
                      variant === "invented evidence"
                        ? "exited 127: a different observation"
                        : diagnostic,
                  },
                ],
              }),
            ),
          );
        actions.push(
          await oracleCheck(
            "fix-verification-unavailable",
            "unavailable evidence produces a valid blocked artifact",
            {
              shell,
              variant,
              passes:
                variant !== "invented evidence" &&
                variant !== "missing capture",
            },
          ),
        );
      }
      await runReviewRecordChecks(actions);
    }, 30_000);
    test("resolved states clear while an unresolved advisory is rejected", async () => {
      const actions: OracleCheck[] = [];
      for (const resolved of [true, false]) {
        actions.push(
          ...render(verification(resolved)),
          await oracleCheck(
            "fix-verification-resolved",
            "additive verification artifact validates and clears",
            {
              shell,
              variant: resolved ? "all resolved" : "unresolved advisory",
              passes: resolved,
            },
          ),
        );
      }
      await runReviewRecordChecks(actions);
    }, 30_000);
    for (const file of [
      "fix-verification-resolved",
      "fix-verification-regression-scope",
      "fix-verification-unavailable",
      "fix-verification-progress-advisory",
      "fix-verification-regression-second-round",
    ]) {
      test(`${file}: canonical and invalid presentation variants`, async () => {
        const actions: OracleCheck[] = [];
        for (const variant of [
          "canonical",
          "matching summaries",
          "empty reports",
          "stale artifact",
        ] as const) {
          if (file === "fix-verification-regression-second-round") {
            // The prior artifact sorts after the current one and has no report.
            const previous =
              "review-state/darrow-review.zz-previous/verification.json";
            actions.push(
              write(
                "write prior verification without a report",
                previous,
                verification(true, "prior check evidence"),
              ),
              {
                name: "bind the exact prior artifact",
                run: `${state}\npython3 -c 'import json,sys; json.dump({"previous_verification":{"checksum":"prior-checksum","path":sys.argv[1]}},sys.stdout)' ${artifactPath(previous)} >.git/verification-input`,
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
                `${artifacts}/verification.json`,
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
          actions.push(
            await oracleCheck(
              file,
              "retained verification report preserves the complete canonical evidence",
              { shell, variant, passes: variant === "canonical" },
            ),
          );
        }
        await runReviewRecordChecks(actions);
      }, 30_000);
    }
  });
}
