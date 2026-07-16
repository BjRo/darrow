#!/usr/bin/env bun
import { chmod, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { DarrowError } from "./errors";
import { exists, hashFile, readJson, replaceJson } from "./io";
import { CLI_ROOT, globalToolchainHome } from "./paths";
import { primaryRepoRoot } from "./repository";

interface Manifest {
  version: string;
  baseUrl: string;
  platforms: Record<string, { asset: string; sha256: string }>;
}

function platformKey(): string {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : process.platform;
  const arch = process.arch === "x64" ? "amd64" : process.arch;
  return `${os}-${arch}`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let scope: "global" | "local" | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--scope") {
      const value = args[index + 1];
      if (value !== "global" && value !== "local") throw new DarrowError("--scope must be global or local", "usage");
      scope = value;
      index += 1;
    } else if (args[index] !== "--temporal-only") throw new DarrowError(`unknown installer argument: ${args[index]}`, "usage");
  }
  if (!scope) throw new DarrowError("installation scope is required: darrow-install --scope global|local", "usage");
  const manifest = await readJson<Manifest>(resolve(CLI_ROOT, "temporal.json"));
  const key = platformKey();
  const platform = manifest.platforms[key];
  if (!platform) throw new DarrowError(`Temporal ${manifest.version} is not packaged for ${key}`, "unsupported_platform");
  const root = scope === "global"
    ? resolve(globalToolchainHome(), "temporal", manifest.version, key)
    : resolve(primaryRepoRoot(), ".darrow", "runtime", "toolchain", manifest.version, key);
  const binary = resolve(root, "temporal");
  if (await exists(binary)) {
    const version = Bun.spawnSync([binary, "--version"], { stdout: "pipe", stderr: "pipe" });
    if (version.exitCode === 0 && version.stdout.toString().includes(manifest.version)) {
      console.log(`Temporal ${manifest.version} already installed at ${binary}`);
      return;
    }
    throw new DarrowError(`refusing to replace incompatible executable at ${binary}`, "installation");
  }
  const temp = await mkdtemp(resolve(tmpdir(), "darrow-temporal-"));
  try {
    const archive = resolve(temp, platform.asset);
    const response = await fetch(`${manifest.baseUrl}/${platform.asset}`);
    if (!response.ok) throw new DarrowError(`Temporal download failed: HTTP ${response.status}`, "installation");
    await Bun.write(archive, await response.arrayBuffer());
    const digest = (await hashFile(archive)).slice("sha256:".length);
    if (digest !== platform.sha256) throw new DarrowError(`Temporal archive checksum mismatch for ${platform.asset}`, "installation");
    const extract = Bun.spawnSync(["tar", "-xzf", archive, "-C", temp], { stdout: "pipe", stderr: "pipe" });
    if (extract.exitCode !== 0) throw new DarrowError(`cannot extract Temporal: ${extract.stderr.toString().trim()}`, "installation");
    const extracted = resolve(temp, "temporal");
    if (!(await exists(extracted))) throw new DarrowError("Temporal archive did not contain the temporal executable", "installation");
    await mkdir(root, { recursive: true });
    await rename(extracted, binary);
    await chmod(binary, 0o755);
    await replaceJson(resolve(root, "install.json"), { schemaVersion: "0.1.0", component: "temporal", version: manifest.version, platform: key, asset: platform.asset, archiveSha256: platform.sha256, installedAt: new Date().toISOString(), scope });
    console.log(`Installed Temporal ${manifest.version} for ${key} at ${binary}`);
  } finally { await rm(temp, { recursive: true, force: true }); }
}

main().catch((error) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(error instanceof DarrowError ? error.exitCode : 1);
});
