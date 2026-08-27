import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("checkpoints completed trials and atomically finalizes the active-run record", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-run-artifact-"));
  const output = join(root, "result.json");
  const resultsRoot = join(import.meta.dir, "..", "results", "active");
  try {
    const proc = Bun.spawn(
      [
        process.execPath,
        "runner/run.ts",
        "--case",
        "ticket-to-pr-canonical-token-delegation",
        "--harness",
        "codex",
        "--dry",
        "--trials",
        "1",
        "--output",
        output,
      ],
      { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
    );
    expect(await proc.exited).toBe(0);
    expect(JSON.parse(await readFile(output, "utf8"))).toHaveLength(1);

    const records = await Promise.all(
      (await readdir(resultsRoot)).map(async (name) =>
        JSON.parse(await readFile(join(resultsRoot, name), "utf8")),
      ),
    );
    const record = records.find((value) => value.artifactPath === output);
    expect(record).toMatchObject({
      format: "darrow-eval-active-run-v1",
      status: "complete",
      artifactPath: output,
      completedTrials: [
        {
          caseId: "ticket-to-pr-canonical-token-delegation",
          trial: 1,
        },
      ],
    });
    expect(record.finalizedAt).toEqual(expect.any(String));
  } finally {
    const records = await Promise.all(
      (await readdir(resultsRoot)).map(async (name) => ({
        name,
        value: JSON.parse(await readFile(join(resultsRoot, name), "utf8")),
      })),
    );
    await Promise.all(
      records
        .filter(({ value }) => value.artifactPath === output)
        .map(({ name }) => rm(join(resultsRoot, name))),
    );
    await rm(root, { recursive: true, force: true });
  }
});
