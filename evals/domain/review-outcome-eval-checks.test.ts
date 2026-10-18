import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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
const backend = ".git/eval-checks/review";
const renderCommand = `uv run --quiet --frozen --no-dev --project ${backend} review-report render-verification`;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const state =
  'export DARROW_REVIEW_STATE_DIR="$(cat .git/oracle-review-state)" SEVRO_CANDIDATE_ARTIFACT_REVIEWS="$(cat .git/oracle-review-state)"';

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
  "goal-contract-pass",
  "goal-contract-repair-rereview",
  "repair-guidance-alternative",
  "repair-guidance-unresolved",
]) {
  test(`review package fixture setup: ${name}`, async () => {
    const source = new URL(`${name}.yaml`, cases);
    const { fixture } = await readFixtureCase(source);
    const runtime = await prepareUvFixtureRuntime();
    fixture.bin = { ...fixture.bin, ...runtime.bin };
    fixture.setup = `${runtime.setupPrefix}\nuv sync --quiet --frozen --no-dev --project "{{case_dir}}/../../../backend"\n${fixture.setup ?? ""}\ncp "{{case_dir}}/../../../backend/pyproject.toml" .git/expected-review-pyproject.toml`;
    if (!name.startsWith("goal-contract-")) {
      const axes =
        name === "fix-verification-resolved" ||
        name === "fix-verification-progress-advisory"
          ? ["standards", "spec"]
          : name === "fix-verification-regression-scope" ||
              name.startsWith("repair-guidance-")
            ? ["spec"]
            : ["standards"];
      fixture.setup += `
set -eu
prior=$(python3 -c 'import json; print(json.load(open(".fixture-state/verification-input"))["prior_manifest"])')
current=$(uv run --quiet --frozen --no-dev --project "$backend" review-scope prepare --repo "$PWD" --target WORKTREE --allow-empty --prior-manifest "$prior")
manifest=$(printf '%s' "$current" | python3 -c 'import json,sys; print(json.load(sys.stdin)["manifest"])')
${axes
  .map(
    (axis) =>
      `uv run --quiet --frozen --no-dev --project "$backend" review-result prepare-reader --manifest "$manifest" --axis ${axis} --original "$PWD/.fixture-state/verification-input" --attempted-from-input --no-checks-reason 'Input-binding oracle only; no assessment or repository-check outcome is asserted.'`,
  )
  .join("\n")}
`;
    }
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
          name: "setup retains the owning package and no host backend pointer",
          run: `test ! -e .git/review-backend && cmp .git/expected-review-pyproject.toml .git/eval-checks/review/pyproject.toml${
            name.startsWith("goal-contract-")
              ? ""
              : ` && cmp .git/verification-input .fixture-state/verification-input && manifest=$(python3 -c 'import json; print(json.load(open(".fixture-state/verification-input"))["prior_manifest"])') && python3 .git/eval-checks/review/tests/evals/assert_records.py "$manifest" has repository "$(pwd -P)"`
          }`,
        },
      ],
    });
    assertResult(result);
  }, 30_000);
}

for (const shell of ["bash", "/bin/bash"]) {
  test(`Review setup exposes empty state without candidate cooperation: ${shell}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-review-home-oracle-"));
    try {
      const config = join(root, "runtime.json");
      await writeFile(
        config,
        JSON.stringify({
          format: "sevro.runtime.v1",
          runtime: {
            artifactDirectories: [{ name: "reviews", path: ".darrow/reviews" }],
          },
        }),
      );
      const source = new URL("no-trigger-implementation.yaml", cases);
      const canonical = await readFixtureCase(source);
      const absence = canonical.checks.find(
        (check) => check.name === "no coordinated review artifact is created",
      );
      if (!absence) throw new Error("Missing canonical Review absence oracle");
      const result = await runFixtureChecks({
        source,
        fixture: {
          ...canonical.fixture,
          setup: canonical.fixture.setup?.replace(
            'bash "{{case_dir}}/fixtures/prepare-grading.sh"',
            `${shell} "{{case_dir}}/fixtures/prepare-grading.sh"`,
          ),
        },
        fixtureAssets: plugin,
        fixtureAssetFiles: ["backend/tests/evals/assert_records.py"],
        runtimeConfig: pathToFileURL(config),
        checks: [
          absence,
          {
            name: "candidate state satisfies Review ownership rules",
            run: `export DARROW_REVIEW_STATE_DIR="\${SEVRO_CANDIDATE_ARTIFACT_REVIEWS:?Candidate Review artifact grant is required}"\npython3 -c 'import sys; sys.path.insert(0, ".git/eval-checks/review/src"); from darrow_review.storage import state_root; state_root(create=False)'`,
          },
        ],
      });
      assertResult(result);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
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

function bindPreviousVerification(): OracleCheck {
  return {
    name: "bind the current verification to the requested previous artifact",
    run: `${state}\npython3 -c 'import json,sys; p=sys.argv[1]; record=json.load(open(p)); record["previous_verification"]=json.load(open(".fixture-state/verification-input"))["previous_verification"]; record["prior_target"]="b"*40; record["current_target"]="c"*40; record["history_targets"]=["a"*40]; json.dump(record,open(p,"w"))' ${artifactPath(`${artifacts}/verification.json`)}`,
  };
}

function render(record: string, bindPrevious = false): OracleCheck[] {
  return [
    write(
      "write current verification",
      `${artifacts}/verification.json`,
      record,
    ),
    ...(bindPrevious ? [bindPreviousVerification()] : []),
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
              write(
                "retain another initialized prior verification",
                "review-state/darrow-review.yy-older/verification.json",
                verification(true, "earlier initialization"),
              ),
              {
                name: "bind the exact prior artifact",
                run: `${state}\nmkdir -p .fixture-state\nchecksum=$(git hash-object --no-filters ${artifactPath(previous)})\npython3 -c 'import json,sys; json.dump({"previous_verification":{"checksum":sys.argv[2],"path":sys.argv[1]}},sys.stdout)' ${artifactPath(previous)} "$checksum" >.fixture-state/verification-input`,
              },
            );
          }
          actions.push(
            ...render(
              verification(),
              file === "fix-verification-regression-second-round",
            ),
          );
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
              ...(file === "fix-verification-regression-second-round"
                ? [bindPreviousVerification()]
                : []),
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
    test("second-round selection rejects ambiguous or invalid successors", async () => {
      const previous = "review-state/darrow-review.previous/verification.json";
      const duplicate =
        "review-state/darrow-review.duplicate/verification.json";
      const malformed =
        "review-state/darrow-review.malformed/verification.json";
      const file = "fix-verification-regression-second-round";
      const checkName =
        "retained verification report preserves the complete canonical evidence";
      const actions: OracleCheck[] = [
        write("retain prior verification", previous, verification()),
        {
          name: "bind the requested prior artifact",
          run: `${state}\nmkdir -p .fixture-state\nchecksum=$(git hash-object --no-filters ${artifactPath(previous)})\npython3 -c 'import json,sys; json.dump({"previous_verification":{"checksum":sys.argv[2],"path":sys.argv[1]}},sys.stdout)' ${artifactPath(previous)} "$checksum" >.fixture-state/verification-input`,
        },
        ...render(verification(), true),
        await oracleCheck(file, checkName, {
          shell,
          variant: "one bound successor",
          passes: true,
        }),
        {
          name: "duplicate the bound current verification",
          run: `${state}\nmkdir -p "$(dirname ${artifactPath(duplicate)})" && cp ${artifactPath(`${artifacts}/verification.json`)} ${artifactPath(duplicate)}`,
        },
        await oracleCheck(file, checkName, {
          shell,
          variant: "ambiguous bound successors",
          passes: false,
        }),
        {
          name: "remove duplicate and break the current binding",
          run: `${state}\nrm ${artifactPath(duplicate)}\npython3 -c 'import json,sys; p=sys.argv[1]; record=json.load(open(p)); record["previous_verification"]={"checksum":"none","path":"none"}; json.dump(record,open(p,"w"))' ${artifactPath(`${artifacts}/verification.json`)}`,
        },
        await oracleCheck(file, checkName, {
          shell,
          variant: "missing bound successor",
          passes: false,
        }),
        bindPreviousVerification(),
        write("retain malformed canonical JSON", malformed, "{invalid"),
        await oracleCheck(file, checkName, {
          shell,
          variant: "malformed retained record",
          passes: false,
        }),
      ];
      await runReviewRecordChecks(actions);
    }, 30_000);
  });
}
