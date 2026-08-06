import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isolatedHarnessEnvironment } from "./environment";

const cleanup: string[] = [];
const original = {
  HOME: process.env.HOME,
  CODEX_HOME: process.env.CODEX_HOME,
  CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
  UNRELATED_EVAL_SECRET: process.env.UNRELATED_EVAL_SECRET,
};

afterEach(async () => {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await Promise.all(
    cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("isolated harness environment", () => {
  test("copies only Codex auth into a private home", async () => {
    const source = await mkdtemp(join(tmpdir(), "darrow-codex-source-"));
    const repo = await mkdtemp(join(tmpdir(), "darrow-codex-fixture-"));
    cleanup.push(source, repo);
    await mkdir(join(repo, ".git"));
    await writeFile(join(source, "auth.json"), '{"token":"test"}');
    await writeFile(join(source, "config.toml"), "model = 'contaminated'");
    process.env.CODEX_HOME = source;
    process.env.UNRELATED_EVAL_SECRET = "must-not-inherit";

    const env = await isolatedHarnessEnvironment("codex", repo);
    const home = env.HOME!;
    const codexHome = env.CODEX_HOME!;
    expect(home).toStartWith(join(repo, ".git", "darrow-eval"));
    expect(codexHome).toStartWith(home);
    expect(env.DARROW_GOAL_LOOP_EXTERNAL_SANDBOX).toBe("1");
    expect(env.UNRELATED_EVAL_SECRET).toBeUndefined();
    expect(await readFile(join(codexHome, "auth.json"), "utf8")).toBe(
      '{"token":"test"}',
    );
    expect(await Bun.file(join(codexHome, "config.toml")).exists()).toBe(false);
  });

  test("copies only Claude credentials into a private config root", async () => {
    const source = await mkdtemp(join(tmpdir(), "darrow-claude-source-"));
    const repo = await mkdtemp(join(tmpdir(), "darrow-claude-fixture-"));
    cleanup.push(source, repo);
    const configSource = join(source, ".claude");
    await mkdir(configSource);
    await mkdir(join(repo, ".git"));
    await writeFile(
      join(configSource, ".credentials.json"),
      '{"oauth":"test"}',
    );
    await writeFile(
      join(configSource, "CLAUDE.md"),
      "contaminating instructions",
    );
    process.env.HOME = source;
    process.env.CLAUDE_CONFIG_DIR = configSource;
    process.env.UNRELATED_EVAL_SECRET = "must-not-inherit";

    const env = await isolatedHarnessEnvironment("claude", repo);
    const home = env.HOME!;
    const claudeConfigDir = env.CLAUDE_CONFIG_DIR!;
    expect(home).toStartWith(join(repo, ".git", "darrow-eval"));
    expect(claudeConfigDir).toStartWith(home);
    expect(env.DARROW_GOAL_LOOP_EXTERNAL_SANDBOX).toBe("1");
    expect(env.UNRELATED_EVAL_SECRET).toBeUndefined();
    expect(env.TMPDIR).toStartWith(join(repo, ".git", "darrow-eval"));
    expect(
      await readFile(join(claudeConfigDir, ".credentials.json"), "utf8"),
    ).toBe('{"oauth":"test"}');
    expect(await Bun.file(join(claudeConfigDir, "CLAUDE.md")).exists()).toBe(
      false,
    );
  });

  test("keeps fixture tools ahead of host tools in zsh login shells", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-shell-fixture-"));
    cleanup.push(repo);
    const fixtureBin = join(repo, ".git", "fixture-bin");
    await mkdir(fixtureBin, { recursive: true });
    const fixtureGh = join(fixtureBin, "gh");
    await writeFile(fixtureGh, "#!/bin/sh\nexit 0\n");
    await chmod(fixtureGh, 0o755);

    const env = await isolatedHarnessEnvironment("codex", repo);
    const proc = Bun.spawn(["/bin/zsh", "-lc", "command -v gh"], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...env,
        PATH: `${fixtureBin}:${env.PATH ?? ""}`,
      },
    });
    const output = (await new Response(proc.stdout).text()).trim();
    expect(await proc.exited).toBe(0);
    expect(output).toBe(fixtureGh);
  });
});
