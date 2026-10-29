import { afterEach, expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  realpath,
  symlink,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnTestCommand } from "../test-command";

const roots: string[] = [];
const command = resolve(import.meta.dir, "../sevro-extension/prune.ts");
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
async function fixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-retention-")),
  );
  roots.push(root);
  return root;
}
async function prune(root: string, ...args: string[]) {
  const child = Bun.spawn([process.execPath, command, ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}
async function attempt(
  root: string,
  id: string,
  publishedAt = "2020-01-01T00:00:00.000Z",
) {
  const path = join(root, "attempts", id);
  await mkdir(path, { recursive: true });
  const manifest = {
    format: "darrow-sevro-selection-v1",
    projectRoot: root,
    resultsRoot: root,
    attemptId: id,
    manifestPath: join(path, "selection-run.json"),
    caseIds: [],
    runs: [],
    interrupted: false,
  };
  await writeFile(manifest.manifestPath, JSON.stringify(manifest));
  await writeFile(
    join(path, "retention.json"),
    JSON.stringify({
      format: "darrow-retention-v1",
      status: "completed",
      publishedAt,
      outputPath: null,
    }),
  );
  await writeFile(join(root, "selection-run.json"), JSON.stringify(manifest));
  return path;
}
test("legacy attempts are previewed and deleted by default as whole attempts", async () => {
  const root = await fixture();
  const path = await attempt(root, "legacy");
  await rm(join(path, "retention.json"));
  await writeFile(join(path, "captured-output.txt"), "retained evidence");
  const preview = await prune(root, "--results-root", root);
  expect(preview.code, preview.stderr).toBe(0);
  expect(JSON.parse(preview.stdout).remove).toEqual([
    path,
    join(root, "selection-run.json"),
  ]);
  expect(await Bun.file(join(path, "captured-output.txt")).exists()).toBe(true);

  const applied = await prune(root, "--results-root", root, "--apply");
  expect(applied.code, applied.stderr).toBe(0);
  expect(await Bun.file(join(path, "captured-output.txt")).exists()).toBe(
    false,
  );
  expect(await Bun.file(join(root, "selection-run.json")).exists()).toBe(false);
});
test("legacy age uses the newest nested file or directory modification", async () => {
  const root = await fixture();
  const oldDate = new Date("2020-01-01T00:00:00.000Z");
  const paths: Record<string, string> = {};
  for (const id of ["old", "file-fresh", "directory-fresh"]) {
    const path = await attempt(root, id);
    paths[id] = path;
    await rm(join(path, "retention.json"));
    const nested = join(path, "cases", "nested");
    await mkdir(nested, { recursive: true });
    const capture = join(nested, "cli-result.json");
    await writeFile(capture, "historical evidence");
    for (const entry of [
      join(path, "selection-run.json"),
      capture,
      nested,
      join(path, "cases"),
      path,
    ])
      await utimes(entry, oldDate, oldDate);
    const recent = new Date();
    if (id === "file-fresh") await utimes(capture, recent, recent);
    if (id === "directory-fresh") await utimes(nested, recent, recent);
  }
  const preview = await prune(
    root,
    "--results-root",
    root,
    "--older-than",
    "1d",
  );
  expect(preview.code, preview.stderr).toBe(0);
  expect(JSON.parse(preview.stdout).remove).toEqual([paths.old]);
  const applied = await prune(
    root,
    "--results-root",
    root,
    "--older-than",
    "1d",
    "--apply",
  );
  expect(applied.code, applied.stderr).toBe(0);
  expect(await Bun.file(join(paths.old!, "selection-run.json")).exists()).toBe(
    false,
  );
  for (const id of ["file-fresh", "directory-fresh"])
    expect(
      await Bun.file(join(paths[id]!, "selection-run.json")).exists(),
    ).toBe(true);
  expect(
    JSON.parse(await readFile(join(root, "selection-run.json"), "utf8"))
      .attemptId,
  ).toBe("directory-fresh");
});
test("an inconsistent alias for a retained owner refuses cleanup before deleting referenced evidence", async () => {
  const root = await fixture();
  const eligible = await attempt(root, "eligible");
  const retained = await attempt(root, "retained", new Date().toISOString());
  const aliasPath = join(root, "selection-run.json");
  const ownerContents = await readFile(
    join(retained, "selection-run.json"),
    "utf8",
  );
  const alias = JSON.parse(ownerContents);
  alias.runs = [{ resultPath: join(eligible, "selection-run.json") }];
  const aliasContents = JSON.stringify(alias);
  await writeFile(aliasPath, aliasContents);

  const run = await prune(
    root,
    "--results-root",
    root,
    "--older-than",
    "20m",
    "--apply",
  );
  expect(run.code).toBe(1);
  expect(run.stderr).toContain("root alias differs from attempt manifest");
  expect(await Bun.file(join(eligible, "selection-run.json")).exists()).toBe(
    true,
  );
  expect(await readFile(join(retained, "selection-run.json"), "utf8")).toBe(
    ownerContents,
  );
  expect(await readFile(aliasPath, "utf8")).toBe(aliasContents);
});

test("preview reports whole attempts in default and explicit roots without deleting", async () => {
  const cwd = await fixture();
  for (const root of [join(cwd, "evals/results"), join(cwd, "campaign")]) {
    const path = await attempt(root, "old");
    const run = await prune(
      cwd,
      ...(root.endsWith("campaign") ? ["--results-root", root] : []),
    );
    expect(run.code, run.stderr).toBe(0);
    const plan = JSON.parse(run.stdout);
    expect(plan.resultsRoot).toBe(root);
    expect(plan.remove).toEqual([path, join(root, "selection-run.json")]);
    expect(await readFile(join(path, "retention.json"), "utf8")).toContain(
      "completed",
    );
  }
});

test("age filters use publication time, preserve the current alias, and reject invalid ages", async () => {
  const root = await fixture();
  const old = await attempt(root, "old");
  const fresh = await attempt(
    root,
    "fresh",
    new Date(Date.now() + 60000).toISOString(),
  );
  for (const age of ["20m", "1d", "2d", "1y", "0.5h"]) {
    const run = await prune(root, "--results-root", root, "--older-than", age);
    expect(run.code, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout).remove).toEqual([old]);
  }
  for (const age of [
    "0d",
    "-1m",
    "NaNd",
    "Infinityd",
    "1e999y",
    "1",
    "1mo",
    "1d junk",
    "9".repeat(400) + "y",
  ]) {
    const run = await prune(
      root,
      "--results-root",
      root,
      `--older-than=${age}`,
      "--apply",
    );
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("duration");
    expect(await Bun.file(join(old, "selection-run.json")).exists()).toBe(true);
  }
  const applied = await prune(
    root,
    "--results-root",
    root,
    "--older-than",
    "20m",
    "--apply",
  );
  expect(applied.code, applied.stderr).toBe(0);
  expect(await Bun.file(join(fresh, "selection-run.json")).exists()).toBe(true);
  expect(
    JSON.parse(await readFile(join(root, "selection-run.json"), "utf8"))
      .attemptId,
  ).toBe("fresh");
});

test("apply deletes all eligible attempts and only their matching root alias", async () => {
  const root = await fixture();
  const first = await attempt(root, "first");
  const second = await attempt(root, "second");
  const run = await prune(root, "--results-root", root, "--apply");
  expect(run.code, run.stderr).toBe(0);
  expect(JSON.parse(run.stdout).remove).toEqual([
    first,
    second,
    join(root, "selection-run.json"),
  ]);
  expect(await Bun.file(join(first, "retention.json")).exists()).toBe(false);
  expect(await Bun.file(join(second, "selection-run.json")).exists()).toBe(
    false,
  );
  expect(await Bun.file(join(root, "selection-run.json")).exists()).toBe(false);
});

async function unsafeAttempt(root: string, id: string) {
  const path = await attempt(root, id);
  const metadata = join(path, "retention.json");
  if (["linked", "external", "wrong-owner"].includes(id)) await rm(metadata);
  if (id === "active")
    await writeFile(
      metadata,
      JSON.stringify({
        format: "darrow-retention-v1",
        status: "active",
        publishedAt: null,
        outputPath: null,
      }),
    );
  if (id === "exported")
    await writeFile(
      metadata,
      JSON.stringify({
        format: "darrow-retention-v1",
        status: "completed",
        publishedAt: "2020-01-01T00:00:00.000Z",
        outputPath: join(root, "export.json"),
      }),
    );
  if (id === "malformed") await writeFile(metadata, "broken");
  if (id === "bad-date")
    await writeFile(
      metadata,
      JSON.stringify({
        format: "darrow-retention-v1",
        status: "completed",
        publishedAt: "yesterday",
        outputPath: null,
      }),
    );
  if (id === "linked") await symlink(root, join(path, "linked"));
  if (["external", "wrong-owner"].includes(id)) {
    const manifestPath = join(path, "selection-run.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (id === "external")
      manifest.runs = [{ resultPath: "/external/cli-result.json" }];
    else manifest.attemptId = "some-other-attempt";
    await writeFile(manifestPath, JSON.stringify(manifest));
  }
  return path;
}
test("ambiguous, active, exported and unsafe attempts including legacy are preserved with reasons", async () => {
  const root = await fixture();
  const paths: string[] = [];
  for (const id of [
    "active",
    "exported",
    "malformed",
    "linked",
    "external",
    "wrong-owner",
    "bad-date",
  ])
    paths.push(await unsafeAttempt(root, id));
  const run = await prune(root, "--results-root", root, "--apply");
  expect(run.code, run.stderr).toBe(0);
  const plan = JSON.parse(run.stdout);
  expect(plan.remove).toEqual([]);
  expect(plan.preserve).toHaveLength(paths.length);
  for (const path of paths) {
    expect(
      plan.preserve.find(
        (entry: { path: string; reason: string }) => entry.path === path,
      )?.reason.length,
    ).toBeGreaterThan(0);
    expect(await Bun.file(join(path, "selection-run.json")).exists()).toBe(
      true,
    );
  }
});

test("original selection publication protects active attempts and starts age at final publication", async () => {
  const root = await fixture();
  const project = join(root, "project");
  const results = join(root, "results");
  const source = join(project, "evals/experiments/example/cases/selected.yaml");
  await mkdir(join(source, ".."), { recursive: true });
  await writeFile(
    source,
    JSON.stringify({
      id: "selected",
      invariant: "ER-C4",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: initial", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "answer", expect_exact: "ready" }],
    }),
  );
  const release = join(root, "release");
  const binary = join(root, "synthetic-sevro");
  const frame = {
    format: "sevro.cli-result.v1",
    runId: null,
    execution: { status: "failed" },
    grading: { status: "not_requested" },
    task: { verdict: "not_assessed" },
    exitCode: 70,
    evidencePath: null,
    cases: [],
  };
  await writeFile(
    binary,
    `#!${process.execPath}\nwhile (!await Bun.file(${JSON.stringify(release)}).exists()) await Bun.sleep(10);\nconsole.log(${JSON.stringify(JSON.stringify(frame))}); process.exitCode = 70;\n`,
    { mode: 0o700 },
  );
  const env: Record<string, string | undefined> = {
    ...process.env,
    SEVRO_PACKAGE_BIN: binary,
  };
  delete env.SEVRO_CHECKOUT;
  const run = await spawnTestCommand(
    [
      process.execPath,
      resolve(import.meta.dir, "../sevro-extension/run.ts"),
      "--project-root",
      project,
      "--results-root",
      results,
      "--case",
      "selected",
      "--without-skill",
      "--",
      "--host",
      "codex",
      "--model",
      "synthetic",
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
      "--dry",
    ],
    undefined,
    { env },
  );
  try {
    for (
      let i = 0;
      i < 200 &&
      !(await Bun.file(join(results, "selection-run.json")).exists());
      i++
    )
      await Bun.sleep(10);
    const manifest = JSON.parse(
      await readFile(join(results, "selection-run.json"), "utf8"),
    );
    const path = join(results, "attempts", manifest.attemptId);
    expect(await Bun.file(join(path, "retention.json")).exists()).toBe(true);
    const active = await prune(root, "--results-root", results, "--apply");
    expect(active.code, active.stderr).toBe(0);
    expect(JSON.parse(active.stdout).remove).toEqual([]);
    const before = Date.now();
    await writeFile(release, "go");
    const finished = await run.result;
    expect(finished.exitCode, finished.stderr).toBe(1);
    const metadata = JSON.parse(
      await readFile(join(path, "retention.json"), "utf8"),
    );
    expect(metadata.status).toBe("failed");
    expect(Date.parse(metadata.publishedAt)).toBeGreaterThanOrEqual(before);
    expect(
      (
        await prune(
          root,
          "--results-root",
          results,
          "--older-than",
          "20m",
          "--apply",
        )
      ).code,
    ).toBe(0);
    expect(await Bun.file(manifest.manifestPath).exists()).toBe(true);
    const applied = await prune(root, "--results-root", results, "--apply");
    expect(applied.code, applied.stderr).toBe(0);
    expect(JSON.parse(applied.stdout).remove).toContain(path);
    expect(await Bun.file(manifest.manifestPath).exists()).toBe(false);
  } finally {
    await writeFile(release, "go");
    run.child.kill();
    await run.result;
  }
});

test("retained references pin other attempts and campaign evidence is preserved", async () => {
  const root = await fixture();
  const target = await attempt(root, "target");
  const retained = await attempt(root, "retained");
  const manifestPath = join(retained, "selection-run.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.runs = [{ resultPath: join(target, "cli-result.json") }];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(join(root, "selection-run.json"), JSON.stringify(manifest));
  const run = await prune(root, "--results-root", root, "--apply");
  expect(run.code, run.stderr).toBe(0);
  expect(JSON.parse(run.stdout).remove).toEqual([]);
  expect(await Bun.file(join(target, "selection-run.json")).exists()).toBe(
    true,
  );
  const campaign = await fixture();
  const selection = await attempt(campaign, "selection");
  await writeFile(
    join(campaign, "suite-run.json"),
    JSON.stringify({
      cells: [{ manifestPath: join(selection, "selection-run.json") }],
    }),
  );
  const suite = await prune(campaign, "--results-root", campaign, "--apply");
  expect(suite.code, suite.stderr).toBe(0);
  expect(JSON.parse(suite.stdout).remove).toEqual([]);
  expect(await Bun.file(join(selection, "selection-run.json")).exists()).toBe(
    true,
  );
});

test("unsafe root aliases, root symlinks and attempt-root symlinks refuse deletion", async () => {
  const root = await fixture();
  const selected = await attempt(root, "selected");
  await writeFile(join(root, "selection-run.json"), "broken");
  const badAlias = await prune(root, "--results-root", root, "--apply");
  expect(badAlias.code).toBe(1);
  expect(await Bun.file(join(selected, "selection-run.json")).exists()).toBe(
    true,
  );
  const parent = await fixture();
  await symlink(root, join(parent, "linked-root"));
  expect(
    (
      await prune(
        parent,
        "--results-root",
        join(parent, "linked-root"),
        "--apply",
      )
    ).code,
  ).toBe(1);
  await symlink(join(root, "attempts"), join(parent, "attempts"));
  expect((await prune(parent, "--results-root", parent, "--apply")).code).toBe(
    1,
  );
  expect(await Bun.file(join(selected, "selection-run.json")).exists()).toBe(
    true,
  );
});

test("a results root reached through a symlink ancestor refuses deletion", async () => {
  const root = await fixture();
  const real = join(root, "campaign");
  const selected = await attempt(real, "selected");
  const linked = await fixture();
  await symlink(root, join(linked, "parent"));
  const run = await prune(
    linked,
    "--results-root",
    join(linked, "parent/campaign"),
    "--apply",
  );
  expect(run.code).toBe(1);
  expect(await Bun.file(join(selected, "selection-run.json")).exists()).toBe(
    true,
  );
});
