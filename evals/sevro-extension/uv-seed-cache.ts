import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const toolingRoot = resolve(import.meta.dir, "../..");
const MARKER = ".darrow-seed-digest";

/** Matches the `runtime.seedDirectories` source in the repository `sevro.json`. */
export function uvSeedCacheDir(home = homedir()): string {
  return join(home, ".darrow", "cache", "sevro-uv-cache");
}

function registeredPackages(root: string): string[] {
  return readFileSync(join(root, "python-packages.txt"), "utf8")
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);
}

/** Digest of every input that decides the cache contents. */
export function uvSeedDigest(root = toolingRoot): string {
  const hash = createHash("sha256");
  for (const relativePath of registeredPackages(root)) {
    for (const name of ["pyproject.toml", "uv.lock"]) {
      hash.update(`${relativePath}/${name}\0`);
      hash.update(readFileSync(join(root, relativePath, name)));
    }
  }
  return hash.digest("hex");
}

function syncPackage(uv: string, cache: string, env: string, project: string) {
  const result = Bun.spawnSync(
    [uv, "sync", "--quiet", "--frozen", "--no-dev", "--project", project],
    {
      env: {
        ...process.env,
        UV_CACHE_DIR: cache,
        UV_PROJECT_ENVIRONMENT: env,
      },
      stdout: "ignore",
      stderr: "pipe",
    },
  );
  if (result.exitCode !== 0)
    throw new Error(
      `cannot prepare the UV seed cache for ${project}: ${result.stderr.toString().trim()}`,
    );
}

/**
 * Build the public UV cache Sevro seeds into each trial, rebuilding only when a
 * registered package's project metadata or lock changes.
 */
export function prepareUvSeedCache(
  options: { root?: string; target?: string } = {},
): string {
  const root = options.root ?? toolingRoot;
  const target = options.target ?? uvSeedCacheDir();
  const digest = uvSeedDigest(root);
  const marker = join(target, MARKER);
  if (existsSync(marker) && readFileSync(marker, "utf8") === digest)
    return target;
  const uv = Bun.which("uv");
  if (!uv) throw new Error("uv is required to prepare the UV seed cache");
  mkdirSync(dirname(target), { recursive: true });
  const staging = mkdtempSync(`${target}.staging-`);
  const environments = mkdtempSync(`${target}.environments-`);
  try {
    const cache = join(staging, "cache");
    mkdirSync(cache);
    for (const [index, project] of registeredPackages(root).entries())
      syncPackage(
        uv,
        cache,
        join(environments, String(index)),
        join(root, project),
      );
    writeFileSync(join(cache, MARKER), digest);
    rmSync(target, { recursive: true, force: true });
    renameSync(cache, target);
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(environments, { recursive: true, force: true });
  }
  return target;
}

/** Prepare the seed only when this repository's runtime file will be used. */
export function prepareRepositoryRuntime(projectRoot: string): void {
  if (
    resolve(projectRoot) === toolingRoot &&
    existsSync(join(toolingRoot, "sevro.json"))
  )
    prepareUvSeedCache();
}

/**
 * Repository-skill trials need Claude project settings, which conflict with the
 * native-goal hooks in the root `sevro.json`; they use the same tools without hooks.
 */
export function repositorySkillRuntimeFile(
  projectRoot: string,
): string | undefined {
  return resolve(projectRoot) === toolingRoot
    ? join(import.meta.dir, "runtime-repository-skills.json")
    : undefined;
}
