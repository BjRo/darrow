import {
  mkdtemp,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

function missingPath(error: NodeJS.ErrnoException) {
  if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
  throw error;
}

async function pathIdentity(path: string) {
  const directory = await realpath(dirname(path)).catch(missingPath);
  const info = await stat(path, { bigint: true }).catch(missingPath);
  return {
    path: resolve(directory ?? dirname(path), basename(path)),
    inode: info ? `${info.dev}:${info.ino}` : null,
  };
}

async function protectedOutput(inputs: { path: string }[], output: string) {
  const destination = await pathIdentity(output);
  const sources = await Promise.all(
    inputs.map(async (input) => ({
      input: input.path,
      identity: await pathIdentity(input.path),
    })),
  );
  const source = sources.find(
    ({ identity }) =>
      destination.path === identity.path ||
      (destination.inode !== null && destination.inode === identity.inode),
  );
  if (source)
    throw new Error(`--output cannot replace input archive: ${source.input}`);
  return destination.path;
}

export async function writeLegacyMarkdown(
  inputs: { path: string }[],
  requestedOutput: string,
  content: string,
) {
  const output = await protectedOutput(inputs, requestedOutput);
  const temporary = await mkdtemp(join(dirname(output), ".darrow-report-"));
  try {
    const path = join(temporary, "report.md");
    await writeFile(path, content);
    await rename(path, output);
    return output;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
