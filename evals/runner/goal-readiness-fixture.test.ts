import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runChecks } from "./checks";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/readiness-artifact-selected.yaml",
  import.meta.url,
);
for (const [name, trace, passes] of [
  ["one ready assessment", "ready\n", true],
  ["repeated ready assessment", "ready\nready\n", true],
  ["no assessment", "", false],
  ["non-ready assessment", "blocked\n", false],
] as const) {
  test(`readiness selection evidence: ${name}`, async () => {
    const evalCase = parse(await Bun.file(source).text()) as EvalCase;
    const check = evalCase.checks.find(
      (entry) => entry.name === "readiness returns ready evidence",
    )!;
    const repo = await buildFixture({
      fixture: {
        commits: [
          {
            message: "Readiness fixture",
            files: { "README.md": "Synthetic readiness evidence\n" },
          },
        ],
        files: {
          ".git/fixture-state/implementation-readiness-invocations": trace,
        },
      },
      skillDir: "",
      skillMounts: [],
    });
    try {
      expect(
        Bun.spawnSync(["/bin/bash", "-c", check.run], { cwd: repo })
          .exitCode === 0,
      ).toBe(passes);
    } finally {
      await destroyFixture(repo);
    }
  }, 30_000);
}

async function postLaunchFixture() {
  const path = new URL("post-launch-reassessment.yaml", source);
  const evalCase = parse(await Bun.file(path).text()) as EvalCase;
  const repo = await buildFixture({
    fixture: evalCase.fixture,
    skillDir: "",
    skillMounts: [],
    caseDir: dirname(fileURLToPath(path)),
  });
  return { repo, evalCase };
}

test("post-launch fixture begins with string-only acceptance and checks the later undefined constraint separately", async () => {
  const { repo, evalCase } = await postLaunchFixture();
  try {
    await writeFile(
      join(repo, "src/normalize.js"),
      "export function normalize(input) { return input.trim(); }\n",
    );
    const [initial] = await runChecks(repo, [
      { name: "initial string-only acceptance", run: "bash check.sh" },
    ]);
    expect(initial?.passed).toBe(true);
    const [expanded] = await runChecks(repo, [
      evalCase.checks.find(
        (check) => check.name === "caller compatibility is verified",
      )!,
    ]);
    expect(expanded?.passed).toBe(false);
  } finally {
    await destroyFixture(repo);
  }
});

test("caller inspection explicitly assigns the new behavior to the normalization entrypoint", async () => {
  const { repo } = await postLaunchFixture();
  try {
    const [initial] = await runChecks(repo, [
      {
        name: "initial readiness",
        run: 'uv run --quiet --frozen --no-dev --project .agents/backend adaptive-delivery-fixture readiness "$PWD"',
      },
    ]);
    expect(initial?.passed).toBe(true);
    const inspection = Bun.spawnSync(
      [join(repo, ".git/fixture-bin/callerctl"), "inspect"],
      { cwd: repo },
    );
    expect(inspection.exitCode).toBe(0);
    const output = inspection.stdout.toString();
    expect(output).toContain("normalize(undefined)");
    expect(output).toContain("empty string");
  } finally {
    await destroyFixture(repo);
  }
});

for (const mode of ["before-edit", "omitted", "after-edit"] as const) {
  test(`post-launch readiness gate: reassessment ${mode}`, async () => {
    const { repo, evalCase } = await postLaunchFixture();
    const assess =
      'uv run --quiet --frozen --no-dev --project .agents/backend adaptive-delivery-fixture readiness "$PWD"';
    try {
      const [initial] = await runChecks(repo, [
        {
          name: "initial assessment and caller inspection",
          run: `${assess} && callerctl inspect`,
        },
      ]);
      expect(initial?.passed).toBe(true);
      if (mode === "before-edit") {
        const [reassessed] = await runChecks(repo, [
          { name: "reassess before implementation", run: assess },
        ]);
        expect(reassessed?.passed).toBe(true);
      }
      await writeFile(
        join(repo, "src/normalize.js"),
        "import { parse } from './parser.js';\nexport function normalize(input) { return parse(input); }\n",
      );
      if (mode === "after-edit") {
        const [late] = await runChecks(repo, [
          { name: "late reassessment", run: assess },
        ]);
        expect(late?.passed).toBe(true);
      }
      const checks = await runChecks(repo, evalCase.checks);
      expect(
        checks.find(
          (check) => check.name === "caller compatibility is verified",
        )?.passed,
      ).toBe(true);
      expect(
        checks.find(
          (check) =>
            check.name ===
            "changed readiness is assessed by the retained owner",
        )?.passed,
      ).toBe(mode === "before-edit");
      expect(
        checks.find(
          (check) =>
            check.name === "authority and existing parser are preserved",
        )?.passed,
      ).toBe(true);
    } finally {
      await destroyFixture(repo);
    }
  }, 30_000);
}
