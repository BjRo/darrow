import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { hashDirectory, readJson, writeJson } from "../src/io";
import {
  executeTicketPublication,
  publishTicketArtifacts,
  ticketPublicationKey,
  verifyPublishedArtifacts,
} from "../src/publication";
import { initRepository } from "../src/repository";
import type {
  ArtifactReference,
  PublicationActivityInput,
  TicketPublicationRecord,
} from "../src/types";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map(async (path) => {
      await Bun.spawn(["chmod", "-R", "u+w", path]).exited;
      await rm(path, { recursive: true, force: true });
    }),
  );
});

function git(cwd: string, args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

async function fixture(): Promise<PublicationActivityInput> {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-publication-"));
  temps.push(root);
  git(root, ["init", "-q"]);
  await initRepository(root);
  const runId = "run-1";
  const stepId = "summarize";
  const attemptId = "attempt-summarize-1";
  const runDir = resolve(root, ".darrow", "runs", runId);
  const artifactDir = resolve(
    runDir,
    "artifacts",
    stepId,
    attemptId,
    "learning-summary",
  );
  await mkdir(artifactDir, { recursive: true });
  await writeFile(
    resolve(artifactDir, "summary.md"),
    "# Lessons\n\nKeep it small.\n",
  );
  const artifact: ArtifactReference = {
    schemaVersion: "0.1.0",
    artifactId: "artifact-summary-1",
    type: "darrow.learning-summary",
    schema: "https://darrow.dev/contracts/learning-summary/0.1.0",
    schemaDigest: `sha256:${"a".repeat(64)}`,
    contentHash: await hashDirectory(artifactDir),
    size: Bun.file(resolve(artifactDir, "summary.md")).size,
    stepId,
    attemptId,
    location: relative(root, artifactDir).replaceAll("\\", "/"),
    createdAt: "2026-07-17T10:00:00.000Z",
  };
  await writeJson(resolve(artifactDir, "..", "artifact.json"), artifact);
  await chmod(resolve(artifactDir, "summary.md"), 0o444);
  await chmod(artifactDir, 0o555);
  return {
    repoRoot: root,
    runDir,
    runId,
    stepId,
    attemptId,
    publication: {
      ticket: {
        backend: "github",
        project: "BjRo/darrow",
        nativeId: "4",
        url: "https://github.com/BjRo/darrow/issues/4",
      },
      artifactTypes: ["darrow.learning-summary"],
    },
    artifacts: [artifact],
  };
}

describe("M2 ticket artifact publication", () => {
  test("publishes selected artifacts to a stable ticket workspace idempotently", async () => {
    const input = await fixture();
    const first = await publishTicketArtifacts(input);
    const second = await publishTicketArtifacts(input);
    expect(second).toEqual(first);
    expect(first.ticketKey).toBe(
      ticketPublicationKey(input.publication.ticket),
    );
    expect(
      ticketPublicationKey({
        ...input.publication.ticket,
        url: "https://tracker.example/tickets/4",
      }),
    ).toBe(first.ticketKey);
    expect(first.artifacts).toHaveLength(1);
    const published = first.artifacts[0]!;
    expect(published.location).toBe(
      `.darrow/tickets/${first.ticketKey}/artifacts/summarize/attempt-summarize-1/${published.publicationId}-learning-summary`,
    );
    expect(
      await Bun.file(
        resolve(input.repoRoot, published.location, "summary.md"),
      ).text(),
    ).toBe("# Lessons\n\nKeep it small.\n");
    const record = await readJson<TicketPublicationRecord>(
      resolve(
        input.repoRoot,
        ".darrow",
        "tickets",
        first.ticketKey,
        "ticket.json",
      ),
    );
    expect(record.ticket).toEqual(input.publication.ticket);
    expect(record.publications).toEqual(first.artifacts);
    await expect(
      verifyPublishedArtifacts(input.repoRoot, [first]),
    ).resolves.toBeUndefined();
    await expect(
      publishTicketArtifacts({
        ...input,
        publication: {
          ...input.publication,
          ticket: {
            ...input.publication.ticket,
            url: "https://tracker.example/tickets/4",
          },
        },
      }),
    ).rejects.toThrow("ticket publication identity conflicts");
  });

  test("refuses a missing declared type before creating a ticket workspace", async () => {
    const input = await fixture();
    input.publication.artifactTypes.push("darrow.missing");
    await expect(publishTicketArtifacts(input)).rejects.toThrow(
      "produced no artifact of declared type darrow.missing",
    );
    expect(await executeTicketPublication(input)).toMatchObject({
      status: "failed",
      error: { category: "publication" },
    });
    expect(
      await Bun.file(
        resolve(
          input.repoRoot,
          ".darrow",
          "tickets",
          ticketPublicationKey(input.publication.ticket),
          "ticket.json",
        ),
      ).exists(),
    ).toBe(false);
  });

  test("detects mutation of published content", async () => {
    const input = await fixture();
    const result = await publishTicketArtifacts(input);
    await chmod(
      resolve(input.repoRoot, result.artifacts[0]!.location, "summary.md"),
      0o644,
    );
    await writeFile(
      resolve(input.repoRoot, result.artifacts[0]!.location, "summary.md"),
      "changed\n",
    );
    await expect(
      verifyPublishedArtifacts(input.repoRoot, [result]),
    ).rejects.toThrow("published artifact digest mismatch");
  });
});
