import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

interface CorpusSourceRecord {
  repository: string;
  commit: string;
  commit_date: string;
  license: string;
  license_file: string;
  provenance: string;
}

interface CorpusManifest {
  version: number;
  cache_dir?: string;
  sources: Record<string, CorpusSourceRecord>;
}

export interface ResolvedCorpusSource {
  id: string;
  path: string;
  commit: string;
  repository: string;
  license: string;
  commitDate: string;
  provenance: string;
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0)
    throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
  return stdout.trim();
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`corpus manifest ${label} must be a non-empty string`);
  }
  return value;
}

async function readCorpusManifest(
  manifestPath: string,
): Promise<CorpusManifest> {
  const parsed = parseYaml(
    await readFile(manifestPath, "utf8"),
  ) as CorpusManifest;
  if (
    parsed?.version !== 1 ||
    !parsed.sources ||
    typeof parsed.sources !== "object"
  ) {
    throw new Error("corpus manifest must use version 1 and define sources");
  }
  return parsed;
}

/** Refuse a checkout that is missing, on the wrong revision, missing its
 * license, or locally modified — an eval must never read a mutated corpus. */
async function verifyPreparedCheckout(
  id: string,
  path: string,
  commit: string,
  licenseFile: string,
): Promise<void> {
  if (!existsSync(join(path, ".git"))) {
    throw new Error(
      `corpus source '${id}' is not prepared at ${path}; run the corpus prepare command`,
    );
  }
  const actualCommit = await git(path, "rev-parse", "HEAD");
  if (actualCommit !== commit) {
    throw new Error(
      `prepared corpus revision for '${id}' is ${actualCommit}, expected ${commit}`,
    );
  }
  if (!existsSync(join(path, licenseFile))) {
    throw new Error(`prepared corpus source '${id}' is missing ${licenseFile}`);
  }
  const dirty = await git(
    path,
    "status",
    "--porcelain",
    "--untracked-files=all",
  );
  if (dirty) throw new Error(`prepared corpus source '${id}' is not clean`);
}

export async function resolveCorpusSource(
  id: string,
  manifestPath: string,
): Promise<ResolvedCorpusSource> {
  const parsed = await readCorpusManifest(manifestPath);
  const source = parsed.sources[id];
  if (!source) throw new Error(`unknown corpus source: ${id}`);
  const repository = nonEmpty(source.repository, `${id}.repository`);
  const commit = nonEmpty(source.commit, `${id}.commit`);
  const commitDate = nonEmpty(source.commit_date, `${id}.commit_date`);
  const license = nonEmpty(source.license, `${id}.license`);
  const licenseFile = nonEmpty(source.license_file, `${id}.license_file`);
  const provenance = nonEmpty(source.provenance, `${id}.provenance`);
  const cacheRoot = resolve(dirname(manifestPath), parsed.cache_dir ?? "cache");
  const path = join(cacheRoot, id);
  await verifyPreparedCheckout(id, path, commit, licenseFile);
  return { id, path, commit, repository, license, commitDate, provenance };
}
