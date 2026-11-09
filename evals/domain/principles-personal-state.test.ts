import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";

const skillRoot = resolve("plugins/capability/darrow-principles/skills");
const subjects = [
  ["principles-first/evals/default-bundled-loading.yaml", 0, "clean"],
  ["principles-first/evals/installed-catalog.yaml", 1, "catalog"],
  ["setup-principles/evals/export-defaults.yaml", 2, "clean"],
  ["setup-principles/evals/initialize-repository.yaml", 1, "repository"],
  ["setup-principles/evals/matrix-personal-initialize.yaml", 0, "personal"],
  ["setup-principles/evals/matrix-preserve-existing.yaml", 0, "clean"],
  ["setup-principles/evals/matrix-explicit-reset.yaml", 0, "reset"],
  ["setup-principles/evals/matrix-accept-new-default.yaml", 0, "accept"],
  ["setup-principles/evals/matrix-decline-new-default.yaml", 0, "decline"],
  ["setup-principles/evals/decline-new-default.yaml", 0, "decline"],
  ["setup-principles/evals/matrix-scope-question.yaml", 0, "clean"],
  ["setup-principles/evals/scope-required.yaml", 0, "clean"],
] as const;
const defaults = readFileSync(
  join(skillRoot, "principles-first/assets/default-principles.md"),
  "utf8",
);
const ids = defaults
  .split("\n")
  .filter((line) => /^\| principle-/.test(line))
  .map((line) => line.split("|")[1]!.trim());
const metadata = `\n## Setup metadata\n\nConsidered bundled IDs: ${ids.join(", ")}\n`;
const completeConfiguration = defaults + metadata;
const scratch = mkdtempSync(join(tmpdir(), "principles-personal-oracles-"));
const fixtures: Array<{
  workspace: string;
  candidateDirectory: string;
  graderDirectory: string;
  command: string;
  presence: boolean;
}> = [];
function put(path: string, value: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}
function environment(graderDirectory: string) {
  const value: Record<string, string | undefined> = {
    ...process.env,
    HOME: graderDirectory,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    BASH_ENV: "/dev/null",
  };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "SEVRO_CANDIDATE_ARTIFACT_PRINCIPLES",
  ])
    delete value[key];
  return value;
}
function git(workspace: string, graderDirectory: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: workspace,
    env: environment(graderDirectory),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
}
beforeAll(() => {
  subjects.forEach(([relative, index, state], position) => {
    const declaration = parse(readFileSync(join(skillRoot, relative), "utf8"));
    const workspace = join(scratch, `workspace-${position}`);
    const candidateDirectory = join(scratch, `candidate-${position}`);
    const graderDirectory = join(scratch, `grader-${position}`);
    mkdirSync(workspace);
    mkdirSync(candidateDirectory);
    mkdirSync(graderDirectory);
    // Deliberately different state: checker HOME must never locate candidate configuration.
    put(
      join(graderDirectory, ".darrow/principles.md"),
      "unrelated grader configuration\n",
    );
    for (const [path, value] of Object.entries(
      declaration.fixture.commits[0].files,
    ))
      put(join(workspace, path), value as string);
    git(workspace, graderDirectory, ["init", "--quiet"]);
    git(workspace, graderDirectory, ["config", "user.name", "Fixture"]);
    git(workspace, graderDirectory, [
      "config",
      "user.email",
      "fixture@example.invalid",
    ]);
    git(workspace, graderDirectory, ["add", "."]);
    git(workspace, graderDirectory, [
      "commit",
      "--quiet",
      "-m",
      "chore: seed oracle fixture",
    ]);
    if (state === "catalog")
      put(join(workspace, "catalog-notes.md"), "requested audit\n");
    if (state === "repository" || state === "reset")
      put(join(workspace, ".darrow/principles.md"), completeConfiguration);
    if (state === "accept" || state === "decline") {
      const local =
        "# My routes\n\n| ID | Trigger | Reference |\n| --- | --- | --- |\n| local-only | Working on local choices | custom-principles/local.md |\n";
      const accepted =
        state === "accept"
          ? "| principle-encode-lessons-in-structure | Addressing recurring corrections | skill:principle-encode-lessons-in-structure |\n"
          : "";
      put(
        join(workspace, ".darrow/principles.md"),
        local + accepted + metadata,
      );
    }
    fixtures.push({
      workspace,
      candidateDirectory,
      graderDirectory,
      command: declaration.checks[index].run,
      presence: state === "personal",
    });
  });
});
afterAll(() => {
  for (const fixture of fixtures) chmodSync(fixture.candidateDirectory, 0o700);
  rmSync(scratch, { recursive: true, force: true });
});
function run(
  position: number,
  grant: "valid" | "unset" | "empty" | "missing" | "inaccessible",
  personalFile: boolean,
) {
  const fixture = fixtures[position]!;
  chmodSync(fixture.candidateDirectory, 0o700);
  rmSync(join(fixture.candidateDirectory, "principles.md"), { force: true });
  if (personalFile)
    put(
      join(fixture.candidateDirectory, "principles.md"),
      completeConfiguration,
    );
  const env: Record<string, string | undefined> = environment(
    fixture.graderDirectory,
  );
  if (grant !== "unset")
    env.SEVRO_CANDIDATE_ARTIFACT_PRINCIPLES =
      grant === "empty"
        ? ""
        : grant === "missing"
          ? join(scratch, "nonexistent-candidate")
          : fixture.candidateDirectory;
  if (grant === "inaccessible") chmodSync(fixture.candidateDirectory, 0);
  try {
    return spawnSync("bash", ["-c", fixture.command], {
      cwd: fixture.workspace,
      env,
      encoding: "utf8",
    });
  } finally {
    chmodSync(fixture.candidateDirectory, 0o700);
  }
}
subjects.forEach(([relative, , state], position) => {
  test(`${relative}: valid candidate state passes despite unrelated grader HOME`, () => {
    const result = run(position, "valid", state === "personal");
    expect(result.status, result.stderr).toBe(0);
  });
  for (const grant of ["unset", "empty", "missing"] as const)
    test(`${relative}: ${grant} grant cannot establish state`, () => {
      expect(run(position, grant, state === "personal").status).not.toBe(0);
    });
  test.skipIf(process.getuid?.() === 0)(
    `${relative}: inaccessible candidate directory cannot establish state`,
    () => {
      expect(
        run(position, "inaccessible", state === "personal").status,
      ).not.toBe(0);
    },
  );
  test(`${relative}: opposite candidate personal-file state fails`, () => {
    expect(run(position, "valid", state !== "personal").status).not.toBe(0);
  });
});
