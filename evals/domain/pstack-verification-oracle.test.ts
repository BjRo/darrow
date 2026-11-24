import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const oracle = resolve(
  "plugins/capability/darrow-pstack/skills/create-verification-skill/evals/fixtures/assert-verification.ts",
);
const roots: string[] = [];
afterEach(() =>
  roots
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true })),
);

function fixture(mode = "create") {
  const root = mkdtempSync(join(tmpdir(), "pstack-verification-oracle-"));
  roots.push(root);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, stdio: "pipe" });
  const put = (path: string, body: string) => {
    if (
      mode === "create" &&
      (path.startsWith(".agents/") ||
        path.startsWith(".claude/") ||
        path.startsWith("proof/"))
    )
      path = `target/${path}`;
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  };
  git("init", "--quiet");
  put("app.sh", "echo hello Darrow\n");
  git("add", "app.sh");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "chore: seed fixture",
  );
  put(
    ".git/eval-checks/mount-excludes.json",
    JSON.stringify([".fixture-mount"]),
  );
  put(".fixture-mount/plugin.txt", "harness mount\n");
  const body =
    "---\nname: verify-greeter\ndescription: Verify the greeting.\n---\n# Verify Greeter\nRun bash app.sh greet.\n";
  put(".agents/skills/verify-greeter/SKILL.md", body);
  put(".claude/skills/verify-greeter/SKILL.md", body);
  put(
    ".agents/skills/verify-greeter/features/README.md",
    "[Greeting](greeting.md)\n",
  );
  put(
    ".agents/skills/verify-greeter/features/greeting.md",
    "Run bash app.sh greet and require hello Darrow.\n",
  );
  put("proof/greeter/run.txt", "bash app.sh greet\nhello Darrow\nexit 0\n");
  const check = () =>
    Bun.spawnSync([process.execPath, oracle, "create", "shared"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
  return { root, put, git, body, check };
}

test("creation oracle accepts registered shared skills, a linked recipe and retained proof", () => {
  const view = fixture();
  const result = view.check();
  expect(result.exitCode, result.stderr.toString()).toBe(0);
});

test("preparation requires and retains the exact declared mount exclusions", () => {
  const view = fixture();
  const env = { ...process.env };
  delete env.DARROW_EVAL_MOUNT_EXCLUDES;
  const missing = Bun.spawnSync([process.execPath, oracle, "prepare"], {
    cwd: view.root,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(missing.exitCode).not.toBe(0);
  const declared = [".fixture-mount/plugin.txt"];
  const prepared = Bun.spawnSync([process.execPath, oracle, "prepare"], {
    cwd: view.root,
    env: { ...env, DARROW_EVAL_MOUNT_EXCLUDES: JSON.stringify(declared) },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(prepared.exitCode, prepared.stderr.toString()).toBe(0);
  expect(
    JSON.parse(
      readFileSync(
        join(view.root, ".git/eval-checks/mount-excludes.json"),
        "utf8",
      ),
    ),
  ).toEqual(declared);
});

test("creation oracle rejects malformed skills, missing recipes, mismatched mirrors and missing output", () => {
  for (const variant of ["frontmatter", "recipe", "mirror", "proof"]) {
    const view = fixture();
    if (variant === "frontmatter") {
      view.put(".agents/skills/verify-greeter/SKILL.md", "not a skill");
      view.put(".claude/skills/verify-greeter/SKILL.md", "not a skill");
    }
    if (variant === "recipe")
      view.put(
        ".agents/skills/verify-greeter/features/README.md",
        "No recipes.\n",
      );
    if (variant === "mirror")
      view.put(
        ".claude/skills/verify-greeter/SKILL.md",
        view.body + "different\n",
      );
    if (variant === "proof")
      view.put("proof/greeter/run.txt", "bash app.sh greet\n");
    expect(view.check().exitCode, variant).not.toBe(0);
  }
});

test("both oracles reject unauthorized tracked, staged and ignored untracked changes", () => {
  for (const mode of ["create", "maintain"]) {
    for (const variant of ["tracked", "staged", "untracked", "ignored"]) {
      const view = fixture(mode);
      if (mode === "maintain")
        rmSync(join(view.root, ".claude"), { recursive: true });
      if (variant === "tracked") view.put("app.sh", "changed product\n");
      if (variant === "staged") {
        view.put("app.sh", "staged product\n");
        view.git("add", "app.sh");
        view.put("app.sh", "echo hello Darrow\n");
      }
      if (variant === "untracked" || variant === "ignored")
        view.put("extra-product.txt", "unauthorized\n");
      if (variant === "ignored")
        view.put(".git/info/exclude", "extra-product.txt\n");
      const result = Bun.spawnSync(
        [
          process.execPath,
          oracle,
          mode,
          ...(mode === "create" ? ["shared"] : []),
        ],
        {
          cwd: view.root,
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      expect(result.exitCode, `${mode}: ${variant}`).not.toBe(0);
      expect(result.stderr.toString()).toContain("out-of-scope change:");
    }
  }
});
