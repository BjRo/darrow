import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readlink,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import type {
  CheckResult,
  HarnessAdapter,
  JudgeAssessment,
  JudgeResult,
} from "./types";
import { destroyFixture } from "./fixture";

function score(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 5
  ) {
    throw new Error(`${label} must be an integer from 1 through 5`);
  }
  return value;
}

function stringList(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}

export function parseJudgeAssessment(text: string): JudgeAssessment {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const value = JSON.parse(fenced ? fenced[1]! : trimmed) as Record<
    string,
    unknown
  >;
  if (value.verdict !== "pass" && value.verdict !== "fail") {
    throw new Error("verdict must be pass or fail");
  }
  if (!value.dimensions || typeof value.dimensions !== "object") {
    throw new Error("dimensions must be an object");
  }
  const dimensions = value.dimensions as Record<string, unknown>;
  if (typeof value.summary !== "string" || !value.summary.trim()) {
    throw new Error("summary must be a non-empty string");
  }
  const overallScore = score(value.overallScore, "overallScore");
  if (value.verdict === "pass" && overallScore < 3) {
    throw new Error("a pass verdict requires overallScore of at least 3");
  }
  return {
    verdict: value.verdict,
    overallScore,
    dimensions: {
      correctness: score(dimensions.correctness, "dimensions.correctness"),
      maintainability: score(
        dimensions.maintainability,
        "dimensions.maintainability",
      ),
      testQuality: score(dimensions.testQuality, "dimensions.testQuality"),
      scopeDiscipline: score(
        dimensions.scopeDiscipline,
        "dimensions.scopeDiscipline",
      ),
    },
    strengths: stringList(value.strengths, "strengths"),
    weaknesses: stringList(value.weaknesses, "weaknesses"),
    summary: value.summary,
  };
}

async function git(
  cwd: string,
  args: string[],
  stdin?: string,
): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdin: stdin === undefined ? undefined : "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });
  if (stdin !== undefined) {
    proc.stdin.write(stdin);
    proc.stdin.end();
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0)
    throw new Error(`judge fixture git ${args.join(" ")} failed: ${stderr}`);
  return stdout;
}

/** Copies only the committed repository plus the candidate diff. Evaluation
 * skill mounts, tracker state, dependency installs, and other .git artifacts
 * cannot reveal which condition produced the change to the blind judge. */
export async function buildBlindJudgeFixture(repoDir: string): Promise<string> {
  const judgeDir = await mkdtemp(join(tmpdir(), "darrow-judge-"));
  try {
    await git(judgeDir, ["clone", "--local", "--no-hardlinks", repoDir, "."]);
    await git(judgeDir, ["remote", "remove", "origin"]);
    const diff = await git(repoDir, ["diff", "--binary", "HEAD"]);
    if (diff) await git(judgeDir, ["apply", "--binary"], diff);
    const untracked = (
      await git(repoDir, ["ls-files", "--others", "--exclude-standard", "-z"])
    )
      .split("\0")
      .filter(Boolean);
    for (const relative of untracked) {
      const source = resolve(repoDir, relative);
      const target = resolve(judgeDir, relative);
      if (
        !source.startsWith(resolve(repoDir) + sep) ||
        !target.startsWith(resolve(judgeDir) + sep)
      ) {
        throw new Error(`unsafe untracked judge path: ${relative}`);
      }
      await mkdir(dirname(target), { recursive: true });
      const stat = await lstat(source);
      if (stat.isSymbolicLink()) await symlink(await readlink(source), target);
      else if (stat.isFile()) await copyFile(source, target);
      else throw new Error(`unsupported untracked judge path: ${relative}`);
    }
    return judgeDir;
  } catch (error) {
    await destroyFixture(judgeDir);
    throw error;
  }
}

export async function runQualityJudge(
  adapter: HarnessAdapter,
  repoDir: string,
  task: string,
  checks: CheckResult[],
  model: string,
  effort: string,
): Promise<JudgeResult> {
  const checkSummary = checks
    .map(
      (check) =>
        `- ${check.name}: ${check.passed ? "PASS" : "FAIL"} (${check.detail})`,
    )
    .join("\n");
  const prompt = `You are a condition-blind software-change evaluator. Work read-only: do not edit files, run orchestration skills, or create subagents. Inspect the current repository's final git diff and relevant surrounding code. Ignore files under .git, .agents, and .claude as evaluation infrastructure.

Evaluate the implementation against this engineering task:

<task>
${task}
</task>

The deterministic runner reported:
${checkSummary || "- no deterministic checks were configured"}

Judge the final implementation itself, not the agent's prose and not which orchestration condition produced it. Correctness must reflect the task and deterministic evidence. Maintainability covers fit with the existing architecture and clarity. Test quality covers meaningful regression tests added by the candidate. Scope discipline penalizes unrelated or generated churn.

Return exactly one JSON object, optionally in a JSON fence, with this shape:
{"verdict":"pass|fail","overallScore":1,"dimensions":{"correctness":1,"maintainability":1,"testQuality":1,"scopeDiscipline":1},"strengths":["..."],"weaknesses":["..."],"summary":"..."}
All scores are integers 1-5. A pass requires no material correctness defect and overallScore >= 3.`;
  const judgeDir = await buildBlindJudgeFixture(repoDir);
  try {
    const harness = await adapter.run(judgeDir, prompt, model, effort);
    try {
      const assessment = parseJudgeAssessment(harness.resultText);
      return { ok: harness.ok, assessment, harness };
    } catch (error) {
      return {
        ok: false,
        parseError:
          error instanceof Error ? error.message : "invalid judge output",
        harness,
      };
    }
  } finally {
    await destroyFixture(judgeDir);
  }
}
