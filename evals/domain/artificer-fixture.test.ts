import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";

const cases = new URL(
  "../../plugins/automation/darrow-artificer/skills/manage-artificer/evals/",
  import.meta.url,
);

test("Artificer recovery fixture reaches the missing native-session boundary", async () => {
  const source = new URL("recovery-boundary.yaml", cases);
  const canonical = await readFixtureCase(source);
  const runtime = await prepareUvFixtureRuntime();
  const result = await runFixtureChecks({
    source,
    runtimeConfig: new URL(
      "../sevro-extension/runtime-repository-skills.json",
      import.meta.url,
    ),
    fixtureAssets: new URL(
      "../../plugins/automation/darrow-artificer/",
      import.meta.url,
    ),
    setupPrefix: runtime.setupPrefix,
    fixture: {
      ...canonical.fixture,
      bin: runtime.bin,
      setup: `${canonical.fixture.setup}
cp -R "{{case_dir}}/../../../backend" .git/eval-checks/artificer-backend`,
    },
    checks: [
      {
        name: "current installation loads and recovery refuses replacement ownership",
        run: `export UV_PROJECT_ENVIRONMENT="$(mktemp -d)"
trap 'rm -rf "$UV_PROJECT_ENVIRONMENT"' EXIT
uv run --quiet --frozen --no-dev --project .git/eval-checks/artificer-backend darrow-artificer --state .fixture-state status || exit 1
status=0
diagnostic=$(uv run --quiet --frozen --no-dev --project .git/eval-checks/artificer-backend darrow-artificer --state .fixture-state recover 11111111-1111-4111-8111-111111111111 --thread lost-original-session 2>&1) || status=$?
test "$status" -eq 1 && test "$diagnostic" = 'Artificer needs attention: Recovery requires the exact original native session; reconcile existing effects'`,
      },
      ...canonical.checks,
    ],
  });
  expect(
    result.exitCode,
    result.diagnostic + "\n" + JSON.stringify(result.checks),
  ).toBe(0);
  expect(result.checks.map((check) => check.status)).toEqual(
    result.checks.map(() => "passed"),
  );
}, 30_000);

test("Artificer ambiguous cancellation rejects a change to either claim", async () => {
  const source = new URL("ambiguous-cancel.yaml", cases);
  const canonical = await readFixtureCase(source);
  const oracle = canonical.checks.find(
    (check) => check.name === "both delivery claims remain unchanged",
  );
  if (!oracle) throw new Error("claim-preservation oracle is missing");
  const runtime = await prepareUvFixtureRuntime();
  const ids = [
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
  ];
  const result = await runFixtureChecks({
    source,
    setupPrefix: runtime.setupPrefix,
    fixture: { ...canonical.fixture, bin: runtime.bin },
    checks: [
      ...canonical.checks,
      ...ids.flatMap((id) => [
        {
          name: `silently cancel ${id}`,
          run: `python3 - <<'PY'
import json
from pathlib import Path
claim = Path('.fixture-state/deliveries/${id}/claim.json')
value = json.loads(claim.read_text())
value['status'] = 'cancelled'
claim.write_text(json.dumps(value))
PY`,
        },
        { ...oracle, name: `reject changed claim ${id}`, exit_code: 1 },
        {
          name: `restore claim ${id}`,
          run: `cp .git/eval-checks/artificer-cancel/${id}.json .fixture-state/deliveries/${id}/claim.json`,
        },
        { ...oracle, name: `accept restored claims after ${id}` },
      ]),
    ],
  });
  expect(
    result.exitCode,
    result.diagnostic + "\n" + JSON.stringify(result.checks),
  ).toBe(0);
  expect(result.checks.map((check) => check.status)).toEqual(
    result.checks.map(() => "passed"),
  );
}, 30_000);
