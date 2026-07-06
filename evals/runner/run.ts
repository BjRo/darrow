import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { buildFixture, destroyFixture } from "./fixture";
import { runChecks } from "./checks";
import { claudeAdapter } from "./adapters/claude";
import { codexAdapter } from "./adapters/codex";
import type { CaseResult, EvalCase, HarnessAdapter, TrialResult } from "./types";

const ADAPTERS: Record<string, HarnessAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
};

const ROOT = resolve(import.meta.dir, "..", "..");
const RESULTS_ROOT = join(ROOT, "evals", "results");

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Cases live next to the skill they test: plugins/<name>/skills/<skill>/evals/*.yaml. */
async function loadCases(filter?: string): Promise<EvalCase[]> {
  const cases: EvalCase[] = [];
  const glob = new Bun.Glob("plugins/*/skills/*/evals/*.yaml");
  for await (const rel of glob.scan(ROOT)) {
    const path = join(ROOT, rel);
    const evalCase: EvalCase = parseYaml(await readFile(path, "utf8"));
    evalCase.skillDir = dirname(dirname(path));
    cases.push(evalCase);
  }
  cases.sort((a, b) => a.id.localeCompare(b.id));
  return filter ? cases.filter((c) => c.id.includes(filter)) : cases;
}

async function runCase(
  evalCase: EvalCase,
  adapter: HarnessAdapter,
  model: string,
  effort: string,
  trials: number,
  dry: boolean,
): Promise<CaseResult> {
  const trialResults: TrialResult[] = [];

  for (let trial = 1; trial <= trials; trial++) {
    const repoDir = await buildFixture(evalCase.fixture, evalCase.skillDir, adapter.skillMounts);
    try {
      if (dry) {
        console.log(`  [dry] ${evalCase.id} trial ${trial}: fixture at ${repoDir}`);
        const checks = await runChecks(repoDir, evalCase.checks);
        trialResults.push({
          trial,
          passed: false,
          checks,
          harness: { ok: true, durationMs: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, raw: "" },
        });
        continue;
      }
      const harness = await adapter.run(repoDir, evalCase.prompt, model, effort);
      const checks = await runChecks(repoDir, evalCase.checks);
      const passed = harness.ok && checks.every((c) => c.passed);
      trialResults.push({ trial, passed, checks, harness });
      const failed = checks.filter((c) => !c.passed);
      console.log(
        `  ${passed ? "PASS" : "FAIL"} ${evalCase.id} trial ${trial}/${trials} ` +
          `(${(harness.durationMs / 1000).toFixed(1)}s, ${harness.inputTokens + harness.outputTokens} tok)` +
          (failed.length ? ` — ${failed.map((c) => c.name).join(", ")}` : ""),
      );
      for (const c of failed) console.log(`      ${c.name}: ${c.detail}`);
    } finally {
      await destroyFixture(repoDir);
    }
  }

  const durations = trialResults.map((t) => t.harness.durationMs);
  const tokens = trialResults.map((t) => t.harness.inputTokens + t.harness.outputTokens);
  return {
    caseId: evalCase.id,
    invariant: evalCase.invariant,
    harness: adapter.name,
    model,
    effort,
    trials: trialResults,
    passRate: trialResults.filter((t) => t.passed).length / Math.max(1, trialResults.length),
    meanDurationMs: mean(durations),
    p95DurationMs: p95(durations),
    meanTokens: mean(tokens),
    totalCostUsd: trialResults.reduce((a, t) => a + t.harness.costUsd, 0),
  };
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
  },
});

const adapter = ADAPTERS[values.harness!];
if (!adapter) {
  console.error(`Unknown harness '${values.harness}'. Available: ${Object.keys(ADAPTERS).join(", ")}`);
  process.exit(1);
}

const model = values.model ?? adapter.defaultModel;
const cases = await loadCases(values.case);
if (!cases.length) {
  console.error("No cases matched.");
  process.exit(1);
}

const trials = Number(values.trials);
const threshold = Number(values.threshold);
console.log(
  `Running ${cases.length} case(s) × ${trials} trial(s) on ${adapter.name}/${model}@${values.effort}` +
    (values.dry ? " [dry run — no harness calls]" : ""),
);

const results: CaseResult[] = [];
for (const evalCase of cases) {
  console.log(`\n${evalCase.id} (${evalCase.invariant})`);
  results.push(await runCase(evalCase, adapter, model, values.effort!, trials, values.dry!));
}

console.log("\n── Summary ──");
let failed = 0;
for (const r of results) {
  const ok = r.passRate >= threshold;
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗"} ${r.caseId} [${r.invariant}] pass ${(r.passRate * 100).toFixed(0)}% ` +
      `| ${(r.meanDurationMs / 1000).toFixed(1)}s mean, ${(r.p95DurationMs / 1000).toFixed(1)}s p95 ` +
      `| ${Math.round(r.meanTokens)} tok mean | $${r.totalCostUsd.toFixed(4)}`,
  );
}

await mkdir(RESULTS_ROOT, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = join(RESULTS_ROOT, `${stamp}-${adapter.name}-${model}-${values.effort}.json`);
await writeFile(outPath, JSON.stringify(results, null, 2));
console.log(`\nResults: ${outPath}`);

process.exit(values.dry ? 0 : failed ? 1 : 0);
