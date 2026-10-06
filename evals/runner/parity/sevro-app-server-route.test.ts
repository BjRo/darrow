import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("direct caller preserves an explicit Codex app-server route", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-main-sync-route-"));
  roots.push(root);
  const directory = join(root, "evals/experiments/probe/cases");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "case.yaml"),
    JSON.stringify({
      id: "route-probe",
      invariant: "SE-C33",
      prompt: "Return ready",
      fixture: {
        commits: [{ message: "Initial", files: { "README.md": "fixture" } }],
      },
      checks: [],
      native_goal: "required",
    }),
  );
  const child = Bun.spawn([
    process.execPath,
    join(import.meta.dir, "../run.ts"),
    "--project-root",
    root,
    "--results-root",
    join(root, "results"),
    "--case",
    "route-probe",
    "--harness",
    "codex",
    "--codex-entrypoint",
    "app-server",
    "--owner-evaluation",
    "passive",
    "--dry",
    "--trials",
    "1",
    "--threshold",
    "1",
    "--jobs",
    "1",
    "--",
    "--codex-bin",
    process.execPath,
    "--codex-auth-file",
    join(root, "unused-auth.json"),
  ]);
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code, out + err).toBe(0);
  const manifest = JSON.parse(out);
  expect(manifest.caseIds).toEqual(["route-probe"]);
  const evidence = JSON.parse(
    await readFile(manifest.runs[0].result.evidencePath, "utf8"),
  );
  expect(
    evidence.configuration.redacted.hostConfiguration.candidate[
      "sevro.codex.entrypoint"
    ],
  ).toBe("app-server");
});
