import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runFixtureChecks } from "../domain/fixture-command";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("installed Sevro reuses the UV cache and removes passed and failed checker state", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-shared-cache-"));
  roots.push(root);
  const cache = join(root, "cache");
  await mkdir(cache);
  await writeFile(join(cache, "prepared-dependency"), "preserved\n");
  const profile = await Bun.file(
    new URL(
      "../sevro-extension/runtime-repository-skills.json",
      import.meta.url,
    ),
  ).json();
  profile.runtime.sharedCacheDirectories[0].source = cache;
  const runtime = join(root, "sevro.json");
  await writeFile(runtime, JSON.stringify(profile));
  const source = join(root, "case.yaml");
  await writeFile(
    source,
    JSON.stringify({
      id: "shared-cache",
      fixture: {
        commits: [
          { message: "chore: initialize", files: { "README.md": "fixture\n" } },
        ],
      },
    }),
  );
  for (const exitCode of [0, 1]) {
    const result = await runFixtureChecks({
      source: pathToFileURL(source),
      runtimeConfig: pathToFileURL(runtime),
      checks: [
        {
          name: "shared cache is writable from isolated grading",
          run: `set -eu
test "$UV_OFFLINE" = 1
test "$UV_PYTHON_DOWNLOADS" = never
test "$(cat "$UV_CACHE_DIR/prepared-dependency")" = preserved
printf '%s\\n' "$HOME" >"$UV_CACHE_DIR/checker-home"
printf '%s\\n' "$UV_CACHE_DIR" >"$UV_CACHE_DIR/checker-cache"
exit ${exitCode}`,
        },
      ],
    });
    expect(result.exitCode, result.diagnostic).toBe(exitCode);
    expect(result.checks[0]!.status).toBe(exitCode ? "failed" : "passed");
    expect(await readFile(join(cache, "prepared-dependency"), "utf8")).toBe(
      "preserved\n",
    );
    for (const name of ["checker-home", "checker-cache"]) {
      const disposable = (await readFile(join(cache, name), "utf8")).trim();
      expect(disposable).not.toBe("");
      expect(existsSync(disposable)).toBe(false);
    }
    expect(existsSync(result.value.evidencePath!)).toBe(true);
  }
}, 60_000);
