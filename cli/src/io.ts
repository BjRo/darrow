import { createHash, randomUUID } from "node:crypto";
import { chmod, cp, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DarrowError } from "./errors";

export async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

export async function readText(path: string): Promise<string> {
  try { return await readFile(path, "utf8"); }
  catch (error) { throw new DarrowError(`cannot read ${resolve(path)}: ${String(error)}`, "unreadable_file"); }
}

export async function readJson<T>(path: string): Promise<T> {
  const text = await readText(path);
  try { return JSON.parse(text) as T; }
  catch (error) { throw new DarrowError(`invalid JSON in ${resolve(path)}: ${String(error)}`, "invalid_schema"); }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

export async function replaceJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, path);
}

export function sha256(value: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export async function hashFile(path: string): Promise<string> {
  return sha256(new Uint8Array(await readFile(path)));
}

export async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk(resolve(root));
  return files;
}

export async function hashDirectory(root: string): Promise<string> {
  const hash = createHash("sha256");
  for (const path of await listFiles(root)) {
    hash.update(relative(root, path).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

export async function copyTree(source: string, destination: string): Promise<void> {
  if (await exists(destination)) throw new DarrowError(`snapshot destination already exists: ${destination}`, "immutable_violation");
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
}

export async function makeReadOnly(root: string): Promise<void> {
  for (const path of (await listFiles(root)).reverse()) await chmod(path, 0o444);
  const directories: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(resolve(dir, entry.name));
    }
    directories.push(dir);
  }
  await walk(resolve(root));
  for (const path of directories) await chmod(path, 0o555);
}

export async function appendLine(path: string, line: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${line}\n`, { flag: "a" });
}
