import { rename, rm, writeFile } from "node:fs/promises";
import { renameSync, rmSync, writeFileSync } from "node:fs";

/** Used only inside the short, synchronous ownership transaction. */
export function atomicWriteJsonSync(path: string, value: unknown): void {
  const temporary = `${path}.tmp-${crypto.randomUUID()}`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

/** Independent writers never share a temporary filename or expose partial JSON. */
export async function atomicWriteJson(
  path: string,
  value: unknown,
): Promise<void> {
  const temporary = `${path}.tmp-${crypto.randomUUID()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
