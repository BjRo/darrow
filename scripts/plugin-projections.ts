import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const PLUGINS_ROOT = resolve(ROOT, "plugins");
const GENERATOR_PATH = resolve(import.meta.path);
const GENERATOR_VERSION = "1.0.0";
const LOCK_NAME = "projection.lock.json";

const PROJECTIONS = {
  claude: "claude-skills",
  codex: "codex-skills",
} as const;

type Harness = keyof typeof PROJECTIONS;

interface NativeManifest {
  name: string;
  version: string;
  skills?: string | string[];
}

interface ProjectionLock {
  schemaVersion: 1;
  plugin: { name: string; version: string };
  generator: { version: string; digest: string };
  source: { path: "./source/"; digest: string };
  overlays: Record<Harness, { path: string; digest: string }>;
  projections: Record<Harness, { path: string; digest: string }>;
}

interface BuildResult {
  root: string;
  lockPath: string;
}

function normalized(path: string): string {
  return path.split(sep).join("/");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function files(root: string): Promise<string[]> {
  if (!(await exists(root))) return [];
  const found: string[] = [];
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) found.push(path);
      else
        throw new Error(
          `unsupported non-file projection input: ${normalized(relative(ROOT, path))}`,
        );
    }
  }
  await walk(root);
  return found;
}

async function digestTree(root: string): Promise<string> {
  const hash = createHash("sha256");
  for (const path of await files(root)) {
    hash.update(normalized(relative(root, path)));
    hash.update("\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function digestFile(path: string): Promise<string> {
  return `sha256:${createHash("sha256")
    .update(await readFile(path))
    .digest("hex")}`;
}

async function readManifest(path: string): Promise<NativeManifest> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`cannot read native manifest ${path}: ${String(error)}`);
  }
  if (!value || typeof value !== "object")
    throw new Error(`native manifest must be an object: ${path}`);
  return value as NativeManifest;
}

async function pluginNames(): Promise<string[]> {
  const entries = await readdir(PLUGINS_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function isProtectedOverlayPath(path: string): boolean {
  const parts = normalized(path).split("/");
  const withinSkill = parts.slice(1).join("/");
  return (
    withinSkill === "darrow.json" ||
    withinSkill === "scripts" ||
    withinSkill.startsWith("scripts/") ||
    withinSkill === "evals" ||
    withinSkill.startsWith("evals/") ||
    withinSkill.endsWith(".schema.json")
  );
}

async function validateOverlay(
  source: string,
  overlay: string,
  pluginName: string,
  harness: Harness,
): Promise<void> {
  for (const path of await files(overlay)) {
    const rel = normalized(relative(overlay, path));
    const skillName = rel.split("/")[0];
    if (!skillName || !(await exists(resolve(source, skillName, "SKILL.md"))))
      throw new Error(
        `${pluginName} ${harness} overlay targets unknown skill: ${rel}`,
      );
    if (isProtectedOverlayPath(rel))
      throw new Error(
        `${pluginName} ${harness} overlay cannot replace canonical mechanics: ${rel}`,
      );
  }
}

async function validateManifests(
  pluginDir: string,
  pluginName: string,
): Promise<{ name: string; version: string }> {
  const manifests = await Promise.all(
    (Object.keys(PROJECTIONS) as Harness[]).map(async (harness) => ({
      harness,
      value: await readManifest(
        resolve(pluginDir, `.${harness}-plugin`, "plugin.json"),
      ),
    })),
  );
  const [first, second] = manifests;
  if (
    !first ||
    !second ||
    first.value.name !== second.value.name ||
    first.value.version !== second.value.version
  )
    throw new Error(
      `${pluginName} native manifests must share identity and version`,
    );
  if (first.value.name !== pluginName)
    throw new Error(
      `${pluginName} directory disagrees with manifest name ${first.value.name}`,
    );
  for (const { harness, value } of manifests) {
    const expected = `./${PROJECTIONS[harness]}/`;
    if (value.skills !== expected)
      throw new Error(
        `${pluginName} ${harness} manifest must declare skills as ${expected}`,
      );
  }
  return { name: first.value.name, version: first.value.version };
}

async function buildPlugin(
  pluginName: string,
  destinationRoot: string,
): Promise<BuildResult> {
  const pluginDir = resolve(PLUGINS_ROOT, pluginName);
  const source = resolve(pluginDir, "source");
  if (!(await exists(source)))
    throw new Error(`${pluginName} is missing canonical source/`);
  const identity = await validateManifests(pluginDir, pluginName);
  const outputRoot = resolve(destinationRoot, pluginName);
  await mkdir(outputRoot, { recursive: true });

  const projectionDigests = {} as Record<Harness, string>;
  const overlayDigests = {} as Record<Harness, string>;
  for (const harness of Object.keys(PROJECTIONS) as Harness[]) {
    const overlay = resolve(pluginDir, "overlays", harness);
    await validateOverlay(source, overlay, pluginName, harness);
    const output = resolve(outputRoot, PROJECTIONS[harness]);
    await cp(source, output, { recursive: true, errorOnExist: true });
    if (await exists(overlay))
      await cp(overlay, output, { recursive: true, force: true });
    overlayDigests[harness] = await digestTree(overlay);
    projectionDigests[harness] = await digestTree(output);
  }

  const lock: ProjectionLock = {
    schemaVersion: 1,
    plugin: identity,
    generator: {
      version: GENERATOR_VERSION,
      digest: await digestFile(GENERATOR_PATH),
    },
    source: { path: "./source/", digest: await digestTree(source) },
    overlays: {
      claude: {
        path: "./overlays/claude/",
        digest: overlayDigests.claude,
      },
      codex: {
        path: "./overlays/codex/",
        digest: overlayDigests.codex,
      },
    },
    projections: {
      claude: {
        path: "./claude-skills/",
        digest: projectionDigests.claude,
      },
      codex: {
        path: "./codex-skills/",
        digest: projectionDigests.codex,
      },
    },
  };
  const lockPath = resolve(outputRoot, LOCK_NAME);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  return { root: outputRoot, lockPath };
}

async function difference(
  expectedRoot: string,
  actualRoot: string,
): Promise<string | undefined> {
  const expectedFiles = await files(expectedRoot);
  const actualFiles = await files(actualRoot);
  const expected = new Map(
    expectedFiles.map((path) => [
      normalized(relative(expectedRoot, path)),
      path,
    ]),
  );
  const actual = new Map(
    actualFiles.map((path) => [normalized(relative(actualRoot, path)), path]),
  );
  for (const rel of [
    ...new Set([...expected.keys(), ...actual.keys()]),
  ].sort()) {
    const expectedPath = expected.get(rel);
    const actualPath = actual.get(rel);
    if (!expectedPath) return `unexpected ${rel}`;
    if (!actualPath) return `missing ${rel}`;
    if (!(await readFile(expectedPath)).equals(await readFile(actualPath)))
      return `changed ${rel}`;
  }
  return undefined;
}

function remediation(pluginName: string): string {
  return `bun run plugins:generate -- ${pluginName}`;
}

async function generate(pluginName: string): Promise<void> {
  const pluginDir = resolve(PLUGINS_ROOT, pluginName);
  const temporary = await mkdtemp(resolve(pluginDir, ".projection-build-"));
  try {
    const built = await buildPlugin(pluginName, temporary);
    for (const directory of Object.values(PROJECTIONS)) {
      const actual = resolve(pluginDir, directory);
      await rm(actual, { recursive: true, force: true });
      await rename(resolve(built.root, directory), actual);
    }
    await rename(built.lockPath, resolve(pluginDir, LOCK_NAME));
    console.log(`generated plugin projections: ${pluginName}`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function check(pluginName: string): Promise<boolean> {
  const temporary = await mkdtemp(resolve(tmpdir(), "darrow-projections-"));
  try {
    const built = await buildPlugin(pluginName, temporary);
    const pluginDir = resolve(PLUGINS_ROOT, pluginName);
    for (const [harness, directory] of Object.entries(PROJECTIONS) as Array<
      [Harness, string]
    >) {
      const drift = await difference(
        resolve(built.root, directory),
        resolve(pluginDir, directory),
      );
      if (drift) {
        console.error(
          `error: stale generated projection for ${pluginName} (${harness}: ${drift}); run: ${remediation(pluginName)}`,
        );
        return false;
      }
    }
    const expectedLock = await readFile(built.lockPath);
    const actualLock = resolve(pluginDir, LOCK_NAME);
    if (
      !(await exists(actualLock)) ||
      !expectedLock.equals(await readFile(actualLock))
    ) {
      console.error(
        `error: stale projection lock for ${pluginName}; run: ${remediation(pluginName)}`,
      );
      return false;
    }
    console.log(`plugin projections current: ${pluginName}`);
    return true;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function affectedPlugins(paths: string[], allPlugins: string[]): string[] {
  if (paths.includes("scripts/plugin-projections.ts")) return allPlugins;
  const affected = new Set<string>();
  const relevant =
    /^(source|overlays|claude-skills|codex-skills)(\/|$)|^(projection\.lock\.json|\.claude-plugin\/plugin\.json|\.codex-plugin\/plugin\.json)$/;
  for (const path of paths) {
    const match = /^plugins\/([^/]+)\/(.+)$/.exec(path);
    if (match?.[1] && match[2] && relevant.test(match[2]))
      affected.add(match[1]);
  }
  return [...affected].sort((left, right) => left.localeCompare(right));
}

async function stagedPaths(worktree: string): Promise<string[]> {
  const result = Bun.spawnSync(
    [
      "git",
      "-C",
      worktree,
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMRD",
      "-z",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0)
    throw new Error(
      `cannot inspect staged projection inputs: ${result.stderr.toString().trim()}`,
    );
  return result.stdout.toString().split("\0").filter(Boolean);
}

async function selectPlugins(requested?: string): Promise<string[]> {
  const all = await pluginNames();
  if (!requested) return all;
  if (!all.includes(requested)) throw new Error(`unknown plugin: ${requested}`);
  return [requested];
}

async function runChecks(names: string[]): Promise<void> {
  let current = true;
  for (const name of names) current = (await check(name)) && current;
  if (!current) process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, first, ...extra] = Bun.argv.slice(2);
  if (extra.length > 0 || !command) {
    console.error(
      "usage: plugin-projections.ts <generate|check> [plugin] | check-staged <worktree>",
    );
    process.exitCode = 2;
    return;
  }
  if (command === "generate") {
    for (const name of await selectPlugins(first)) await generate(name);
    return;
  }
  if (command === "check") {
    await runChecks(await selectPlugins(first));
    return;
  }
  if (command === "check-staged") {
    if (!first) throw new Error("check-staged requires the original worktree");
    const all = await pluginNames();
    const affected = affectedPlugins(await stagedPaths(first), all);
    if (affected.length === 0) {
      console.log("plugin projections: no affected plugins");
      return;
    }
    await runChecks(affected);
    return;
  }
  console.error(`unknown command: ${command}`);
  process.exitCode = 2;
}

await main().catch((error) => {
  console.error(
    `error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
