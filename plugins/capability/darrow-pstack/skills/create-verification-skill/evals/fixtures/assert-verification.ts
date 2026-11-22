import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse } from "yaml";

const mode = process.argv[2];
const state = ".git/eval-checks/mount-excludes.json";
if (mode === "prepare") {
  assert(
    process.env.DARROW_EVAL_MOUNT_EXCLUDES,
    "declared mount exclusions required",
  );
  const excludes = JSON.parse(process.env.DARROW_EVAL_MOUNT_EXCLUDES);
  assert(
    Array.isArray(excludes) &&
      excludes.every((path) => typeof path === "string"),
  );
  writeFileSync(state, JSON.stringify(excludes));
} else {
  assert(
    mode === "create" || mode === "maintain",
    "expected create or maintain",
  );
  const shared = mode === "create" && process.argv[3] === "shared";
  const project = mode === "create" ? "target" : ".";
  const canonical = join(project, ".agents/skills/verify-greeter");
  const mirror = join(project, ".claude/skills/verify-greeter");
  const allowed = [
    canonical,
    join(project, "proof/greeter"),
    ...(shared ? [mirror] : []),
  ];
  const mounts: string[] = JSON.parse(readFileSync(state, "utf8"));
  const within = (path: string, prefix: string) =>
    path === prefix || path.startsWith(`${prefix}/`);
  for (const args of [
    ["diff", "--name-only", "-z"],
    ["diff", "--cached", "--name-only", "-z"],
    ["ls-files", "--others", "-z"],
  ]) {
    const paths = execFileSync("git", args, { encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
    for (const path of paths) {
      assert(
        allowed.some((prefix) => within(path, prefix)) ||
          mounts.some((prefix) => within(path, prefix)),
        `out-of-scope change: ${resolve(path)}`,
      );
    }
  }
  if (mode === "create") {
    const body = readFileSync(join(canonical, "SKILL.md"), "utf8");
    if (shared)
      assert.equal(
        readFileSync(join(mirror, "SKILL.md"), "utf8"),
        body,
        "host entrypoints differ",
      );
    const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    assert(frontmatter, "missing skill frontmatter");
    const metadata = parse(frontmatter[1]!);
    assert.equal(metadata.name, "verify-greeter");
    assert(
      typeof metadata.description === "string" && metadata.description.trim(),
      "missing description",
    );
    const featureRoot = realpathSync(join(canonical, "features"));
    const index = readFileSync(join(featureRoot, "README.md"), "utf8");
    const targets = [...index.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
      .map((match) => match[1]!.replace(/^<|>$/g, "").split("#")[0]!)
      .filter((path) => path.endsWith(".md"));
    assert(targets.length > 0, "feature index has no recipes");
    for (const target of targets) {
      const path = realpathSync(resolve(featureRoot, target));
      const local = relative(featureRoot, path);
      assert(
        local && !local.startsWith("..") && local !== "README.md",
        "recipe escapes feature map or points to index",
      );
      assert(readFileSync(path, "utf8").trim(), `empty recipe: ${path}`);
    }
  }
  const contents = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? contents(path)
        : entry.isFile()
          ? [readFileSync(path, "utf8")]
          : [];
    });
  const proof = contents(join(project, "proof/greeter")).join("\n");
  assert(
    proof.includes("hello Darrow"),
    "retained proof lacks observed greeting",
  );
  assert(
    proof.includes("app.sh") && proof.includes("greet"),
    "retained proof lacks the driven command",
  );
  process.stdout.write(
    `verified ${mode} artifacts and edit scope at ${realpathSync(".")}\n`,
  );
}
