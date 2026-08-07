import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { resolveCorpusSource } from "../../runner/corpus";

interface SourceRecord {
  repository: string;
  commit: string;
}

interface Manifest {
  version: number;
  cache_dir?: string;
  sources: Record<string, SourceRecord>;
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
  if (code !== 0) {
    throw new Error(`git ${args.join(" ")} failed (${code}): ${stderr.trim()}`);
  }
  return stdout.trim();
}

const { values } = parseArgs({
  options: { source: { type: "string", multiple: true } },
});
const manifestPath = join(import.meta.dir, "manifest.yaml");
const manifest = parseYaml(await readFile(manifestPath, "utf8")) as Manifest;
if (manifest.version !== 1 || !manifest.sources) {
  throw new Error("corpus manifest must use version 1 and define sources");
}
const requested = values.source ?? Object.keys(manifest.sources);
const unknown = requested.filter((id) => !manifest.sources[id]);
if (unknown.length)
  throw new Error(`unknown corpus source: ${unknown.join(", ")}`);

const cacheRoot = resolve(dirname(manifestPath), manifest.cache_dir ?? "cache");
await mkdir(cacheRoot, { recursive: true });
for (const id of requested) {
  const source = manifest.sources[id]!;
  const target = join(cacheRoot, id);
  if (!existsSync(join(target, ".git"))) {
    console.log(`Cloning ${id}...`);
    await git(cacheRoot, "clone", source.repository, id);
  } else {
    const dirty = await git(
      target,
      "status",
      "--porcelain",
      "--untracked-files=all",
    );
    if (dirty)
      throw new Error(`refusing to update dirty corpus source: ${target}`);
    const origin = await git(target, "remote", "get-url", "origin");
    if (origin !== source.repository) {
      throw new Error(`corpus source '${id}' has unexpected origin ${origin}`);
    }
  }
  if ((await git(target, "rev-parse", "--is-shallow-repository")) === "true") {
    console.log(`Materializing full history for ${id}...`);
    await git(target, "fetch", "--unshallow", "--no-filter", "origin");
  }
  await git(target, "fetch", "origin", source.commit);
  await git(target, "checkout", "--detach", source.commit);
  const resolved = await resolveCorpusSource(id, manifestPath);
  console.log(`Prepared ${resolved.id} at ${resolved.commit.slice(0, 12)}`);
}
