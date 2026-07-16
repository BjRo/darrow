import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { DarrowError } from "./errors";
import { sha256 } from "./io";
import type { ContentReference, HumanChoice, HumanRequest } from "./types";

export function createHumanRequest(input: {
  requestId: string;
  version: number;
  stepId: string | null;
  reason: string;
  question: string;
  choices: HumanChoice[];
  context?: HumanRequest["context"];
}): HumanRequest {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(input.requestId))
    throw new DarrowError(
      `invalid human request ID: ${input.requestId}`,
      "state",
    );
  if (!Number.isSafeInteger(input.version) || input.version < 1)
    throw new DarrowError("human request version must be positive", "state");
  if (input.choices.length === 0)
    throw new DarrowError("human request must declare a choice", "state");
  return { ...input, context: input.context ?? [] };
}

export function selectedChoice(
  request: HumanRequest,
  choice: string,
): HumanChoice {
  const selected = request.choices.find((candidate) => candidate.id === choice);
  if (!selected)
    throw new DarrowError(
      `continuation requires one of: ${request.choices.map((item) => item.id).join(", ")}`,
      "usage",
    );
  return selected;
}

export function assertCurrentRequest(
  current: HumanRequest | null,
  requestId: string,
  version: number,
): HumanRequest {
  if (!current) throw new DarrowError("run has no open human request", "state");
  if (current.requestId !== requestId || current.version !== version)
    throw new DarrowError(
      `stale continuation ${requestId}@${version}; current request is ${current.requestId}@${current.version}`,
      "state",
    );
  return current;
}

function contentPath(runDir: string, request: HumanRequest): string {
  return resolve(
    runDir,
    "content",
    "human",
    request.requestId,
    `response-v${request.version}.txt`,
  );
}

export async function storeHumanInstructions(
  repoRoot: string,
  runDir: string,
  request: HumanRequest,
  content: string | null,
): Promise<ContentReference | null> {
  if (content === null) return null;
  const bytes = new TextEncoder().encode(content);
  const path = contentPath(runDir, request);
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, bytes, { flag: "wx", mode: 0o444 });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "EEXIST"
    )
      throw error;
    const existing = new Uint8Array(await readFile(path));
    if (sha256(existing) !== sha256(bytes))
      throw new DarrowError(
        `immutable human response content already exists with different bytes: ${path}`,
        "immutable_violation",
      );
  }
  await chmod(path, 0o444);
  return {
    contentId: `human-response-${request.requestId}-v${request.version}`,
    mediaType: "text/plain",
    contentHash: sha256(bytes),
    size: bytes.byteLength,
    location: relative(repoRoot, path).replaceAll("\\", "/"),
  };
}

export async function readHumanInstructions(
  repoRoot: string,
  runDir: string,
  reference: ContentReference,
): Promise<string> {
  const path = resolve(repoRoot, reference.location);
  const contentRoot = resolve(runDir, "content");
  const fromContentRoot = relative(contentRoot, path);
  if (
    isAbsolute(fromContentRoot) ||
    fromContentRoot === ".." ||
    fromContentRoot.startsWith(`..${sep}`)
  )
    throw new DarrowError(
      `human content reference escapes its run: ${reference.location}`,
      "content_corrupt",
    );
  const bytes = new Uint8Array(await readFile(path));
  if (
    bytes.byteLength !== reference.size ||
    sha256(bytes) !== reference.contentHash
  )
    throw new DarrowError(
      `human content reference failed verification: ${reference.location}`,
      "content_corrupt",
    );
  return new TextDecoder().decode(bytes);
}
