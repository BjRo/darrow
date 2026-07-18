import {
  lstat,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { SanitizationManifest } from "./types";

const PROHIBITED_NAMES = new Set([
  ".agent-shared",
  ".agentbox.yml",
  ".agents",
  ".aider.conf.yml",
  ".aiderignore",
  ".beans",
  ".beans.yml",
  ".claude",
  ".codex",
  ".cursor",
  ".darrow",
  ".demos",
  ".github-copilot",
  ".roo",
  ".windsurfrules",
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
]);

function prohibited(relativePath: string): boolean {
  const parts = relativePath.split("/");
  const name = parts.at(-1)!;
  if (parts.some((part) => PROHIBITED_NAMES.has(part))) return true;
  if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example"))
    return true;
  return (
    relativePath === ".github/copilot-instructions.md" ||
    relativePath.startsWith(".github/instructions/")
  );
}

async function pathsUnder(root: string): Promise<string[]> {
  const paths: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const rel = relative(root, absolute).split(sep).join("/");
      paths.push(rel);
      if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(absolute);
    }
  }
  await visit(root);
  return paths.sort();
}

async function digestTree(root: string, paths: string[]): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for (const path of paths) {
    const stat = await lstat(resolve(root, path));
    hasher.update(`${path}\0${stat.mode}\0`);
    if (stat.isFile()) hasher.update(await readFile(resolve(root, path)));
    else if (stat.isSymbolicLink()) {
      hasher.update(await readlink(resolve(root, path)));
    }
    hasher.update("\0");
  }
  return `sha256:${hasher.digest("hex")}`;
}

export async function sanitizeWorkspace(
  root: string,
  sourceRevision: string,
  manifestPath?: string,
): Promise<SanitizationManifest> {
  const absoluteRoot = await realpath(root);
  const before = await pathsUnder(absoluteRoot);
  const removals = before
    .filter(prohibited)
    .filter(
      (path) =>
        !before.some(
          (candidate) =>
            candidate !== path &&
            prohibited(candidate) &&
            path.startsWith(candidate + "/"),
        ),
    );
  for (const path of removals)
    await rm(resolve(absoluteRoot, path), { recursive: true, force: true });

  const retained = await pathsUnder(absoluteRoot);
  const residual = retained.filter(prohibited);
  if (residual.length)
    throw new Error(
      `sanitization left prohibited paths: ${residual.join(", ")}`,
    );
  for (const path of retained) {
    const stat = await lstat(resolve(absoluteRoot, path));
    if (!stat.isSymbolicLink()) continue;
    const target = await realpath(resolve(absoluteRoot, path)).catch(() => "");
    const rel = relative(absoluteRoot, target);
    if (!target || rel.startsWith("..") || rel.startsWith(sep))
      throw new Error(`sanitization found escaping symlink: ${path}`);
  }

  const files = [] as string[];
  for (const path of retained)
    if ((await lstat(resolve(absoluteRoot, path))).isFile()) files.push(path);
  const manifest: SanitizationManifest = {
    schemaVersion: "1.0.0",
    sourceRevision,
    removedPaths: removals,
    retainedFileCount: files.length,
    treeDigest: await digestTree(absoluteRoot, retained),
  };
  if (manifestPath)
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
