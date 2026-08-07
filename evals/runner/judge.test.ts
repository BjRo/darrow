import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBlindJudgeFixture, parseJudgeAssessment } from "./judge";

describe("orchestration quality judge", () => {
  test("parses a fenced assessment and rejects invalid dimensions", () => {
    const parsed = parseJudgeAssessment(`\n\`\`\`json\n{
      "verdict": "pass",
      "overallScore": 4,
      "dimensions": {
        "correctness": 5,
        "maintainability": 4,
        "testQuality": 3,
        "scopeDiscipline": 4
      },
      "strengths": ["kept the public seam small"],
      "weaknesses": ["one edge case lacks a named test"],
      "summary": "Sound implementation with a minor test gap."
    }\n\`\`\`\n`);
    expect(parsed.verdict).toBe("pass");
    expect(parsed.overallScore).toBe(4);
    expect(parsed.dimensions.correctness).toBe(5);

    expect(() =>
      parseJudgeAssessment(
        '{"verdict":"pass","overallScore":6,"dimensions":{"correctness":5,"maintainability":4,"testQuality":3,"scopeDiscipline":4},"strengths":[],"weaknesses":[],"summary":"bad"}',
      ),
    ).toThrow("overallScore");
  });

  test("copies the candidate diff without condition artifacts", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-judge-source-"));
    let judge = "";
    try {
      const git = (...args: string[]) => {
        const proc = Bun.spawnSync(["git", ...args], { cwd: repo });
        if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
      };
      git("init", "-b", "main");
      git("config", "user.name", "Judge Test");
      git("config", "user.email", "judge@example.invalid");
      await writeFile(join(repo, ".gitignore"), ".agents/\n");
      await writeFile(join(repo, "source.ts"), "export const value = 1;\n");
      git("add", ".gitignore", "source.ts");
      git("commit", "-m", "initial");
      await writeFile(join(repo, "source.ts"), "export const value = 2;\n");
      await writeFile(join(repo, "source.test.ts"), "candidate test\n");
      await mkdir(join(repo, ".agents", "skills"), { recursive: true });
      await writeFile(
        join(repo, ".agents", "skills", "condition.md"),
        "secret\n",
      );
      await writeFile(join(repo, ".git", "fixture-ticket.md"), "secret\n");

      judge = await buildBlindJudgeFixture(repo);
      expect(await readFile(join(judge, "source.ts"), "utf8")).toContain(
        "value = 2",
      );
      expect(existsSync(join(judge, "source.test.ts"))).toBe(true);
      expect(existsSync(join(judge, ".agents"))).toBe(false);
      expect(existsSync(join(judge, ".git", "fixture-ticket.md"))).toBe(false);
    } finally {
      if (judge) await rm(judge, { recursive: true, force: true });
      await rm(repo, { recursive: true, force: true });
    }
  });
});
