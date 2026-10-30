import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml, stringify } from "yaml";
import { prepareRepositoryRuntime } from "../../sevro-extension/uv-seed-cache";

const root = resolve(import.meta.dir, "../../..");
export const historicalTasks = [
  "ajv-instance-path",
  "click-streams",
  "express-links",
  "go-git-insteadof",
];
const adaptive = "plugins/orchestration/darrow-adaptive-goal";
const recipe = "plugins/task-recipe/darrow-ticket-to-pr";
const capabilities = [
  "darrow-readiness-gate",
  "darrow-verification",
  "darrow-review",
  "darrow-tdd",
  "darrow-git",
  "darrow-tickets",
].map((name) => `plugins/capability/${name}`);
const excluded = new Set([
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".coverage",
  ".hypothesis",
  "tests",
  "agents",
  "evals",
]);
export const deliveryRequest =
  "Read GitHub issue 1 in this repository and implement it on a new ticket-linked branch using TDD. Verify the change, create the intended Conventional Commit or commits, push without force, and open one ready-for-review PR into the default branch. Hand over with required CI checks green on its final commit. Include the PR URL and exact published commit with CI evidence. Preserve existing work. Do not merge, deploy, release, mutate the ticket, change PR metadata, or rewrite history.";

export interface ValueCase {
  id: string;
  invariant: string;
  prompt: string;
  harnesses?: string[];
  additional_skills?: string[];
  expect_head_change?: boolean;
  fixture: {
    source: string;
    files: Record<string, string>;
    setup: string;
    ticket?: { id: string; title: string; body: string };
  };
  checks: { name: string; run: string; metric?: string }[];
  output_checks?: {
    name: string;
    reported_head?: boolean;
    expect_regex?: string;
  }[];
}

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
async function json(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

function supportingSkills(track: "implementation" | "delivery") {
  return [
    `${capabilities[0]}/skills/assess-implementation-readiness`,
    `${capabilities[1]}/skills/verify-change`,
    `${capabilities[2]}/skills/code-review`,
    `${capabilities[3]}/skills/tdd`,
    ...(track === "delivery"
      ? [
          `${adaptive}/skills/adaptive-goal`,
          ...[
            "create-branch",
            "prepare-task-branch",
            "create-commit",
            "create-pr",
          ].map((skill) => `${capabilities[4]}/skills/${skill}`),
          `${capabilities[5]}/skills/read-ticket`,
        ]
      : []),
  ];
}

export function valueCase(
  original: ValueCase,
  track: "implementation" | "delivery",
) {
  const result = structuredClone(original);
  result.id = original.id.replace(
    "orchestration-oss-",
    `current-${track}-oss-`,
  );
  result.harnesses = ["codex"];
  result.additional_skills = supportingSkills(track);
  // Controls use the same owner override with --without-skill, removing all plugins.
  result.fixture.setup += '\nmkdir -p "$HOME/.darrow/reviews"';
  if (track === "delivery") {
    const guidance = original.fixture.files["AGENTS.md"];
    if (guidance === undefined)
      throw new Error("Historical task lacks AGENTS.md");
    result.prompt = deliveryRequest;
    delete result.fixture.ticket;
    result.fixture.files["AGENTS.md"] =
      guidance.replace(" Do not commit or publish changes.", "") +
      "\nThis is an isolated delivery benchmark. The gh command and Git SSH transport use local fixtures. Observe required CI for the exact published commit with `fixture-ci <full-commit-id>` or `gh pr checks --required`. They execute the focused upstream check on the clean published checkout.\n";
    const assets = `{{case_dir}}/${original.id.replace("orchestration-oss-", "")}`;
    result.fixture.setup += `\nbash "${assets}/setup-value.sh" "${assets}"`;
    result.expect_head_change = true;
    result.checks.push({
      name: "final commit is published in one open PR with passing required CI",
      run: `bun -e 'const head=Bun.spawnSync(["git","rev-parse","HEAD"]).stdout.toString().trim();const response=await fetch(new URL("/verify",process.env.DARROW_BENCHMARK_CI_URL),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({head})});if(!response.ok)throw new Error(await response.text());console.log(await response.text())' && test ! -e .fixture-state/forbidden-effects`,
    });
    result.output_checks = [
      { name: "handover names the final commit", reported_head: true },
      {
        name: "handover names the isolated PR",
        expect_regex: "https://fixture\\.invalid/benchmark/repo/pull/1",
      },
    ];
  }
  return result;
}

async function prepareConditions(experiment: string) {
  const conditions = join(experiment, "conditions");
  await mkdir(conditions);
  await cp(
    join(import.meta.dir, "conditions/darrow-adaptive-goal-codex.md"),
    join(conditions, "adaptive-goal.md"),
  );
  await cp(
    join(import.meta.dir, "conditions/vanilla.md"),
    join(conditions, "vanilla.md"),
  );
  await writeFile(
    join(conditions, "ticket-to-pr.md"),
    "Use {{skill_invocation}} for GitHub issue 1, preserving all caller options in the request below. Follow the current recipe and its delegated Adaptive Goal in this main thread.\n",
  );
  await writeFile(
    join(conditions, "vanilla-delivery.md"),
    "Complete the delivery request below directly in this agent context. Do not use native goal mode, an orchestration skill or child agents. Inspect, implement, test, self-review, commit and publish within the request's limits.\n",
  );
}

async function prepareTask(experiment: string, task: string) {
  const source = await readFile(
    join(import.meta.dir, `cases/oss-${task}.yaml`),
    "utf8",
  );
  const original = parseYaml(source) as ValueCase;
  const directory = join(experiment, "cases");
  await mkdir(directory, { recursive: true });
  for (const asset of [
    "ajv-eval-tsconfig.json",
    "ajv-eval-stubs.d.ts",
    "go-cache.fixture.sh",
  ])
    await cp(join(import.meta.dir, "cases", asset), join(directory, asset));
  const assets = join(directory, task);
  await mkdir(assets);
  for (const asset of ["value-forge.ts", "setup-value.sh"])
    await cp(join(import.meta.dir, "fixtures", asset), join(assets, asset));
  for (const track of ["implementation", "delivery"] as const)
    await writeFile(
      join(directory, `${track}-${task}.yaml`),
      stringify(valueCase(original, track)),
    );
  const engineering = original.prompt.replace(
    " Do not commit or publish changes.",
    "",
  );
  const focused = original.checks.find(
    (check: { name: string }) =>
      check.name.startsWith("focused upstream") ||
      check.name === "Ajv TypeScript build",
  );
  if (!focused || !original.fixture.ticket)
    throw new Error(`Historical task ${task} lacks CI or ticket input`);
  await json(join(assets, "task.json"), {
    title: original.fixture.ticket.title,
    body: engineering,
    ci: focused.run,
    base: "main",
    nonce: randomUUID(),
  });
  return { id: original.id, sha256: sha(source) };
}

async function prepareRuntime(project: string) {
  const corpusDirectory = join(project, "evals/corpus/orchestration");
  await mkdir(corpusDirectory, { recursive: true });
  const manifest = parseYaml(
    await readFile(
      join(root, "evals/corpus/orchestration/manifest.yaml"),
      "utf8",
    ),
  );
  manifest.cache_dir = join(root, "evals/corpus/orchestration/cache");
  await writeFile(join(corpusDirectory, "manifest.yaml"), stringify(manifest));
  const configDirectory = join(project, ".codex");
  await mkdir(configDirectory);
  await cp(
    join(root, ".codex/config.toml"),
    join(configDirectory, "config.toml"),
  );
  const runtime = JSON.parse(
    await readFile(
      join(root, "evals/sevro-extension/runtime-review-artifacts.json"),
      "utf8",
    ),
  );
  runtime.network = { localHttp: true };
  runtime.runtime.sharedCacheDirectories[0].roles.push("hooks");
  runtime.hooks.plugins = ["darrow-review", "darrow-tdd", "darrow-tickets"];
  await json(join(project, "runtime-candidate-delivery.json"), runtime);
  runtime.hooks.plugins = ["darrow-review", "darrow-tdd"];
  await json(join(project, "runtime-candidate-implementation.json"), runtime);
  delete runtime.hooks.plugins;
  await json(join(project, "runtime-vanilla.json"), runtime);
}

async function prepareSuites(experiment: string) {
  const suites: Record<string, string> = {};
  for (const track of ["implementation", "delivery"]) {
    const owner = track === "delivery" ? recipe : adaptive;
    const skill = track === "delivery" ? "ticket-to-pr" : "adaptive-goal";
    const skill_dir = `../../../${owner}/skills/${skill}`;
    const modes = {
      vanilla: {
        owner_evaluation: "passive",
        model_by_harness: { codex: "gpt-6.1-sol" },
        effort: "medium",
        without_skill: true,
        skill_dir,
        condition: `conditions/${track === "delivery" ? "vanilla-delivery" : "vanilla"}.md`,
      },
      [skill]: {
        owner_evaluation: "passive",
        model_by_harness: { codex: "gpt-6.1-sol" },
        effort: "medium",
        skill_dir,
        mount_plugin_skills: true,
        condition: `conditions/${track === "delivery" ? "ticket-to-pr" : "adaptive-goal"}.md`,
      },
    };
    const suite = join(experiment, `${track}-suite.yaml`);
    await writeFile(
      suite,
      stringify({
        version: 1,
        experiment: `current-${track}-value`,
        harnesses: ["codex"],
        case_filter: historicalTasks.map(
          (task) => `current-${track}-oss-${task}`,
        ),
        modes,
      }),
    );
    suites[track] = suite;
  }
  return suites;
}

async function preserveCaller(output: string) {
  const sources = [];
  for (const path of [
    "prepare-value.ts",
    "run-value.ts",
    "fixtures/setup-value.sh",
    "fixtures/value-forge.ts",
    "fixtures/value-ci.ts",
    "fixtures/value-ci-host.ts",
  ]) {
    const content = await readFile(join(import.meta.dir, path), "utf8");
    const target = join(output, "caller", path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, content);
    sources.push({ path, sha256: sha(content) });
  }
  return sources;
}

/** Freeze current candidates around unchanged historical engineering contracts. */
export async function prepareValue(output: string, options = { warm: true }) {
  if (!isAbsolute(output)) throw new Error("--output must be absolute");
  await mkdir(output); // Refuse reuse: never overwrite candidates or retained evidence.
  if (options.warm) prepareRepositoryRuntime(root);
  const project = join(output, "project");
  const experiment = join(project, "evals/experiments/current-value");
  await mkdir(experiment, { recursive: true });
  for (const plugin of [adaptive, recipe, ...capabilities])
    await cp(join(root, plugin), join(project, plugin), {
      recursive: true,
      filter: (source) =>
        !excluded.has(basename(source)) &&
        source !== join(root, plugin, "README.md"),
    });
  await prepareConditions(experiment);
  const sources = [];
  for (const task of historicalTasks)
    sources.push(await prepareTask(experiment, task));
  await prepareRuntime(project);
  const suites = await prepareSuites(experiment);
  const callerSources = await preserveCaller(output);
  const revision = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root })
    .stdout.toString()
    .trim();
  const patch = Bun.spawnSync(["git", "diff", "HEAD"], {
    cwd: root,
  }).stdout.toString();
  const prepared = {
    format: "darrow-current-value-v1",
    project,
    suites,
    sources,
    sourceRevision: revision,
    sourcePatchSha256: sha(patch),
    callerSources,
    candidate: {
      model: "gpt-6.1-sol",
      effort: "medium",
      implementationRouting: "current-policy",
    },
    trials: 1,
    threshold: 1,
    packagingExclusions: [...excluded, "plugin-entry-README.md"],
  };
  await json(join(output, "benchmark.json"), prepared);
  return prepared;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { output: { type: "string" } },
    strict: true,
  });
  if (!values.output) throw new Error("--output is required");
  console.log(JSON.stringify(await prepareValue(values.output), null, 2));
}
