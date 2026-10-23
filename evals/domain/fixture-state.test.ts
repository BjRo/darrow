import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";
const reviewAssets = {
  fixtureAssets: new URL(
    "../../plugins/orchestration/darrow-adaptive-goal/",
    import.meta.url,
  ),
  fixtureAssetFiles: ["backend/tests/evals/review_receipts.py"],
};

test("Darrow prepares fixture state before canonical setup", async () => {
  const result = await runFixtureChecks({
    source: new URL(
      "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/failed-check-blocks-publication.yaml",
      import.meta.url,
    ),
    setupPrefix:
      'test -d .fixture-state || exit 9\nexport DARROW_FIXTURE_RECEIPTS_DIR="$PWD/.fixture-state/oracle-receipts"',
    checks: [{ name: "fixture state exists", run: "test -d .fixture-state" }],
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks[0]?.status).toBe("passed");
}, 20_000);

test("Darrow setup resolves system Git before declared wrappers", async () => {
  const git = Bun.which("git");
  if (!git) throw new Error("system Git is unavailable");
  const quoted = `'${git.replaceAll("'", "'\\''")}'`;
  const result = await runFixtureChecks({
    ...reviewAssets,
    source: new URL(
      "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/file-backed-capability-routing.yaml",
      import.meta.url,
    ),
    setupPrefix:
      'case "$(command -v git)" in */.git/fixture-bin/*) exit 9 ;; esac',
    checks: [
      {
        name: "setup bound system Git",
        run: `test "$(cat .git/real-git-path)" = ${quoted}`,
      },
      {
        name: "declared Git wrapper remains usable during grading",
        run: 'case "$(command -v git)" in */.git/fixture-bin/git) git rev-parse --verify HEAD >/dev/null ;; *) exit 1 ;; esac',
      },
    ],
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((check) => check.status)).toEqual([
    "passed",
    "passed",
  ]);
}, 20_000);

test("Darrow prepares state for a canonical fixture without setup", async () => {
  const result = await runFixtureChecks({
    source: new URL(
      "../../plugins/capability/darrow-git/skills/create-commit/evals/clean-tree.yaml",
      import.meta.url,
    ),
    checks: [
      { name: "fixture state exists", run: "test -d .fixture-state" },
      {
        name: "history is unchanged",
        run: 'test "$(git rev-list --count HEAD)" -eq 1',
      },
    ],
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((check) => check.status)).toEqual([
    "passed",
    "passed",
  ]);
}, 20_000);

test("capability review receipts accept repeated current assessments and reject invalid evidence", async () => {
  const source = new URL(
    "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/file-backed-capability-routing.yaml",
    import.meta.url,
  );
  const canonical = await readFixtureCase(source);
  const oracle = canonical.checks.find(
    (check) =>
      check.name ===
      "selected independent review remains composed before publication",
  );
  if (!oracle) throw new Error("canonical review receipt oracle is missing");
  const runtime = await prepareUvFixtureRuntime();
  const log = ".fixture-state/independent-review-invocations";
  const backup = ".fixture-state/review-receipts-original";
  const checks = [
    {
      name: "exact requested change",
      run: "printf '%s\\n' '# Notes' 'Capability routing survives file-backed goals.' >NOTES.md",
    },
    { name: "current check", run: "bash check.sh && /bin/bash check.sh" },
    {
      name: "independent assessments run concurrently on both shells",
      run: `protocol=$(command -v independent-review-protocol)
bash "$protocol" independent-review-skill-contract-v1 &
standards_pid=$!
/bin/bash "$protocol" independent-review-skill-contract-v1 &
acceptance_pid=$!
standards_status=0
acceptance_status=0
wait "$standards_pid" || standards_status=$?
wait "$acceptance_pid" || acceptance_status=$?
test "$standards_status" -eq 0 && test "$acceptance_status" -eq 0`,
    },
    {
      name: "one intended commit",
      run: 'create-commit-protocol NOTES.md "docs: add capability routing note" create-commit-skill-contract-v1',
    },
    { name: "preserve original receipts", run: `cp ${log} ${backup}` },
    {
      name: "one current review is sufficient",
      run: `sed -n '1p' ${backup} >${log}\n${oracle.run}`,
    },
    {
      name: "repeated current reviews are valid",
      run: `cp ${backup} ${log}\n${oracle.run}`,
    },
    {
      name: "missing reviews fail",
      run: `: >${log}\n${oracle.run}`,
      exit_code: 1,
    },
    {
      name: "a stale additional review fails",
      run: `cp ${backup} ${log}\nprintf '%s\\tclear\\tcomprehensive\\n' WORKTREE@stale >>${log}\n${oracle.run}`,
      exit_code: 1,
    },
    {
      name: "an uncleared additional review fails",
      run: `cp ${backup} ${log}\ntarget=$(sed -n '1p' ${backup} | cut -f1)\nprintf '%s\\tblocked\\tcomprehensive\\n' "$target" >>${log}\n${oracle.run}`,
      exit_code: 1,
    },
    {
      name: "a malformed additional review fails",
      run: `cp ${backup} ${log}\ntarget=$(sed -n '1p' ${backup} | cut -f1)\nprintf '%s\\tclear\\n' "$target" >>${log}\n${oracle.run}`,
      exit_code: 1,
    },
    {
      name: "restored valid records pass",
      run: `cp ${backup} ${log}\n${oracle.run}`,
    },
  ];
  const result = await runFixtureChecks({
    source,
    ...reviewAssets,
    setupPrefix: runtime.setupPrefix,
    fixture: {
      ...canonical.fixture,
      bin: { ...canonical.fixture.bin, ...runtime.bin },
    },
    checks,
  });
  expect(result.checks.slice(0, 7).map((check) => check.status)).toEqual(
    checks.slice(0, 7).map(() => "passed"),
  );
  expect(
    result.exitCode,
    `${result.diagnostic}\n${JSON.stringify(result.checks)}`,
  ).toBe(0);
  expect(result.checks.map((check) => check.status)).toEqual(
    checks.map(() => "passed"),
  );
}, 30_000);

test("real-commit review receipts accept repeated current assessments", async () => {
  const source = new URL(
    "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/real-create-commit-composition.yaml",
    import.meta.url,
  );
  const canonical = await readFixtureCase(source);
  const oracle = canonical.checks.find(
    (check) =>
      check.name ===
      "review clears the final uncommitted candidate before commit",
  );
  const protocol = canonical.fixture.bin?.["independent-review-protocol"];
  if (!oracle || !protocol)
    throw new Error("canonical review fixture is missing");
  const runtime = await prepareUvFixtureRuntime();
  const log = ".fixture-state/composition-events";
  const backup = ".fixture-state/review-events-original";
  const checks = [
    {
      name: "exact requested change",
      run: "printf '%s\\n' '# Notes' 'Real commit capability composes.' >NOTES.md",
    },
    { name: "current check", run: "bash check.sh && /bin/bash check.sh" },
    {
      name: "independent assessments run concurrently on both shells",
      run: `protocol=$(command -v independent-review-protocol)
bash "$protocol" &
standards_pid=$!
/bin/bash "$protocol" &
acceptance_pid=$!
standards_status=0
acceptance_status=0
wait "$standards_pid" || standards_status=$?
wait "$acceptance_pid" || acceptance_status=$?
test "$standards_status" -eq 0 && test "$acceptance_status" -eq 0`,
    },
    {
      name: "prepare committed target for the review oracle",
      run: 'git add -- NOTES.md && git commit -m "docs: add composition note"',
    },
    { name: "preserve original receipts", run: `cp ${log} ${backup}` },
    {
      name: "one current review is sufficient",
      run: `awk -F '\\t' '$1 != "review" || !seen++ { print }' ${backup} >${log}\n${oracle.run}`,
    },
    {
      name: "repeated current reviews are valid",
      run: `cp ${backup} ${log}\n${oracle.run}`,
    },
    {
      name: "missing review records fail",
      run: `awk -F '\\t' '$1 != "review" { print }' ${backup} >${log}\n${oracle.run}`,
      exit_code: 1,
    },
    {
      name: "stale additional records fail",
      run: `cp ${backup} ${log}\nprintf 'review\\t%s\\n' WORKTREE@stale >>${log}\n${oracle.run}`,
      exit_code: 1,
    },
    {
      name: "malformed additional records fail",
      run: `cp ${backup} ${log}\ntarget=$(awk -F '\\t' '$1 == "review" { print $2 }' ${backup} | sort -u)\nprintf 'review\\t%s\\textra\\n' "$target" >>${log}\n${oracle.run}`,
      exit_code: 1,
    },
    {
      name: "restored valid records pass",
      run: `cp ${backup} ${log}\n${oracle.run}`,
    },
  ];
  // Only the receipt oracle is under test; the native case covers the real commit helper.
  const result = await runFixtureChecks({
    source,
    ...reviewAssets,
    setupPrefix: runtime.setupPrefix,
    fixture: {
      setup: canonical.fixture.setup,
      commits: canonical.fixture.commits,
      bin: { ...runtime.bin, "independent-review-protocol": protocol },
    },
    checks,
  });
  expect(result.checks.slice(0, 7).map((check) => check.status)).toEqual(
    checks.slice(0, 7).map(() => "passed"),
  );
  expect(
    result.exitCode,
    `${result.diagnostic}\n${JSON.stringify(result.checks)}`,
  ).toBe(0);
  expect(result.checks.map((check) => check.status)).toEqual(
    checks.map(() => "passed"),
  );
}, 30_000);
