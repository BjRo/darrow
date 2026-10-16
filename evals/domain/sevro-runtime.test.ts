import { afterEach, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sevroEnvironment } from "../sevro-extension/sevro-command";
import { invocation } from "../sevro-extension/run";
import {
  prepareUvSeedCache,
  repositorySkillRuntimeFile,
  uvSeedDigest,
} from "../sevro-extension/uv-seed-cache";

const repository = resolve(import.meta.dir, "../..");
const roots: string[] = [];

test("repository goal policy selects app-server without changing explicit routes", async () => {
  const results = await scratch();
  const command = (project: string, options: string[] = []) =>
    invocation([
      "--case-id",
      "example",
      "--project-root",
      project,
      "--results-root",
      results,
      "--",
      "--host",
      "codex",
      ...options,
    ]).command;
  expect(command(repository).slice(-2)).toEqual([
    "--codex-entrypoint",
    "app-server",
  ]);
  expect(command(repository, ["--codex-entrypoint", "exec"]).slice(-2)).toEqual(
    ["--codex-entrypoint", "exec"],
  );
  expect(
    command(repository, [
      "--runtime-config-file",
      repositorySkillRuntimeFile(repository)!,
    ]),
  ).not.toContain("--codex-entrypoint");
  expect(command(await scratch())).not.toContain("--codex-entrypoint");
});

test("hook-free guide policy retains native transcripts for complete observations", async () => {
  const runtime = JSON.parse(
    await readFile(repositorySkillRuntimeFile(repository)!, "utf8"),
  ) as Record<string, unknown>;
  expect(runtime.nativeTranscripts).toBe(true);
  expect(runtime.hooks).toBeUndefined();
});

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function scratch() {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-runtime-"));
  roots.push(root);
  return root;
}

test("Sevro environment drops repository and Bun PATH entries", () => {
  const env = sevroEnvironment({
    PATH: [
      join(repository, "node_modules/.bin"),
      "/elsewhere/node_modules/.bin",
      "/private/tmp/bun-node-bf2e2cecf",
      "/tool/bin",
      "/usr/sbin",
      "/usr/bin",
      "/sbin",
      "/tool/bin",
      "relative/bin",
    ].join(":"),
    UV_PYTHON_INSTALL_DIR: "/uv/python",
    UNRELATED: "kept",
  });
  expect(env.PATH).toBe("/tool/bin:/usr/sbin:/usr/bin:/sbin");
  expect(env.UV_PYTHON_INSTALL_DIR).toBe("/uv/python");
  expect(env.UNRELATED).toBe("kept");
});

test("seed cache preparation is skipped while its inputs are unchanged", async () => {
  const root = await scratch();
  await writeFile(join(root, "python-packages.txt"), "# none\n");
  const target = join(root, "cache", "sevro-uv-cache");
  expect(prepareUvSeedCache({ root, target })).toBe(target);
  const marker = join(target, ".darrow-seed-digest");
  expect(await readFile(marker, "utf8")).toBe(uvSeedDigest(root));
  const first = (await stat(marker)).mtimeMs;
  prepareUvSeedCache({ root, target });
  expect((await stat(marker)).mtimeMs).toBe(first);
});

test("seed digest changes with a registered package lock", async () => {
  const root = await scratch();
  await mkdir(join(root, "pkg"));
  await writeFile(join(root, "python-packages.txt"), "pkg\n");
  await writeFile(join(root, "pkg/pyproject.toml"), "[project]\n");
  await writeFile(join(root, "pkg/uv.lock"), "version = 1\n");
  const before = uvSeedDigest(root);
  await writeFile(join(root, "pkg/uv.lock"), "version = 2\n");
  expect(uvSeedDigest(root)).not.toBe(before);
});

test("only this repository's guide trials select the hook-free runtime file", async () => {
  expect(repositorySkillRuntimeFile(repository)).toBe(
    join(repository, "evals/sevro-extension/runtime-repository-skills.json"),
  );
  expect(repositorySkillRuntimeFile(await scratch())).toBeUndefined();
});
