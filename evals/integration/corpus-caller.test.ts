import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const direct = resolve(import.meta.dir, "../runner/run.ts");
const migration = resolve(import.meta.dir, "../sevro-extension/run.ts");
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function temporary(name: string) {
  const root = await realpath(await mkdtemp(join(tmpdir(), name)));
  roots.push(root);
  return root;
}

async function git(root: string, ...args: string[]) {
  const child = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code, stderr).toBe(0);
  return stdout.trim();
}

async function fixture() {
  const project = await temporary("darrow-corpus-project-");
  await git(project, "init", "--quiet");
  const configuration = await temporary("darrow-corpus-configuration-");
  const cache = await temporary("darrow-corpus-cache-");
  const source = join(cache, "sample");
  await mkdir(source);
  await git(source, "init", "--quiet");
  await writeFile(join(source, "LICENSE"), "MIT\n");
  await writeFile(join(source, "README.md"), "source\n");
  await git(source, "add", "LICENSE", "README.md");
  await git(
    source,
    "-c",
    "user.name=Corpus Test",
    "-c",
    "user.email=corpus@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "Source snapshot",
  );
  const revision = await git(source, "rev-parse", "HEAD");
  const manifest = join(configuration, "manifest.yaml");
  const definition = {
    version: 1,
    cache_dir: cache,
    sources: {
      sample: {
        repository: "https://example.invalid/sample.git",
        commit: revision,
        commit_date: "2021-01-02T03:04:05Z",
        license: "MIT",
        license_file: "LICENSE",
        provenance: "pinned synthetic source",
      },
    },
  };
  await writeFile(manifest, JSON.stringify(definition));
  const cases = join(project, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "corpus.yaml"),
    JSON.stringify({
      id: "custom-corpus",
      invariant: "EXAMPLE-CORPUS",
      prompt: "Return ready.",
      fixture: {
        source: "sample",
        files: { "README.md": "overlay\n" },
        commit_files: true,
        setup: 'printf "setup\\n" > SETUP.txt',
      },
      checks: [{ name: "overlay", run: 'test "$(cat README.md)" = overlay' }],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  const tools = await temporary("darrow-corpus-tools-");
  const binary = join(tools, "host");
  await writeFile(binary, '#!/bin/sh\nprintf "synthetic-corpus-host\\n"\n', {
    mode: 0o700,
  });
  const auth = join(project, "auth.json");
  await writeFile(auth, '{"synthetic":"credential"}', { mode: 0o600 });
  return {
    project,
    configuration,
    cache,
    source,
    revision,
    manifest,
    definition,
    binary,
    auth,
    cases,
  };
}

async function invoke(command: string, cwd: string, args: string[]) {
  const child = Bun.spawn([process.execPath, command, ...args], {
    cwd,
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

function directArgs(f: Awaited<ReturnType<typeof fixture>>) {
  return [
    "--project-root",
    ".",
    "--harness",
    "codex",
    "--owner-evaluation",
    "passive",
    "--case",
    "custom-corpus",
    "--corpus-manifest",
    relative(f.project, f.manifest),
    "--trials",
    "1",
    "--threshold",
    "1",
    "--dry",
    "--",
    "--codex-bin",
    f.binary,
    "--codex-auth-file",
    f.auth,
  ];
}

test("direct caller binds a separately located custom corpus manifest", async () => {
  const f = await fixture();
  const run = await invoke(direct, f.project, directArgs(f));
  expect(run.code, run.stderr + run.stdout).toBe(0);
  const selection = JSON.parse(run.stdout);
  expect(selection.caseIds).toEqual(["custom-corpus"]);
  const result = selection.runs[0].result;
  expect(result.execution.status).toBe("not_run");
  expect(result.task.verdict).toBe("not_assessed");
  const caseRoot = dirname(selection.runs[0].resultPath);
  const provenanceFile = (await readdir(caseRoot)).find((path) =>
    /^darrow-corpus-source-[a-f0-9]{64}\.json$/.test(path),
  );
  expect(provenanceFile).toBeDefined();
  const corpus = JSON.parse(
    await readFile(join(caseRoot, provenanceFile!), "utf8"),
  );
  expect(corpus).toMatchObject({
    format: "darrow-corpus-source-v1",
    manifest: {
      path: f.manifest,
      sha256: createHash("sha256")
        .update(await readFile(f.manifest))
        .digest("hex"),
    },
    source: {
      id: "sample",
      path: f.source,
      commit: f.revision,
      license: "MIT",
      provenance: "pinned synthetic source",
    },
  });
  expect(await readFile(join(f.source, "README.md"), "utf8")).toBe("source\n");
  expect(await git(f.source, "status", "--porcelain=v1")).toBe("");
}, 30_000);

test("corpus identity is stable across attempts and binds changed metadata", async () => {
  const f = await fixture();
  const digests: string[] = [];
  for (let trial = 0; trial < 3; trial++) {
    if (trial === 2) {
      f.definition.sources.sample.provenance = "a different provenance claim";
      await writeFile(f.manifest, JSON.stringify(f.definition));
    }
    const run = await invoke(direct, f.project, directArgs(f));
    expect(run.code, run.stderr + run.stdout).toBe(0);
    const selection = JSON.parse(run.stdout);
    const result = selection.runs[0].result;
    const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
    digests.push(evidence.extension.sourceDigest);
  }
  expect(digests[0]).toMatch(/^[a-f0-9]{64}$/);
  expect(digests[1]).toBe(digests[0]);
  expect(digests[2]).not.toBe(digests[0]);
}, 30_000);

test("reusing a results root preserves prior corpus provenance", async () => {
  const f = await fixture();
  const results = join(f.project, "results");
  const args = [
    "--case-id",
    "custom-corpus",
    "--project-root",
    f.project,
    "--results-root",
    results,
    "--corpus-manifest",
    f.manifest,
    "--",
    "--shell-isolation",
    "--dry",
    "--host",
    "codex",
    "--codex-bin",
    f.binary,
    "--codex-auth-file",
    f.auth,
    "--model",
    "synthetic-corpus",
    "--effort",
    "low",
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
  ];
  const first = await invoke(migration, f.project, args);
  expect(first.code, first.stderr + first.stdout).toBe(0);
  const files = (await readdir(results)).filter((path) =>
    /^darrow-corpus-source-[a-f0-9]{64}\.json$/.test(path),
  );
  expect(files).toHaveLength(1);
  const originalPath = join(results, files[0]!);
  const original = await readFile(originalPath, "utf8");
  f.definition.sources.sample.provenance = "changed corpus provenance";
  await writeFile(f.manifest, JSON.stringify(f.definition));
  const second = await invoke(migration, f.project, args);
  expect(second.code, second.stderr + second.stdout).toBe(0);
  const repeated = await invoke(migration, f.project, args);
  expect(repeated.code, repeated.stderr + repeated.stdout).toBe(0);
  expect(await readFile(originalPath, "utf8")).toBe(original);
  const retained = await Promise.all(
    (await readdir(results))
      .filter((path) => /^darrow-corpus-source-[a-f0-9]{64}\.json$/.test(path))
      .map(async (path) =>
        JSON.parse(await readFile(join(results, path), "utf8")),
      ),
  );
  expect(retained).toHaveLength(2);
  expect(retained.map((item) => item.source.provenance).sort()).toEqual([
    "changed corpus provenance",
    "pinned synthetic source",
  ]);
}, 30_000);

function shellQuote(value: string) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

test.skipIf(process.platform !== "darwin")(
  "custom corpus preparation preserves overlays and protects source worktrees",
  async () => {
    const f = await fixture();
    const primary = join(
      await temporary("darrow-corpus-primary-"),
      "repository",
    );
    await rename(f.source, primary);
    await git(primary, "worktree", "add", "--quiet", "--detach", f.source);
    const privatePaths = [
      f.manifest,
      join(f.configuration, "private.txt"),
      join(f.source, "README.md"),
      join(primary, "private.txt"),
      join(f.cache, "peer.txt"),
    ];
    await writeFile(privatePaths[1]!, "private configuration\n");
    await writeFile(privatePaths[3]!, "private primary worktree\n");
    await writeFile(privatePaths[4]!, "private peer source\n");
    const casePath = join(f.cases, "corpus.yaml");
    const definition = JSON.parse(await readFile(casePath, "utf8"));
    definition.checks.push(
      { name: "setup", run: 'test "$(cat SETUP.txt)" = setup' },
      {
        name: "scaffolding",
        run: 'test "$(git log -1 --format=%s)" = "Add evaluation scaffolding"',
      },
      ...privatePaths.map((path, index) => ({
        name: "private corpus input " + index,
        run: `if cat ${shellQuote(path)} >/dev/null 2>&1; then exit 1; fi`,
      })),
    );
    await writeFile(casePath, JSON.stringify(definition));
    const adapter = join(dirname(f.binary), "adapter.ts");
    await writeFile(
      adapter,
      'export default { id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none", async run() { return { finalMessage: "ready", complete: true }; } };\n',
    );
    const run = await invoke(migration, f.project, [
      "--case-id",
      "custom-corpus",
      "--project-root",
      f.project,
      "--results-root",
      join(f.project, "results"),
      "--corpus-manifest",
      f.manifest,
      "--",
      "--adapter-module",
      adapter,
      "--shell-isolation",
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
    ]);
    expect(run.code, run.stderr + run.stdout).toBe(0);
    const result = JSON.parse(run.stdout);
    expect(result.task.verdict).toBe("passed");
    expect(
      result.cases[0].trials[0].checks.map(
        (check: { status: string }) => check.status,
      ),
    ).toEqual(Array(9).fill("passed"));
    expect(await readFile(join(f.source, "README.md"), "utf8")).toBe(
      "source\n",
    );
    expect(await git(f.source, "status", "--porcelain=v1")).toBe("");
    expect(await git(f.source, "rev-parse", "HEAD")).toBe(f.revision);
    expect(await readFile(privatePaths[3]!, "utf8")).toBe(
      "private primary worktree\n",
    );
  },
  30_000,
);

test.each(["missing", "directory", "malformed", "unknown-version"])(
  "direct caller refuses invalid explicit corpus manifests before execution: %s",
  async (scenario) => {
    const f = await fixture();
    if (scenario === "missing") await rm(f.manifest);
    if (scenario === "directory") {
      await rm(f.manifest);
      await mkdir(f.manifest);
    }
    if (scenario === "malformed") await writeFile(f.manifest, "[");
    if (scenario === "unknown-version")
      await writeFile(f.manifest, '{"version":2,"sources":{}}');
    const run = await invoke(direct, f.project, directArgs(f));
    expect(run.code, run.stderr + run.stdout).toBe(64);
    expect(run.stderr.length).toBeGreaterThan(0);
    expect(run.stdout).toBe("");
    expect(
      await Bun.file(
        join(f.project, "evals/results/selection-run.json"),
      ).exists(),
    ).toBe(false);
  },
);

test.each(["wrong-revision", "dirty-source", "missing-license"])(
  "custom corpus retains pinned-source refusal: %s",
  async (scenario) => {
    const f = await fixture();
    if (scenario === "wrong-revision") {
      f.definition.sources.sample.commit = "0".repeat(40);
      await writeFile(f.manifest, JSON.stringify(f.definition));
    }
    if (scenario === "dirty-source")
      await writeFile(join(f.source, "DRIFT.txt"), "uncommitted\n");
    if (scenario === "missing-license") {
      f.definition.sources.sample.license_file = "MISSING";
      await writeFile(f.manifest, JSON.stringify(f.definition));
    }
    const run = await invoke(direct, f.project, directArgs(f));
    expect(run.code, run.stderr + run.stdout).toBe(1);
    const selection = JSON.parse(run.stdout);
    expect(selection.runs[0].exitCode).toBe(64);
    expect(selection.runs[0].result).toBeNull();
    expect(selection.runs[0].resultError).not.toBeNull();
    expect(selection.runs[0].stderr).toContain("corpus");
  },
  30_000,
);
