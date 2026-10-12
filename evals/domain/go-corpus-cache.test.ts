import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

const assets = new URL("../experiments/orchestration/cases/", import.meta.url);
const runtimeConfig = new URL(
  "../sevro-extension/runtime-repository-skills.json",
  import.meta.url,
);

test("Go corpus caches survive setup-home removal and remain outside Git state", async () => {
  for (const name of ["oss-cobra-lifecycle", "oss-go-git-insteadof"]) {
    const source = new URL(`${name}.yaml`, assets);
    const canonical = await readFixtureCase(source);
    const result = await runFixtureChecks({
      source,
      fixtureAssets: assets,
      runtimeConfig,
      fixture: {
        commits: [
          {
            message: "fixture",
            files: { "go.mod": "module fixture.invalid/cache\n\ngo 1.12\n" },
          },
        ],
        bin: canonical.fixture.bin,
        setup: `mkdir -p .git/fixture-toolchain
cat >.git/fixture-toolchain/go <<'GO'
#!/usr/bin/env bash
set -eu
case "$*" in
  'mod download')
    printf '%s\\n' "$HOME" >.fixture-state/setup-home
    printf 'dependency\\n' >"$GOMODCACHE/module.txt"
    chmod 444 "$GOMODCACHE/module.txt"
    ;;
  'env GOMODCACHE GOCACHE GOPATH') printf '%s\\n' "$GOMODCACHE" "$GOCACHE" "$GOPATH" ;;
  *) exit 64 ;;
esac
GO
chmod +x .git/fixture-toolchain/go
export PATH="$PWD/.git/fixture-toolchain:$PATH"
${canonical.fixture.setup}`,
      },
      checks: [
        {
          name: "both supported Bash runtimes use the persisted setup dependencies",
          run: `export PATH="$PWD/.git/fixture-bin:$PWD/.git/fixture-toolchain:$PATH"
setup_home=$(cat .fixture-state/setup-home)
test ! -e "$setup_home" || exit 1
root=$(pwd -P)
printf '%s\\n' "$root/.fixture-state/go/modules" "$root/.fixture-state/go/build" "$root/.fixture-state/go/workspace" >.git/expected-caches
for shell in bash /bin/bash; do
  "$shell" .git/fixture-tools/go-cache.sh env GOMODCACHE GOCACHE GOPATH >.fixture-state/observed-caches
  cmp .git/expected-caches .fixture-state/observed-caches || exit 1
done
go env GOMODCACHE GOCACHE GOPATH >.fixture-state/wrapper-caches
cmp .git/expected-caches .fixture-state/wrapper-caches
test "$(cat .fixture-state/go/modules/module.txt)" = dependency`,
        },
        {
          name: "cache and launcher commands preserve the product snapshot",
          run: "git status --porcelain --untracked-files=all",
          expect_exact: "",
        },
      ],
    });
    expect(result.value.execution.status, result.diagnostic).toBe("completed");
    expect(result.value.grading.status, result.diagnostic).toBe("completed");
    expect(result.exitCode, result.diagnostic).toBe(0);
  }
}, 120_000);
