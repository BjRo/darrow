import {
  chmod,
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { relative, resolve } from "node:path";
import {
  hashDirectory,
  hashFile,
  listFiles,
  makeReadOnly,
  readJson,
  writeJson,
} from "./io";
import { DarrowError } from "./errors";
import { validateSchema } from "./schema";
import type { ArtifactReference } from "./types";

export async function checkpointEvidence(
  repoRoot: string,
  runDir: string,
  stepId: string,
  attemptId: string,
  evidenceDir: string,
  evidenceSchema: string,
): Promise<ArtifactReference> {
  async function rejectSymlinks(path: string): Promise<void> {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isSymbolicLink())
        throw new DarrowError(
          `evidence contains a symbolic link: ${child}`,
          "evidence",
        );
      if (entry.isDirectory()) await rejectSymlinks(child);
    }
  }
  await rejectSymlinks(evidenceDir);
  const destination = resolve(
    runDir,
    "artifacts",
    stepId,
    attemptId,
    "tdd-evidence",
  );
  await mkdir(resolve(destination, ".."), { recursive: true });
  await cp(evidenceDir, destination, {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
  for (const phase of ["red", "green", "regression"]) {
    const metaPath = resolve(destination, `${phase}.meta`);
    await chmod(metaPath, 0o644);
    const text = await readFile(metaPath, "utf8");
    const portable = text
      .replace(/^stdout=.*$/m, `stdout=./${phase}.stdout`)
      .replace(/^stderr=.*$/m, `stderr=./${phase}.stderr`);
    await writeFile(metaPath, portable);
  }
  let size = 0;
  for (const path of await listFiles(destination))
    size += (await stat(path)).size;
  const reference: ArtifactReference = {
    schemaVersion: "0.1.0",
    artifactId: crypto.randomUUID(),
    type: "darrow.tdd-evidence",
    schema:
      "https://darrow.dev/contracts/darrow-delivery/implement/output/0.1.0#/$defs/phase",
    schemaDigest: await hashFile(evidenceSchema),
    contentHash: await hashDirectory(destination),
    size,
    stepId,
    attemptId,
    location: relative(repoRoot, destination).replaceAll("\\", "/"),
    createdAt: new Date().toISOString(),
  };
  await validateSchema("artifact.schema.json", reference, "artifact reference");
  await writeJson(resolve(destination, "..", "artifact.json"), reference);
  await makeReadOnly(destination);
  return reference;
}

export async function verifyArtifacts(
  repoRoot: string,
  runDir: string,
): Promise<void> {
  const root = resolve(runDir, "artifacts");
  const eventsPath = resolve(runDir, "events.jsonl");
  const references: ArtifactReference[] = [];
  if (await Bun.file(eventsPath).exists()) {
    for (const line of (await Bun.file(eventsPath).text())
      .split("\n")
      .filter(Boolean)) {
      const item = JSON.parse(line) as {
        type?: string;
        data?: { artifacts?: ArtifactReference[] };
      };
      if (item.type === "command.invocation.completed")
        references.push(...(item.data?.artifacts ?? []));
    }
  }
  for (const expected of references) {
    const destination = resolve(repoRoot, expected.location);
    const path = resolve(destination, "..", "artifact.json");
    if (!(await Bun.file(path).exists()))
      throw new DarrowError(
        `missing artifact record: ${expected.artifactId}`,
        "immutable_violation",
      );
    const reference = await readJson<ArtifactReference>(path);
    await validateSchema(
      "artifact.schema.json",
      reference,
      "artifact reference",
    );
    if (
      reference.artifactId !== expected.artifactId ||
      reference.contentHash !== expected.contentHash ||
      reference.location !== expected.location
    )
      throw new DarrowError(
        `artifact record disagrees with its completion event: ${expected.artifactId}`,
        "immutable_violation",
      );
    const inside = relative(root, destination);
    if (inside.startsWith("..") || resolve(root, inside) !== destination)
      throw new DarrowError(
        `artifact location escapes its run: ${reference.location}`,
        "immutable_violation",
      );
    if ((await hashDirectory(destination)) !== reference.contentHash)
      throw new DarrowError(
        `artifact content digest mismatch: ${reference.artifactId}`,
        "immutable_violation",
      );
  }
}
