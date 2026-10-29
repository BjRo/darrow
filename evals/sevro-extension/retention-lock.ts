import { Database } from "bun:sqlite";
import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";

/** Serialize filesystem publication and cleanup; the OS releases crash locks. */
export function retentionTransaction<T>(root: string, action: () => T): T {
  const path = join(root, ".retention.sqlite");
  if (existsSync(path) && !lstatSync(path).isFile())
    throw new Error("retention lock must be a regular file");
  const db = new Database(path, { create: true });
  try {
    db.exec("PRAGMA busy_timeout = 30000");
    return db.transaction(action).immediate();
  } finally {
    db.close();
  }
}
