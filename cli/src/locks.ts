import { mkdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { DarrowError } from "./errors";
import { exists, readJson, writeJson } from "./io";

interface LockOwner {
  schemaVersion: "0.1.0";
  pid: number;
  token: string;
  acquiredAt: string;
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function owner(path: string): Promise<LockOwner | null> {
  try { return await readJson<LockOwner>(resolve(path, "owner.json")); }
  catch { return null; }
}

async function reclaimIfStale(path: string): Promise<boolean> {
  const observed = await owner(path);
  if (observed && alive(observed.pid)) return false;
  if (!observed) {
    try {
      const info = await stat(path);
      if (Date.now() - info.mtimeMs < 5_000) return false;
    } catch { return true; }
  }
  const current = await owner(path);
  if (observed?.token !== current?.token || current && alive(current.pid)) return false;
  await rm(path, { recursive: true, force: true });
  return true;
}

export async function withDirectoryLock<T>(path: string, label: string, operation: () => Promise<T>): Promise<T> {
  const token = crypto.randomUUID();
  let acquired = false;
  for (let attempt = 0; attempt < 350; attempt += 1) {
    let created = false;
    try {
      await mkdir(path);
      created = true;
      try {
        await writeJson(resolve(path, "owner.json"), { schemaVersion: "0.1.0", pid: process.pid, token, acquiredAt: new Date().toISOString() } satisfies LockOwner);
        acquired = true;
        break;
      } catch (error) {
        await rm(path, { recursive: true, force: true });
        throw error;
      }
    } catch (error) {
      if (acquired) throw error;
      if (created) throw error;
      if (await exists(path)) await reclaimIfStale(path);
      if (attempt === 349) throw new DarrowError(`${label} lock is busy: ${path}`, "concurrency");
      await Bun.sleep(20);
    }
  }
  try { return await operation(); }
  finally {
    if (acquired) {
      const current = await owner(path);
      if (current?.token === token) await rm(path, { recursive: true, force: true });
    }
  }
}
