import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import {
  runSemanticOutputChecks,
  validateSemanticOutputChecks,
} from "./semantic-output";
import type {
  CheckResult,
  HarnessAdapter,
  SemanticArtifactConfig,
  SemanticOutputResult,
} from "./types";

const MAX_ARTIFACT_BYTES = 64 * 1024;

export function validateSemanticArtifact(
  config: SemanticArtifactConfig | undefined,
  scope: string,
): string[] {
  if (!config) return [];
  const failures: string[] = [];
  const path = config.path;
  if (
    typeof path !== "string" ||
    !path.trim() ||
    isAbsolute(path) ||
    path.split(/[\\/]/).some((part) => part === ".." || part === ".git") ||
    dirname(path).includes("*") ||
    !/^[^*]*\*?[^*]*$/.test(basename(path))
  ) {
    failures.push(
      `${scope}: path must be a repository-relative file with at most one basename *`,
    );
  }
  if (!Array.isArray(config.checks) || config.checks.length === 0) {
    failures.push(`${scope}: checks must be a non-empty array`);
  } else {
    failures.push(
      ...validateSemanticOutputChecks(config.checks, `${scope} checks`),
    );
  }
  return failures;
}

function within(root: string, path: string): boolean {
  return path === root || path.startsWith(root + sep);
}

export async function readSemanticArtifact(
  repoDir: string,
  pattern: string,
): Promise<{ path: string; content: string }> {
  const errors = validateSemanticArtifact(
    { path: pattern, checks: [{ name: "artifact", proposition: "valid" }] },
    "semantic_artifact",
  );
  if (errors.length) throw new Error(errors.join("; "));
  const root = await realpath(repoDir);
  const dir = resolve(root, dirname(pattern));
  if (!within(root, dir))
    throw new Error("semantic artifact directory escapes the fixture");
  const directory = await realpath(dir);
  if (!within(root, directory))
    throw new Error("semantic artifact directory escapes the fixture");
  const name = basename(pattern);
  const matches = name.includes("*")
    ? (await readdir(directory)).filter((entry) => {
        const [prefix, suffix] = name.split("*");
        return entry.startsWith(prefix!) && entry.endsWith(suffix!);
      })
    : [name];
  if (matches.length !== 1)
    throw new Error(
      `semantic artifact pattern matched ${matches.length} files`,
    );
  const path = join(directory, matches[0]!);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > MAX_ARTIFACT_BYTES)
    throw new Error(
      "semantic artifact must be a regular file of at most 64 KiB",
    );
  const resolved = await realpath(path);
  if (!within(root, resolved))
    throw new Error("semantic artifact escapes the fixture");
  return {
    path: relative(root, resolved),
    content: await readFile(resolved, "utf8"),
  };
}

export async function runSemanticArtifactChecks(request: {
  adapter: HarnessAdapter;
  repoDir: string;
  config: SemanticArtifactConfig;
  model: string;
  effort: string;
}): Promise<{
  checks: CheckResult[];
  result: SemanticOutputResult & { path: string };
}> {
  const { adapter, repoDir, config, model, effort } = request;
  try {
    const artifact = await readSemanticArtifact(repoDir, config.path);
    const grade = await runSemanticOutputChecks({
      adapter,
      response: artifact.content,
      checks: config.checks,
      model,
      effort,
      sourceLabel: "artifact",
    });
    return {
      checks: grade.checks,
      result: { ...grade.result, path: artifact.path },
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "semantic artifact unavailable";
    return {
      checks: config.checks.map((check) => ({
        name: check.name,
        passed: false,
        detail,
      })),
      result: {
        ok: false,
        path: config.path,
        route: { harness: adapter.name, model, effort },
        parseError: detail,
      },
    };
  }
}
