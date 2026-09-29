import { afterEach, expect, test } from "bun:test";
import { cp, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/readiness-artifact-selected.yaml",
  import.meta.url,
);
const fixtureAssets = new URL("../../../", source);
const postLaunch = new URL("post-launch-reassessment.yaml", source);
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const assess =
  'uv run --quiet --frozen --no-dev --project .agents/backend adaptive-delivery-fixture readiness "$PWD"';
const pythonRoots: string[] = [];
afterEach(async () => {
  await Promise.all(
    pythonRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function publicPythonRuntime(uv: string) {
  const found = Bun.spawnSync([uv, "python", "find", "--system", "3.13"], {
    env: { ...process.env, UV_PYTHON_DOWNLOADS: "never" },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (found.exitCode !== 0) throw new Error(found.stderr.toString());
  const interpreter = await realpath(found.stdout.toString().trim());
  const runtime = await mkdtemp(join(tmpdir(), "darrow-fixture-python-"));
  pythonRoots.push(runtime);
  await cp(dirname(dirname(interpreter)), runtime, { recursive: true });
  return quote(join(runtime, "bin", basename(interpreter)));
}

async function postLaunchFixture() {
  const { fixture } = await readFixtureCase(postLaunch);
  const uv = Bun.which("uv");
  if (!uv) throw new Error("fixture tool is unavailable: uv");
  const python = await publicPythonRuntime(uv);
  const tools: Record<string, string> = {};
  for (const name of ["node", "uv"]) {
    const executable = Bun.which(name);
    if (!executable) throw new Error(`fixture tool is unavailable: ${name}`);
    tools[name] =
      `#!/bin/sh\n${name === "uv" ? `export UV_OFFLINE=1 UV_PYTHON_DOWNLOADS=never UV_PYTHON=${python}\n` : ""}exec ${quote(executable)} "$@"\n`;
  }
  fixture.bin = { ...fixture.bin, ...tools };
  fixture.setup = `export UV_PYTHON=${python}\n${fixture.setup ?? ""}\nuv sync --quiet --frozen --no-dev --project .agents/backend`;
  return fixture;
}

function writeNormalization(contents: string): OracleCheck {
  return {
    name: "write normalization candidate",
    run: `printf '%s' ${quote(contents)} >src/normalize.js`,
  };
}

for (const [name, trace, passes] of [
  ["one ready assessment", "ready\n", true],
  ["repeated ready assessment", "ready\nready\n", true],
  ["no assessment", "", false],
  ["non-ready assessment", "blocked\n", false],
] as const) {
  test(`readiness selection evidence: ${name}`, async () => {
    const canonical = await readFixtureCase(source);
    const check = canonical.checks.find(
      (entry) => entry.name === "readiness returns ready evidence",
    );
    if (!check) throw new Error("canonical readiness oracle is missing");
    const result = await runFixtureChecks({
      source,
      fixture: {
        commits: [
          {
            message: "Readiness fixture",
            files: { "README.md": "Synthetic readiness evidence\n" },
          },
        ],
      },
      checks: [
        {
          name: "record synthetic readiness trace",
          run: `printf '%s' ${quote(trace)} >.git/fixture-state/implementation-readiness-invocations`,
        },
        check,
      ],
    });
    expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
    expect(result.checks[0]?.status).toBe("passed");
    expect(result.checks[1]?.status).toBe(passes ? "passed" : "failed");
  }, 30_000);
}

test("post-launch fixture begins with string-only acceptance and checks the later undefined constraint separately", async () => {
  const canonical = await readFixtureCase(postLaunch);
  const check = canonical.checks.find(
    (entry) => entry.name === "caller compatibility is verified",
  );
  if (!check)
    throw new Error("canonical caller compatibility oracle is missing");
  const result = await runFixtureChecks({
    source: postLaunch,
    fixture: await postLaunchFixture(),
    fixtureAssets,
    checks: [
      writeNormalization(
        "export function normalize(input) { return input.trim(); }\n",
      ),
      { name: "initial string-only acceptance", run: "bash check.sh" },
      check,
    ],
  });
  expect(result.exitCode, result.diagnostic).toBe(1);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("failed");
  expect(result.checks.map((entry) => entry.status)).toEqual([
    "passed",
    "passed",
    "failed",
  ]);
}, 30_000);

test("caller inspection explicitly assigns the new behavior to the normalization entrypoint", async () => {
  const result = await runFixtureChecks({
    source: postLaunch,
    fixture: await postLaunchFixture(),
    fixtureAssets,
    checks: [
      { name: "initial readiness", run: assess },
      {
        name: "caller inspection names the updated acceptance",
        run: "callerctl inspect",
        expect_regex: "normalize\\(undefined\\)[\\s\\S]+empty string",
      },
    ],
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((entry) => entry.status)).toEqual([
    "passed",
    "passed",
  ]);
}, 30_000);

for (const mode of ["before-edit", "omitted", "after-edit"] as const) {
  test(`post-launch readiness gate: reassessment ${mode}`, async () => {
    const canonical = await readFixtureCase(postLaunch);
    const actions: OracleCheck[] = [
      {
        name: "initial assessment and caller inspection",
        run: `${assess} && callerctl inspect`,
      },
    ];
    if (mode === "before-edit")
      actions.push({ name: "reassess before implementation", run: assess });
    actions.push(
      writeNormalization(
        "import { parse } from './parser.js';\nexport function normalize(input) { return parse(input); }\n",
      ),
    );
    if (mode === "after-edit")
      actions.push({ name: "late reassessment", run: assess });
    const result = await runFixtureChecks({
      source: postLaunch,
      fixture: await postLaunchFixture(),
      fixtureAssets,
      checks: [...actions, ...canonical.checks],
    });
    const passes = mode === "before-edit";
    expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
    expect(
      result.checks.slice(0, actions.length).map((entry) => entry.status),
    ).toEqual(actions.map(() => "passed"));
    expect(
      result.checks.find(
        (entry) => entry.name === "caller compatibility is verified",
      )?.status,
    ).toBe("passed");
    expect(
      result.checks.find(
        (entry) =>
          entry.name === "changed readiness is assessed by the retained owner",
      )?.status,
    ).toBe(passes ? "passed" : "failed");
    expect(
      result.checks.find(
        (entry) => entry.name === "authority and existing parser are preserved",
      )?.status,
    ).toBe("passed");
  }, 30_000);
}
