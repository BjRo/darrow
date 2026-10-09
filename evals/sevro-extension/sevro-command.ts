import { existsSync, readFileSync } from "node:fs";
import { delimiter, isAbsolute, join, relative, resolve, sep } from "node:path";

function installedCommand(): string {
  const toolingRoot = resolve(import.meta.dir, "../..");
  const name = "@bjoernrochel/sevro";
  const declared = JSON.parse(
    readFileSync(join(toolingRoot, "package.json"), "utf8"),
  ).devDependencies?.[name];
  if (
    typeof declared !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/.test(declared)
  )
    throw new Error("Darrow requires an exact Sevro development dependency");
  const installed = join(toolingRoot, "node_modules", "@bjoernrochel", "sevro");
  if (!existsSync(join(installed, "package.json")))
    throw new Error(
      "Sevro is not installed; run bun install --frozen-lockfile",
    );
  const manifest = JSON.parse(
    readFileSync(join(installed, "package.json"), "utf8"),
  );
  if (manifest.name !== name || manifest.version !== declared)
    throw new Error("Installed Sevro does not match Darrow's exact dependency");
  const command = join(
    toolingRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "sevro.cmd" : "sevro",
  );
  if (!existsSync(command))
    throw new Error("Installed Sevro command is missing");
  return command;
}

/** Resolve the frozen tooling dependency or an explicit development route. */
export function sevroCommand(): {
  launch: string[];
  extraArgs: string[];
  source: "package" | "checkout";
} {
  const packageBin = process.env.SEVRO_PACKAGE_BIN;
  const checkout = process.env.SEVRO_CHECKOUT;
  if (packageBin !== undefined && checkout !== undefined)
    throw new Error(
      "select exactly one of SEVRO_PACKAGE_BIN or SEVRO_CHECKOUT",
    );
  if (packageBin !== undefined) {
    if (!isAbsolute(packageBin))
      throw new Error("SEVRO_PACKAGE_BIN must be absolute");
    return { launch: [packageBin], extraArgs: [], source: "package" };
  }
  if (checkout === undefined)
    return { launch: [installedCommand()], extraArgs: [], source: "package" };
  if (!isAbsolute(checkout)) throw new Error("SEVRO_CHECKOUT must be absolute");
  return {
    launch: [process.execPath, join(checkout, "src/cli.ts")],
    extraArgs: ["--runner-checkout-root", checkout],
    source: "checkout",
  };
}

const toolingRoot = resolve(import.meta.dir, "../..");

function inside(root: string, path: string): boolean {
  const child = relative(root, path);
  return (
    child === "" ||
    (!child.startsWith(`..${sep}`) && child !== ".." && !isAbsolute(child))
  );
}

/** Entries that must not become Sevro read grants for inherited host tools. */
function excludedToolPath(entry: string): boolean {
  return (
    !isAbsolute(entry) ||
    inside(toolingRoot, entry) ||
    entry.endsWith(`${sep}node_modules${sep}.bin`) ||
    /[\\/](?:bun-node-[^\\/]+|bunx-[^\\/]+)(?:$|[\\/])/.test(entry) ||
    // Sevro rc.3 cannot scan macOS sbin directories; its checks add them itself.
    entry === "/usr/sbin" ||
    entry === "/sbin"
  );
}

function uvPythonInstallDir(): string | undefined {
  const uv = Bun.which("uv");
  if (!uv) return undefined;
  const result = Bun.spawnSync([uv, "python", "dir"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const path = result.stdout.toString().trim();
  return result.exitCode === 0 && isAbsolute(path) ? path : undefined;
}

/** Host tool environment Darrow hands to Sevro's runtime policy. */
export function sevroEnvironment(
  environment: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const path = (environment.PATH ?? "")
    .split(delimiter)
    .filter((entry) => entry && !excludedToolPath(entry));
  const uvPython = environment.UV_PYTHON_INSTALL_DIR ?? uvPythonInstallDir();
  return {
    ...environment,
    PATH: [...new Set(path)].join(delimiter),
    ...(uvPython ? { UV_PYTHON_INSTALL_DIR: uvPython } : {}),
  };
}
