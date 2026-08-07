import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCorpusSource } from "./corpus";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function git(cwd: string, ...args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(stderr);
  return stdout.trim();
}

async function fixture(): Promise<{
  manifest: string;
  repo: string;
  commit: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "darrow-corpus-test-"));
  cleanup.push(root);
  const repo = join(root, "cache", "sample");
  await mkdir(repo, { recursive: true });
  await git(repo, "init", "-b", "main");
  await git(repo, "config", "user.name", "Corpus Test");
  await git(repo, "config", "user.email", "corpus@example.invalid");
  await writeFile(join(repo, "LICENSE"), "MIT\n");
  await git(repo, "add", "LICENSE");
  await git(repo, "commit", "-m", "initial human snapshot");
  const commit = await git(repo, "rev-parse", "HEAD");
  const manifest = join(root, "manifest.yaml");
  await writeFile(
    manifest,
    [
      "version: 1",
      "sources:",
      "  sample:",
      "    repository: https://example.invalid/sample.git",
      `    commit: ${commit}`,
      "    commit_date: 2021-01-02T03:04:05Z",
      "    license: MIT",
      "    license_file: LICENSE",
      "    provenance: pre-generative-ai snapshot",
      "",
    ].join("\n"),
  );
  return { manifest, repo, commit };
}

describe("OSS corpus source resolution", () => {
  test("returns only a prepared cache at the pinned revision", async () => {
    const { manifest, repo, commit } = await fixture();
    expect(await resolveCorpusSource("sample", manifest)).toEqual({
      id: "sample",
      path: repo,
      commit,
      repository: "https://example.invalid/sample.git",
      license: "MIT",
      commitDate: "2021-01-02T03:04:05Z",
      provenance: "pre-generative-ai snapshot",
    });
  });

  test("rejects an unprepared source and revision drift", async () => {
    const { manifest, repo } = await fixture();
    await writeFile(join(repo, "drift.txt"), "drift\n");
    await git(repo, "add", "drift.txt");
    await git(repo, "commit", "-m", "drift");
    await expect(resolveCorpusSource("sample", manifest)).rejects.toThrow(
      "prepared corpus revision",
    );
    await expect(resolveCorpusSource("missing", manifest)).rejects.toThrow(
      "unknown corpus source",
    );
  });
});
