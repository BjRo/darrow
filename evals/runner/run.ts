import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { buildFixture, destroyFixture } from "./fixture";
import { resolveCorpusSource } from "./corpus";
import { runQualityJudge } from "./judge";
import { runChecks, runOutputChecks } from "./checks";
import { claudeAdapter } from "./adapters/claude";
import { codexAdapter } from "./adapters/codex";
import {
  extractOrchestrationMetrics,
  hasForeignOrchestrationRoute,
  observeCodexTicketPipelineRoutes,
  reconcileObservedTicketPipelineRoutes,
} from "./orchestration-metrics";
import type {
  CaseResult,
  CheckResult,
  EvalCase,
  HarnessAdapter,
  TrialResult,
} from "./types";

const ADAPTERS: Record<string, HarnessAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
};

const ROOT = resolve(import.meta.dir, "..", "..");
const RESULTS_ROOT = join(ROOT, "evals", "results");
const DEFAULT_CORPUS_MANIFEST = join(
  ROOT,
  "evals",
  "corpus",
  "orchestration",
  "manifest.yaml",
);

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ??
    0
  );
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

async function repositoryHead(repoDir: string): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`cannot read fixture HEAD: ${stderr.trim()}`);
  return stdout.trim();
}

/** Cases live next to the skill they test (plugins/<name>/skills/<skill>/evals/*.yaml)
 *  or in skill-less experiments (evals/experiments/<name>/cases/*.yaml). */
async function loadCases(
  filter?: string,
  corpusManifest = DEFAULT_CORPUS_MANIFEST,
): Promise<EvalCase[]> {
  const cases: EvalCase[] = [];
  const glob = new Bun.Glob("plugins/*/skills/*/evals/*.yaml");
  for await (const rel of glob.scan(ROOT)) {
    const path = join(ROOT, rel);
    const evalCase: EvalCase = parseYaml(await readFile(path, "utf8"));
    evalCase.skillDir = dirname(dirname(path));
    evalCase.caseDir = dirname(path);
    cases.push(evalCase);
  }
  const expGlob = new Bun.Glob("evals/experiments/*/cases/*.yaml");
  for await (const rel of expGlob.scan(ROOT)) {
    const path = join(ROOT, rel);
    const evalCase: EvalCase = parseYaml(await readFile(path, "utf8"));
    evalCase.skillDir = ""; // no skill under test — nothing gets mounted
    evalCase.caseDir = dirname(path);
    cases.push(evalCase);
  }
  cases.sort((a, b) => a.id.localeCompare(b.id));
  const selected = filter ? cases.filter((c) => c.id.includes(filter)) : cases;
  for (const evalCase of selected) {
    if (evalCase.fixture.source) {
      if (evalCase.fixture.repo || evalCase.fixture.commits?.length) {
        throw new Error(
          `${evalCase.id}: fixture.source, repo, and commits are mutually exclusive`,
        );
      }
      evalCase.fixture.repo = (
        await resolveCorpusSource(evalCase.fixture.source, corpusManifest)
      ).path;
    }
  }
  return selected;
}

async function runCase(
  evalCase: EvalCase,
  adapter: HarnessAdapter,
  model: string,
  effort: string,
  trials: number,
  dry: boolean,
  condition?: { label: string; text: string },
  withoutSkill = false,
  humanReviewMinutes?: number,
  requireEvaluationRecords = false,
  judge?: { adapter: HarnessAdapter; model: string; effort: string },
): Promise<CaseResult> {
  const promptTemplate = condition?.text.trim()
    ? `${condition.text.trim()}\n\n${evalCase.prompt}`
    : evalCase.prompt;
  const trialResults: TrialResult[] = [];

  for (let trial = 1; trial <= trials; trial++) {
    const repoDir = await buildFixture(
      evalCase.fixture,
      withoutSkill ? "" : evalCase.skillDir,
      adapter.skillMounts,
      evalCase.mount_plugin_skills ?? false,
      evalCase.caseDir,
    );
    try {
      const baseRevision = await repositoryHead(repoDir);
      const prompt = promptTemplate.replaceAll("{{repo_dir}}", repoDir);
      if (dry) {
        console.log(
          `  [dry] ${evalCase.id} trial ${trial}: fixture at ${repoDir}`,
        );
        const checks = await runChecks(repoDir, evalCase.checks);
        trialResults.push({
          trial,
          passed: false,
          checks,
          harness: {
            ok: true,
            durationMs: 0,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: null,
            resultText: "",
            raw: "",
          },
        });
        continue;
      }
      const harness = await adapter.run(repoDir, prompt, model, effort);
      const observedTicketPipelineCheck = reconcileObservedTicketPipelineRoutes(
        harness.resultText,
        harness.raw,
      );
      const observedTicketPipelineRoutes =
        /^format\tdarrow-ticket-pipeline-result-v1$/m.test(harness.resultText)
          ? observeCodexTicketPipelineRoutes(harness.raw)
          : undefined;
      const checks = [
        ...(await runChecks(repoDir, evalCase.checks)),
        {
          name: "base revision remains unchanged",
          passed: (await repositoryHead(repoDir)) === baseRevision,
          detail: "candidate created or switched to a different commit",
        },
        // A no-skill baseline is judged on the same repository outcomes, not
        // on the orchestration-specific reporting contract it cannot know about.
        ...(withoutSkill
          ? []
          : await runOutputChecks(
              harness.resultText,
              evalCase.output_checks ?? [],
              evalCase.skillDir,
            )),
        ...(observedTicketPipelineCheck ? [observedTicketPipelineCheck] : []),
        ...(requireEvaluationRecords
          ? evaluationRecordChecks(harness.resultText)
          : []),
      ];
      const passed = harness.ok && checks.every((c) => c.passed);
      const judgeResult = judge
        ? await runQualityJudge(
            judge.adapter,
            repoDir,
            evalCase.prompt,
            checks,
            judge.model,
            judge.effort,
          )
        : undefined;
      trialResults.push({
        trial,
        passed,
        checks,
        harness,
        orchestrationMetrics: extractOrchestrationMetrics(
          harness.resultText,
          checks,
          observedTicketPipelineRoutes?.length,
        ),
        judge: judgeResult,
      });
      const failed = checks.filter((c) => !c.passed);
      console.log(
        `  ${passed ? "PASS" : "FAIL"} ${evalCase.id} trial ${trial}/${trials} ` +
          `(${(harness.durationMs / 1000).toFixed(1)}s, ${harness.inputTokens + harness.outputTokens} tok)` +
          (failed.length ? ` — ${failed.map((c) => c.name).join(", ")}` : ""),
      );
      for (const c of failed) console.log(`      ${c.name}: ${c.detail}`);
      if (judgeResult) {
        console.log(
          `      judge: ${judgeResult.assessment ? `${judgeResult.assessment.verdict} ${judgeResult.assessment.overallScore}/5` : `invalid (${judgeResult.parseError})`}`,
        );
      }
    } finally {
      await destroyFixture(repoDir);
    }
  }

  const durations = trialResults.map((t) => t.harness.durationMs);
  const tokenTotals = trialResults.map((trial) =>
    hasForeignOrchestrationRoute(trial.harness.resultText, adapter.name)
      ? null
      : trial.harness.inputTokens + trial.harness.outputTokens,
  );
  const measuredOrchestrationTrials = trialResults
    .map((trial) => trial.orchestrationMetrics)
    .filter(
      (metric): metric is NonNullable<typeof metric> => metric !== undefined,
    );
  const judgeAssessments = trialResults
    .map((trial) => (trial.judge?.ok ? trial.judge.assessment : undefined))
    .filter(
      (assessment): assessment is NonNullable<typeof assessment> =>
        assessment !== undefined,
    );
  return {
    caseId: evalCase.id,
    invariant: evalCase.invariant,
    harness: adapter.name,
    model,
    effort,
    condition: condition?.label,
    trials: trialResults,
    passRate:
      trialResults.filter((t) => t.passed).length /
      Math.max(1, trialResults.length),
    meanDurationMs: mean(durations),
    p95DurationMs: p95(durations),
    meanTokens:
      !dry && tokenTotals.every((value) => value !== null)
        ? mean(tokenTotals as number[])
        : null,
    totalCostUsd: trialResults.every(
      (trial) =>
        trial.harness.costUsd !== null &&
        !hasForeignOrchestrationRoute(trial.harness.resultText, adapter.name),
    )
      ? trialResults.reduce(
          (total, trial) => total + (trial.harness.costUsd ?? 0),
          0,
        )
      : null,
    humanReviewMinutes: humanReviewMinutes ?? null,
    meanChildInvocationCount: measuredOrchestrationTrials.length
      ? mean(
          measuredOrchestrationTrials.map(
            (metric) => metric.childInvocationCount,
          ),
        )
      : undefined,
    childInvocationCountSource: measuredOrchestrationTrials.length
      ? withoutSkill || !evalCase.skillDir
        ? "condition_report"
        : trialResults.some(
              (trial) =>
                /^format\tdarrow-ticket-pipeline-result-v1$/m.test(
                  trial.harness.resultText,
                ) &&
                observeCodexTicketPipelineRoutes(trial.harness.raw) !==
                  undefined,
            )
          ? "harness_observed"
          : "controller_result"
      : undefined,
    totalHumanInterruptions: measuredOrchestrationTrials.length
      ? measuredOrchestrationTrials.reduce(
          (total, metric) => total + metric.humanInterruptions,
          0,
        )
      : undefined,
    escapedDefects: measuredOrchestrationTrials.length
      ? measuredOrchestrationTrials.reduce(
          (total, metric) => total + metric.escapedDefects,
          0,
        )
      : undefined,
    falsePositiveVerifierFindings: measuredOrchestrationTrials.length
      ? measuredOrchestrationTrials.reduce(
          (total, metric) => total + metric.falsePositiveVerifierFindings,
          0,
        )
      : undefined,
    meanJudgeScore: judgeAssessments.length
      ? mean(judgeAssessments.map((assessment) => assessment.overallScore))
      : undefined,
    judgePassRate: judgeAssessments.length
      ? judgeAssessments.filter((assessment) => assessment.verdict === "pass")
          .length / judgeAssessments.length
      : undefined,
  };
}

function evaluationRecordChecks(resultText: string): CheckResult[] {
  return [
    {
      name: "reported child invocation count",
      passed: /^evaluation_child_invocations\t\d+$/m.test(resultText),
      detail: "expected evaluation_child_invocations<TAB><integer>",
    },
    {
      name: "reported human intervention count",
      passed: /^evaluation_human_interruptions\t\d+$/m.test(resultText),
      detail: "expected evaluation_human_interruptions<TAB><integer>",
    },
  ];
}

const { values } = parseArgs({
  options: {
    harness: { type: "string", default: "claude" },
    model: { type: "string" },
    effort: { type: "string", default: "medium" },
    trials: { type: "string", default: "5" },
    case: { type: "string" },
    threshold: { type: "string", default: "0.8" },
    dry: { type: "boolean", default: false },
    condition: { type: "string" },
    "without-skill": { type: "boolean", default: false },
    "human-review-minutes": { type: "string" },
    "corpus-manifest": { type: "string" },
    "skill-dir": { type: "string" },
    "mount-plugin-skills": { type: "boolean", default: false },
    "condition-label": { type: "string" },
    "require-evaluation-records": { type: "boolean", default: false },
    output: { type: "string" },
    "judge-harness": { type: "string" },
    "judge-model": { type: "string" },
    "judge-effort": { type: "string", default: "low" },
  },
});

const adapter = ADAPTERS[values.harness!];
if (!adapter) {
  console.error(
    `Unknown harness '${values.harness}'. Available: ${Object.keys(ADAPTERS).join(", ")}`,
  );
  process.exit(1);
}
const judgeAdapter = values["judge-harness"]
  ? ADAPTERS[values["judge-harness"]]
  : undefined;
if (values["judge-harness"] && !judgeAdapter) {
  console.error(
    `Unknown judge harness '${values["judge-harness"]}'. Available: ${Object.keys(ADAPTERS).join(", ")}`,
  );
  process.exit(1);
}

const model = values.model ?? adapter.defaultModel;
let condition: { label: string; text: string } | undefined;
if (values.condition) {
  const condPath = resolve(process.cwd(), values.condition);
  condition = {
    label:
      values["condition-label"] ??
      condPath
        .split("/")
        .pop()!
        .replace(/\.[^.]+$/, ""),
    text: await readFile(condPath, "utf8"),
  };
}
if (values["without-skill"]) {
  condition = {
    label: condition ? `${condition.label}-without-skill` : "without-skill",
    text: condition?.text ?? "",
  };
}
const cases = await loadCases(
  values.case,
  values["corpus-manifest"]
    ? resolve(process.cwd(), values["corpus-manifest"])
    : DEFAULT_CORPUS_MANIFEST,
);
if (values["skill-dir"]) {
  const skillDir = resolve(process.cwd(), values["skill-dir"]);
  for (const evalCase of cases) {
    evalCase.skillDir = skillDir;
    evalCase.mount_plugin_skills = values["mount-plugin-skills"];
  }
}
if (!cases.length) {
  console.error("No cases matched.");
  process.exit(1);
}

const trials = Number(values.trials);
const threshold = Number(values.threshold);
const humanReviewMinutes =
  values["human-review-minutes"] === undefined
    ? undefined
    : Number(values["human-review-minutes"]);
if (
  humanReviewMinutes !== undefined &&
  (!Number.isFinite(humanReviewMinutes) || humanReviewMinutes < 0)
) {
  console.error("--human-review-minutes must be a non-negative number");
  process.exit(1);
}
const harnessVersion = values.dry ? "" : await adapter.version();
console.log(
  `Running ${cases.length} case(s) × ${trials} trial(s) on ${adapter.name}/${model}@${values.effort}` +
    (harnessVersion ? ` (${harnessVersion})` : "") +
    (condition ? ` [condition: ${condition.label}]` : "") +
    (values.dry ? " [dry run — no harness calls]" : ""),
);

const results: CaseResult[] = [];
for (const evalCase of cases) {
  console.log(`\n${evalCase.id} (${evalCase.invariant})`);
  const result = await runCase(
    evalCase,
    adapter,
    model,
    values.effort!,
    trials,
    values.dry!,
    condition,
    values["without-skill"],
    humanReviewMinutes,
    values["require-evaluation-records"],
    judgeAdapter
      ? {
          adapter: judgeAdapter,
          model: values["judge-model"] ?? judgeAdapter.defaultModel,
          effort: values["judge-effort"]!,
        }
      : undefined,
  );
  result.harnessVersion = harnessVersion || undefined;
  results.push(result);
}

console.log("\n── Summary ──");
let failed = 0;
for (const r of results) {
  const ok = r.passRate >= threshold;
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗"} ${r.caseId} [${r.invariant}] pass ${(r.passRate * 100).toFixed(0)}% ` +
      `| ${(r.meanDurationMs / 1000).toFixed(1)}s mean, ${(r.p95DurationMs / 1000).toFixed(1)}s p95 ` +
      `| ${r.meanTokens === null ? "tokens unknown" : `${Math.round(r.meanTokens)} tok mean`} | ${r.totalCostUsd === null ? "cost unknown" : `$${r.totalCostUsd.toFixed(4)}`}`,
  );
  if (r.meanChildInvocationCount !== undefined) {
    console.log(
      `  orchestration: ${r.meanChildInvocationCount.toFixed(1)} reported children mean | ` +
        `${r.totalHumanInterruptions} interruptions | ${r.escapedDefects} escaped defects | ` +
        `${r.falsePositiveVerifierFindings} false-positive findings`,
    );
  }
}

await mkdir(RESULTS_ROOT, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const condSuffix = condition ? `-${condition.label}` : "";
const outPath = values.output
  ? resolve(process.cwd(), values.output)
  : join(
      RESULTS_ROOT,
      `${stamp}-${adapter.name}-${model}-${values.effort}${condSuffix}.json`,
    );
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(results, null, 2));
console.log(`\nResults: ${outPath}`);

process.exit(values.dry ? 0 : failed ? 1 : 0);
