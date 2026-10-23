import { afterAll } from "bun:test";
import {
  cp,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const pythonRoots: string[] = [];
let pythonRuntime: Promise<string> | undefined;
afterAll(async () => {
  await pythonRuntime?.catch(() => undefined);
  pythonRuntime = undefined;
  await Promise.all(
    pythonRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function publicPythonRuntime(uv: string) {
  const runtime = await mkdtemp(join(tmpdir(), "darrow-fixture-python-"));
  pythonRoots.push(runtime);
  const stdout = join(runtime, "stdout");
  const stderr = join(runtime, "stderr");
  await Promise.all([writeFile(stdout, ""), writeFile(stderr, "")]);
  const found = Bun.spawn([uv, "python", "find", "--managed-python", "3.13"], {
    env: { ...process.env, UV_PYTHON_DOWNLOADS: "never" },
    stdin: "ignore",
    stdout: Bun.file(stdout),
    stderr: Bun.file(stderr),
  });
  const exitCode = await found.exited;
  const interpreterPath = (await readFile(stdout, "utf8")).trim();
  if (exitCode !== 0 || !interpreterPath)
    throw new Error(
      `UV interpreter lookup exited ${exitCode}: ${(await readFile(stderr, "utf8")) || "empty interpreter path"}`,
    );
  const interpreter = await realpath(interpreterPath);
  await cp(dirname(dirname(interpreter)), runtime, { recursive: true });
  return quote(join(runtime, "bin", basename(interpreter)));
}

/** Prepare public UV tools outside the protected developer home. */
export async function prepareUvFixtureRuntime(includeNode = false) {
  const uv = Bun.which("uv");
  if (!uv) throw new Error("fixture tool is unavailable: uv");
  // Fixture scripts share executable assets, while each case owns its workspace.
  pythonRuntime ??= publicPythonRuntime(uv);
  const python = await pythonRuntime;
  const bin: Record<string, string> = {
    python: `#!/bin/sh\nexec ${python} "$@"\n`,
    python3: `#!/bin/sh\nexec ${python} "$@"\n`,
  };
  for (const name of includeNode ? ["node", "uv"] : ["uv"]) {
    const executable = Bun.which(name);
    if (!executable) throw new Error(`fixture tool is unavailable: ${name}`);
    bin[name] =
      `#!/bin/sh\n${name === "uv" ? `export UV_OFFLINE=1 UV_PYTHON_DOWNLOADS=never UV_PYTHON=${python}\n` : ""}exec ${quote(executable)} "$@"\n`;
  }
  return { bin, setupPrefix: `export UV_PYTHON=${python}` };
}
