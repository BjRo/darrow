import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";

const plugin = new URL(
  "../../plugins/capability/darrow-review/",
  import.meta.url,
);
const runtimeConfig = new URL(
  "../sevro-extension/runtime-repository-skills.json",
  import.meta.url,
);
const roots: string[] = [];
afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("prior fixture inputs remain bound to the setup home without product changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-review-setup-retention-"));
  roots.push(root);
  const profile = await Bun.file(runtimeConfig).json();
  profile.runtime.artifactDirectories = [
    { name: "reviews", path: ".darrow/reviews" },
  ];
  const runtime = await prepareUvFixtureRuntime();
  const configured = join(root, "runtime.json");
  await writeFile(configured, JSON.stringify(profile));
  for (const name of [
    "fix-verification-resolved",
    "fix-verification-regression-second-round",
  ]) {
    const source = new URL(`skills/code-review/evals/${name}.yaml`, plugin);
    const canonical = await readFixtureCase(source);
    const result = await runFixtureChecks({
      source,
      fixtureAssets: plugin,
      fixtureAssetFiles: [
        "backend/tests/evals/assert_records.py",
        "backend/tests/evals/assert_guidance.py",
        "backend/tests/evals/eval_routes.py",
      ],
      runtimeConfig: pathToFileURL(configured),
      setupPrefix: runtime.setupPrefix,
      fixture: {
        ...canonical.fixture,
        bin: { ...canonical.fixture.bin, ...runtime.bin },
        setup: `${canonical.fixture.setup}
mkdir -p .agents/backend .agents/.claude-plugin .agents/.codex-plugin
cp -R "$backend/src" "$backend/scripts" .agents/backend/
cp "$backend/pyproject.toml" "$backend/uv.lock" .agents/backend/
cp "$backend/../.claude-plugin/plugin.json" .agents/.claude-plugin/
cp "$backend/../.codex-plugin/plugin.json" .agents/.codex-plugin/
printf '%s\\n' "$HOME" >.fixture-state/setup-home
git hash-object .git/verification-input >.fixture-state/input-before
git diff HEAD >.fixture-state/product-before`,
      },
      checks: [
        {
          name: "mounted backend is readable",
          run: "test -r .agents/backend/scripts/run_locked.py && test -r .agents/.claude-plugin/plugin.json && test -r .agents/.codex-plugin/plugin.json",
        },
        {
          name: "declared UV runtime works",
          run: 'export PATH="$PWD/.git/fixture-bin:$PATH"; uv --version && python --version',
        },
        {
          name: "public teardown preserves immutable repair inputs and source",
          run: `set -eu
export PATH="$PWD/.git/fixture-bin:$PATH"
test "\${SEVRO_CANDIDATE_ARTIFACT_REVIEWS:?Review artifact grant is required}" = "$(cat .fixture-state/setup-home)/.darrow/reviews"
prior_manifest=$(python3 -c 'import json; print(json.load(open(".fixture-state/verification-input"))["prior_manifest"])')
test -r "$prior_manifest" && test -s "$prior_manifest"
cmp .git/verification-input .fixture-state/verification-input
git hash-object .git/verification-input >.fixture-state/input-after
cmp .fixture-state/input-before .fixture-state/input-after
git diff HEAD >.fixture-state/product-after
cmp .fixture-state/product-before .fixture-state/product-after`,
        },
      ],
    });
    expect(result.value.execution.status, result.diagnostic).toBe("completed");
    expect(result.value.grading.status, result.diagnostic).toBe("completed");
    expect(result.exitCode, result.diagnostic).toBe(0);
  }
}, 120_000);
