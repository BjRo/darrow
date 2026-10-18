import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const toolingRoot = resolve(import.meta.dir, "../..");
const MARKER = ".darrow-seed-digest";

/** Matches the shared public UV cache source in the repository `sevro.json`. */
export function uvSeedCacheDir(home = homedir()): string {
  return join(home, ".darrow", "cache", "sevro-uv-cache");
}

function registeredPackages(root: string): string[] {
  return readFileSync(join(root, "python-packages.txt"), "utf8")
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);
}

/** Digest of registered package inputs that require another cache warm-up. */
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
 * Warm Sevro's shared public UV cache when registered package inputs change.
 * Preserve its directory and existing entries while other runs may be using it.
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
  mkdirSync(target, { recursive: true });
  const environments = mkdtempSync(`${target}.environments-`);
  try {
    for (const [index, project] of registeredPackages(root).entries())
      syncPackage(
        uv,
        target,
        join(environments, String(index)),
        join(root, project),
      );
    writeFileSync(marker, digest);
  } finally {
    rmSync(environments, { recursive: true, force: true });
  }
  return target;
}

/** Warm the shared cache only for this repository's runtime. */
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
