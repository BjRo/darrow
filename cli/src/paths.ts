import { dirname, resolve } from "node:path";

export const CLI_ROOT = resolve(import.meta.dir, "..");
export const SCHEMAS_DIR = resolve(CLI_ROOT, "schemas");
export const BUNDLED_WORKFLOWS_DIR = resolve(CLI_ROOT, "workflows");
export const BUNDLED_PROFILES_DIR = resolve(CLI_ROOT, "profiles");
export const SOURCE_PLUGIN_ROOT = resolve(CLI_ROOT, "..", "plugins");

export function userDarrowHome(): string {
  const explicit = process.env.DARROW_HOME;
  if (explicit) return resolve(explicit);
  const home = process.env.HOME;
  if (!home) throw new Error("HOME is unavailable; set DARROW_HOME explicitly");
  return resolve(home, ".darrow");
}

export function globalToolchainHome(): string {
  const explicit = process.env.DARROW_TOOLCHAIN_HOME;
  if (explicit) return resolve(explicit);
  const home = process.env.HOME;
  if (!home)
    throw new Error(
      "HOME is unavailable; set DARROW_TOOLCHAIN_HOME explicitly",
    );
  return resolve(home, ".local", "share", "darrow", "toolchains");
}

export function parent(path: string): string {
  return dirname(resolve(path));
}
