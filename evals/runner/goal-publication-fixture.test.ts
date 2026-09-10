import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

for (const scenario of [
  { name: "long draft flag", args: ["--draft"], creations: 1, passes: true },
  { name: "short draft flag", args: ["-d"], creations: 1, passes: true },
  {
    name: "assigned draft flag",
    args: ["--draft=true"],
    creations: 1,
    passes: true,
  },
  { name: "no draft flag", args: [], creations: 1, passes: false },
  {
    name: "draft mention in body text",
    args: ["--body", "Do not use --draft for this PR"],
    creations: 1,
    passes: false,
  },
  {
    name: "duplicate draft creation",
    args: ["--draft"],
    creations: 2,
    passes: false,
  },
]) {
  test(`publication draft oracle: ${scenario.name}`, async () => {
    const source = new URL(
      "../../plugins/orchestration/darrow-goal-loop/skills/adaptive-goal/evals/authorized-publication.yaml",
      import.meta.url,
    );
    const evalCase = parse(await Bun.file(source).text()) as EvalCase;
    const check = evalCase.checks.find(
      (entry) => entry.name === "exactly one draft pull request was opened",
    );
    expect(check).toBeDefined();
    const repo = await buildFixture({
      fixture: evalCase.fixture,
      skillDir: "",
      skillMounts: [],
    });
    try {
      const gh = join(repo, ".git/fixture-bin/gh");
      for (let creation = 0; creation < scenario.creations; creation++) {
        expect(
          Bun.spawnSync(["/bin/bash", gh, "pr", "create", ...scenario.args], {
            cwd: repo,
          }).exitCode,
        ).toBe(0);
      }
      const grade = Bun.spawnSync(["/bin/bash", "-c", check!.run], {
        cwd: repo,
      });
      expect(grade.exitCode === 0).toBe(scenario.passes);
    } finally {
      await destroyFixture(repo);
    }
  });
}

async function publicationState(repo: string) {
  const git = (args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: repo });
    expect(result.exitCode).toBe(0);
    return result.stdout.toString();
  };
  const directory = join(repo, ".git/fixture-state");
  const entries = (await readdir(directory, { recursive: true })).sort();
  const fixtureState = await Promise.all(
    entries.map(async (name) => {
      const path = join(directory, name);
      return [
        name,
        (await lstat(path)).isFile()
          ? (await readFile(path)).toString("base64")
          : "directory",
      ];
    }),
  );
  return {
    worktree: git(["status", "--porcelain", "--untracked-files=all"]),
    localRefs: git(["for-each-ref", "--format=%(refname) %(objectname)"]),
    remoteRefs: git([
      "--git-dir=.git/fixture-remote.git",
      "for-each-ref",
      "--format=%(refname) %(objectname)",
    ]),
    fixtureState,
  };
}

test("publication fixture help is read-only and preserves the single creation allowance", async () => {
  const source = new URL(
    "../../plugins/orchestration/darrow-goal-loop/skills/adaptive-goal/evals/authorized-publication.yaml",
    import.meta.url,
  );
  const evalCase = parse(await Bun.file(source).text()) as EvalCase;
  const repo = await buildFixture({
    fixture: evalCase.fixture,
    skillDir: "",
    skillMounts: [],
  });
  try {
    const gh = join(repo, ".git/fixture-bin/gh");
    const log = join(repo, ".git/fixture-state/gh-pr-calls");
    for (const flag of ["--help", "-h"]) {
      const before = await publicationState(repo);
      expect(before.worktree).toBe("");
      const help = Bun.spawnSync(["/bin/bash", gh, "pr", "create", flag], {
        cwd: repo,
      });
      expect(help.exitCode).toBe(0);
      expect(help.stdout.toString()).toContain("--draft");
      expect(existsSync(log)).toBe(false);
      expect(await publicationState(repo)).toEqual(before);
    }
    const creation = Bun.spawnSync(
      ["/bin/bash", gh, "pr", "create", "--draft"],
      { cwd: repo },
    );
    expect(creation.exitCode).toBe(0);
    const beforeHelp = await Bun.file(log).text();
    expect(beforeHelp.trim().split("\n")).toHaveLength(1);
    expect(beforeHelp).toContain("pr create --draft");
    const published = await publicationState(repo);
    const help = Bun.spawnSync(["/bin/bash", gh, "pr", "create", "--help"], {
      cwd: repo,
    });
    expect(help.exitCode).toBe(0);
    expect(await Bun.file(log).text()).toBe(beforeHelp);
    expect(await publicationState(repo)).toEqual(published);
    const unsupported = Bun.spawnSync(["/bin/bash", gh, "pr", "merge"], {
      cwd: repo,
    });
    expect(unsupported.exitCode).not.toBe(0);
    expect(await Bun.file(log).text()).toBe(beforeHelp);
  } finally {
    await destroyFixture(repo);
  }
});

test("publication evidence reflects the actual draft flag and remote commit", async () => {
  const source = new URL(
    "../../plugins/orchestration/darrow-goal-loop/skills/adaptive-goal/evals/authorized-publication.yaml",
    import.meta.url,
  );
  const evalCase = parse(await Bun.file(source).text()) as EvalCase;
  const repo = await buildFixture({
    fixture: evalCase.fixture,
    skillDir: "",
    skillMounts: [],
  });
  try {
    const gh = join(repo, ".git/fixture-bin/gh");
    const run = (args: string[]) => Bun.spawnSync(args, { cwd: repo });
    expect(
      JSON.parse(
        run([
          "/bin/bash",
          gh,
          "pr",
          "list",
          "--json",
          "number",
        ]).stdout.toString(),
      ),
    ).toEqual([]);
    expect(run(["/bin/bash", gh, "pr", "view", "1"]).exitCode).not.toBe(0);
    expect(run(["git", "push", "origin", "HEAD"]).exitCode).toBe(0);
    const remoteTip = run(["git", "rev-parse", "HEAD"])
      .stdout.toString()
      .trim();
    expect(run(["/bin/bash", gh, "pr", "create"]).exitCode).toBe(0);
    const read = () =>
      JSON.parse(
        run([
          "/bin/bash",
          gh,
          "pr",
          "view",
          "1",
          "--json",
          "state,isDraft,headRefOid",
        ]).stdout.toString(),
      );
    expect(read()).toMatchObject({
      state: "OPEN",
      isDraft: false,
      headRefOid: remoteTip,
    });
    for (const args of [
      ["--head", "different-branch"],
      ["--base", "different-base"],
      ["--repo", "other/repo"],
      ["--state", "closed"],
    ]) {
      const unmatched = run([
        "/bin/bash",
        gh,
        "pr",
        "list",
        ...args,
        "--json",
        "number",
      ]);
      expect(unmatched.exitCode).toBe(0);
      expect(JSON.parse(unmatched.stdout.toString())).toEqual([]);
    }
    expect(
      run(["/bin/bash", gh, "pr", "view", "2", "--json", "number"]).exitCode,
    ).not.toBe(0);
    expect(
      run([
        "git",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "--allow-empty",
        "-m",
        "test: unpublished commit",
      ]).exitCode,
    ).toBe(0);
    expect(run(["git", "rev-parse", "HEAD"]).stdout.toString().trim()).not.toBe(
      remoteTip,
    );
    expect(read().headRefOid).toBe(remoteTip);
    expect(run(["/bin/bash", gh, "pr", "create", "--draft"]).exitCode).toBe(0);
    expect(read()).toMatchObject({ isDraft: true, headRefOid: remoteTip });
  } finally {
    await destroyFixture(repo);
  }
});
