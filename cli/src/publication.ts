import { chmod, cp, lstat, mkdir, readdir, rename, rm } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { DarrowError } from "./errors";
import {
  canonicalJson,
  exists,
  hashDirectory,
  readJson,
  replaceJson,
  sha256,
  writeJson,
} from "./io";
import { withDirectoryLock } from "./locks";
import { validateSchema } from "./schema";
import type {
  ArtifactReference,
  PublicationActivityInput,
  PublicationActivityResult,
  PublishedArtifact,
  TicketIdentity,
  TicketPublicationRecord,
  TicketPublicationResult,
} from "./types";

export function ticketPublicationKey(ticket: TicketIdentity): string {
  return sha256(
    canonicalJson({
      backend: ticket.backend,
      project: ticket.project,
      nativeId: ticket.nativeId,
    }),
  ).slice("sha256:".length);
}

function inside(root: string, path: string): boolean {
  const child = relative(resolve(root), resolve(path));
  return child.length > 0 && !child.startsWith("..") && child !== "..";
}

function requirePathSegment(value: string, label: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(value))
    throw new DarrowError(
      `ticket publication ${label} is not a safe path segment: ${value}`,
      "publication",
    );
}

async function rejectSymlinks(path: string): Promise<void> {
  const info = await lstat(path);
  if (info.isSymbolicLink())
    throw new DarrowError(
      `ticket publication refuses a symbolic link: ${resolve(path)}`,
      "publication",
    );
  if (!info.isDirectory()) return;
  for (const entry of await readdir(path))
    await rejectSymlinks(resolve(path, entry));
}

async function makeStagingRemovable(path: string): Promise<void> {
  if (!(await exists(path))) return;
  const info = await lstat(path);
  if (info.isSymbolicLink()) return;
  if (info.isDirectory()) {
    await chmod(path, 0o700);
    for (const entry of await readdir(path))
      await makeStagingRemovable(resolve(path, entry));
  } else await chmod(path, 0o600);
}

function validateTicket(ticket: TicketIdentity): void {
  for (const [name, value] of Object.entries(ticket))
    if (typeof value !== "string" || value.trim().length === 0)
      throw new DarrowError(
        `ticket publication ${name} must be a nonempty string`,
        "publication",
      );
  let url: URL;
  try {
    url = new URL(ticket.url);
  } catch {
    throw new DarrowError(
      `ticket publication URL is not absolute: ${ticket.url}`,
      "publication",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username.length > 0 ||
    url.password.length > 0
  )
    throw new DarrowError(
      `ticket publication URL must be an HTTP(S) URL without credentials: ${ticket.url}`,
      "publication",
    );
}

async function validateSource(
  input: PublicationActivityInput,
  artifact: ArtifactReference,
): Promise<string> {
  await validateSchema("artifact.schema.json", artifact, "published artifact");
  if (
    artifact.stepId !== input.stepId ||
    artifact.attemptId !== input.attemptId
  )
    throw new DarrowError(
      `artifact ${artifact.artifactId} does not belong to publication attempt ${input.stepId}/${input.attemptId}`,
      "publication",
    );
  const source = resolve(input.repoRoot, artifact.location);
  const artifactRoot = resolve(input.runDir, "artifacts");
  if (!inside(artifactRoot, source))
    throw new DarrowError(
      `artifact publication source escapes its run: ${source}`,
      "publication",
    );
  await rejectSymlinks(source);
  if ((await hashDirectory(source)) !== artifact.contentHash)
    throw new DarrowError(
      `artifact content digest mismatch: ${artifact.artifactId}`,
      "immutable_violation",
    );
  return source;
}

function sameTicket(left: TicketIdentity, right: TicketIdentity): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function samePublication(
  left: PublishedArtifact,
  right: PublishedArtifact,
): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

export async function publishTicketArtifacts(
  input: PublicationActivityInput,
): Promise<TicketPublicationResult> {
  if (
    resolve(input.runDir) !==
    resolve(input.repoRoot, ".darrow", "runs", input.runId)
  )
    throw new DarrowError(
      `publication run directory does not match run ${input.runId}: ${resolve(input.runDir)}`,
      "publication",
    );
  requirePathSegment(input.stepId, "step ID");
  requirePathSegment(input.attemptId, "attempt ID");
  validateTicket(input.publication.ticket);
  const selected = input.artifacts.filter((artifact) =>
    input.publication.artifactTypes.includes(artifact.type),
  );
  for (const type of input.publication.artifactTypes)
    if (!selected.some((artifact) => artifact.type === type))
      throw new DarrowError(
        `publication step ${input.stepId} produced no artifact of declared type ${type}`,
        "publication",
      );
  const seen = new Set<string>();
  for (const artifact of selected) {
    if (seen.has(artifact.artifactId))
      throw new DarrowError(
        `publication step ${input.stepId} produced duplicate artifact ID ${artifact.artifactId}`,
        "publication",
      );
    seen.add(artifact.artifactId);
  }
  const sources = new Map<string, string>();
  for (const artifact of selected)
    sources.set(artifact.artifactId, await validateSource(input, artifact));

  const ticketKey = ticketPublicationKey(input.publication.ticket);
  const ticketsRoot = resolve(input.repoRoot, ".darrow", "tickets");
  const ticketDir = resolve(ticketsRoot, ticketKey);
  const ticketPath = resolve(ticketDir, "ticket.json");
  const lockRoot = resolve(input.repoRoot, ".darrow", "locks", "tickets");
  await mkdir(lockRoot, { recursive: true });
  await rejectSymlinks(ticketsRoot);

  return withDirectoryLock(
    resolve(lockRoot, `${ticketKey}.lock`),
    `ticket ${ticketKey} publication`,
    async () => {
      let record: TicketPublicationRecord;
      if (await exists(ticketPath)) {
        record = await readJson<TicketPublicationRecord>(ticketPath);
        await validateSchema(
          "ticket-publication.schema.json",
          record,
          `ticket publication ${ticketKey}`,
        );
        if (
          record.ticketKey !== ticketKey ||
          !sameTicket(record.ticket, input.publication.ticket)
        )
          throw new DarrowError(
            `ticket publication identity conflicts with ${ticketPath}`,
            "immutable_violation",
          );
      } else {
        if (await exists(ticketDir)) await rejectSymlinks(ticketDir);
        record = {
          schemaVersion: "0.1.0",
          ticketKey,
          ticket: input.publication.ticket,
          publications: [],
        };
      }

      const published: PublishedArtifact[] = [];
      for (const artifact of selected) {
        const publicationId = sha256(
          canonicalJson({
            ticketKey,
            runId: input.runId,
            artifactId: artifact.artifactId,
            contentHash: artifact.contentHash,
          }),
        ).slice("sha256:".length);
        const artifactName = `${publicationId}-${basename(artifact.location)}`;
        const destination = resolve(
          ticketDir,
          "artifacts",
          artifact.stepId,
          artifact.attemptId,
          artifactName,
        );
        const existing = record.publications.find(
          (item) => item.publicationId === publicationId,
        );
        const candidate: PublishedArtifact = {
          publicationId,
          artifactId: artifact.artifactId,
          runId: input.runId,
          stepId: artifact.stepId,
          attemptId: artifact.attemptId,
          type: artifact.type,
          contentHash: artifact.contentHash,
          size: artifact.size,
          sourceLocation: artifact.location,
          location: relative(input.repoRoot, destination).replaceAll("\\", "/"),
          publishedAt: existing?.publishedAt ?? new Date().toISOString(),
        };
        if (existing && !samePublication(existing, candidate))
          throw new DarrowError(
            `publication ${publicationId} conflicts with ${ticketPath}`,
            "immutable_violation",
          );
        if (await exists(destination)) {
          await rejectSymlinks(destination);
          if ((await hashDirectory(destination)) !== artifact.contentHash)
            throw new DarrowError(
              `published artifact digest mismatch: ${publicationId}`,
              "immutable_violation",
            );
        } else {
          const staging = resolve(
            input.repoRoot,
            ".darrow",
            "runtime",
            "publications",
            `${publicationId}-${crypto.randomUUID()}`,
          );
          try {
            await mkdir(resolve(staging, ".."), { recursive: true });
            await cp(sources.get(artifact.artifactId)!, staging, {
              recursive: true,
              errorOnExist: true,
              force: false,
            });
            if ((await hashDirectory(staging)) !== artifact.contentHash)
              throw new DarrowError(
                `staged publication digest mismatch: ${publicationId}`,
                "immutable_violation",
              );
            await mkdir(resolve(destination, ".."), { recursive: true });
            await chmod(staging, 0o755);
            await rename(staging, destination);
            await chmod(destination, 0o555);
          } finally {
            await makeStagingRemovable(staging);
            await rm(staging, { recursive: true, force: true });
          }
        }
        if (!existing) record.publications.push(candidate);
        published.push(existing ?? candidate);
      }
      record.publications.sort((left, right) =>
        left.publicationId.localeCompare(right.publicationId),
      );
      await validateSchema(
        "ticket-publication.schema.json",
        record,
        `ticket publication ${ticketKey}`,
      );
      if (await exists(ticketPath)) await replaceJson(ticketPath, record);
      else await writeJson(ticketPath, record);
      return { ticketKey, ticket: record.ticket, artifacts: published };
    },
  );
}

export async function executeTicketPublication(
  input: PublicationActivityInput,
): Promise<PublicationActivityResult> {
  try {
    return {
      status: "succeeded",
      publication: await publishTicketArtifacts(input),
    };
  } catch (error) {
    return {
      status: "failed",
      error: {
        category:
          error instanceof DarrowError ? error.category : "infrastructure",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function verifyPublishedArtifacts(
  repoRoot: string,
  publications: TicketPublicationResult[],
): Promise<void> {
  for (const publication of publications) {
    const ticketPath = resolve(
      repoRoot,
      ".darrow",
      "tickets",
      publication.ticketKey,
      "ticket.json",
    );
    const record = await readJson<TicketPublicationRecord>(ticketPath);
    await validateSchema(
      "ticket-publication.schema.json",
      record,
      `ticket publication ${publication.ticketKey}`,
    );
    if (
      record.ticketKey !== publication.ticketKey ||
      !sameTicket(record.ticket, publication.ticket)
    )
      throw new DarrowError(
        `ticket publication identity mismatch: ${publication.ticketKey}`,
        "immutable_violation",
      );
    for (const expected of publication.artifacts) {
      const actual = record.publications.find(
        (item) => item.publicationId === expected.publicationId,
      );
      if (!actual || !samePublication(actual, expected))
        throw new DarrowError(
          `missing ticket publication record: ${expected.publicationId}`,
          "immutable_violation",
        );
      const destination = resolve(repoRoot, actual.location);
      if (!inside(resolve(repoRoot, ".darrow", "tickets"), destination))
        throw new DarrowError(
          `ticket publication location escapes its workspace: ${actual.location}`,
          "immutable_violation",
        );
      await rejectSymlinks(destination);
      if ((await hashDirectory(destination)) !== actual.contentHash)
        throw new DarrowError(
          `published artifact digest mismatch: ${actual.publicationId}`,
          "immutable_violation",
        );
    }
  }
}

export async function readTicketPublicationEvents(
  runDir: string,
): Promise<TicketPublicationResult[]> {
  const path = resolve(runDir, "events.jsonl");
  if (!(await exists(path))) return [];
  const results: TicketPublicationResult[] = [];
  for (const line of (await Bun.file(path).text())
    .split("\n")
    .filter(Boolean)) {
    const item = JSON.parse(line) as {
      type?: string;
      data?: TicketPublicationResult;
    };
    if (item.type === "ticket.artifacts.published" && item.data)
      results.push(item.data);
  }
  return results;
}
