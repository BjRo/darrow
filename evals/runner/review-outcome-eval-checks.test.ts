import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { buildFixture, destroyFixture } from "./fixture";
import type { EvalCase } from "./types";

const plugin = resolve(
  import.meta.dir,
  "../../plugins/capability/darrow-review",
);
const roots: string[] = [];

for (const name of [
  "fix-verification-resolved",
  "fix-verification-progress-advisory",
  "fix-verification-regression-scope",
  "fix-verification-regression-second-round",
  "fix-verification-unavailable",
  "goal-contract-repair-rereview",
  "repair-guidance-alternative",
  "repair-guidance-unresolved",
]) {
  test(`review package fixture setup: ${name}`, async () => {
    const caseDir = join(plugin, "skills/code-review/evals");
    const evalCase = parseYaml(
      await readFile(join(caseDir, `${name}.yaml`), "utf8"),
    ) as EvalCase;
    const repo = await buildFixture({
      fixture: evalCase.fixture,
      skillDir: "",
      skillMounts: [],
      caseDir,
    });
    try {
      if (name === "goal-contract-repair-rereview") {
        expect(
          (await readFile(join(repo, ".git/review-backend"), "utf8")).trim(),
        ).toBe(join(plugin, "backend"));
      } else {
        const input = await readFile(
          join(repo, ".git/verification-input"),
          "utf8",
        );
        const records = JSON.parse(input) as Record<string, string>;
        const manifest = records.prior_manifest;
        expect(manifest).toBeTruthy();
        expect(JSON.parse(await readFile(manifest!, "utf8")).repository).toBe(
          repo,
        );
      }
    } finally {
      await destroyFixture(repo);
    }
  }, 30_000);
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function fixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-review-outcome-")),
  );
  roots.push(root);
  const artifacts = join(root, ".git/darrow-review.fixture");
  const backend = join(root, ".git/eval-tools/backend");
  await mkdir(artifacts, { recursive: true });
  await mkdir(backend, { recursive: true });
  for (const name of ["src", "pyproject.toml", "uv.lock"])
    await cp(join(plugin, "backend", name), join(backend, name), {
      recursive: true,
    });
  return { root, artifacts, backend };
}

async function gate(root: string, file: string, name: string, shell: string) {
  const evalCase = parseYaml(
    await readFile(
      join(plugin, "skills/code-review/evals", `${file}.yaml`),
      "utf8",
    ),
  ) as EvalCase;
  const check = evalCase.checks.find((check) => check.name === name);
  if (!check) throw new Error(`Missing check: ${file}: ${name}`);
  const result = spawnSync(shell, ["-c", check.run], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, DARROW_REVIEW_STATE_DIR: ".git" },
  });
  if (result.error) throw result.error;
  return result.status;
}

function verification(
  advisoryResolved = true,
  checkEvidence = "exited 0: no output",
) {
  const target = "a".repeat(40);
  const record = {
    format: "darrow-review-verification-v3",
    original_target: target,
    prior_target: target,
    current_target: "b".repeat(40),
    previous_verification: { checksum: "none", path: "none" },
    original_findings: [] as Record<string, string>[],
    attempts: [] as Record<string, string>[],
    checks: [
      {
        command: "bash check.sh",
        applicability: "applicable",
        status: "pass",
        evidence: checkEvidence,
      },
    ],
    outcome: "clear",
    next_action: "none",
  };
  for (const [index, axis] of ["standards", "spec", "spec"].entries()) {
    const order = index + 1;
    record.original_findings.push({
      key: `${axis}:${order}:${target}`,
      axis,
      order: String(order),
      severity: order === 3 ? "low" : "high",
      disposition: order === 3 ? "advisory" : "blocking",
      location: `src/config.js:${order}`,
      source: "requirement",
      evidence: "Original evidence",
    });
  }
  for (const [index, axis] of ["standards", "spec", "spec"].entries()) {
    const unresolved = index === 2 && !advisoryResolved;
    record.attempts.push({
      key: `${axis}:${index + 1}:${target}`,
      status: unresolved ? "unresolved" : "resolved",
      progress: unresolved ? "unchanged" : "resolved",
      evidence:
        "Whether resolved or unresolved, evidence prose is not the state",
    });
  }
  return JSON.stringify(record);
}

async function render(
  setup: Awaited<ReturnType<typeof fixture>>,
  record: string,
) {
  const path = join(setup.artifacts, "verification.json");
  await writeFile(path, record);
  const rendered = spawnSync(
    "uv",
    [
      "run",
      "--quiet",
      "--frozen",
      "--no-dev",
      "--project",
      setup.backend,
      "review-report",
      "render-verification",
      path,
    ],
    { encoding: "utf8" },
  );
  expect(rendered.status, rendered.stderr).toBe(0);
  await writeFile(join(setup.artifacts, "verification.md"), rendered.stdout);
  await writeFile(join(setup.root, ".git/last-message.md"), rendered.stdout);
  return rendered.stdout;
}

for (const shell of ["bash", "/bin/bash"]) {
  describe(`review outcome eval checks (${shell})`, () => {
    for (const variant of [
      "captured diagnostic",
      "different diagnostic",
      "invented evidence",
      "missing capture",
    ] as const) {
      test(`unavailable check: ${variant}`, async () => {
        const setup = await fixture();
        const diagnostic =
          variant === "different diagnostic"
            ? "exited 127: verifier service cannot be reached"
            : "exited 127: required external verifier is unavailable";
        const check = {
          command: "bash external-check.sh",
          applicability: "applicable",
          status: "blocked",
          evidence: diagnostic,
        };
        const records = JSON.parse(verification());
        const record = JSON.stringify({
          ...records,
          checks: [check],
          evidence_gaps: ["Required check unavailable"],
          outcome: "blocked",
        });
        await writeFile(join(setup.artifacts, "verification.json"), record);
        if (variant !== "missing capture") {
          await writeFile(
            join(setup.artifacts, "check-1.json"),
            JSON.stringify({
              format: "darrow-review-check-v3",
              checks: [
                variant === "invented evidence"
                  ? {
                      ...check,
                      evidence: "exited 127: a different observation",
                    }
                  : check,
              ],
            }),
          );
        }
        expect(
          await gate(
            setup.root,
            "fix-verification-unavailable",
            "unavailable evidence produces a valid blocked artifact",
            shell,
          ),
        ).toBe(
          variant === "invented evidence" || variant === "missing capture"
            ? 1
            : 0,
        );
      });
    }
    for (const resolved of [true, false]) {
      test(`resolved case ${resolved ? "accepts all resolved states" : "rejects an unresolved advisory despite misleading prose"}`, async () => {
        const setup = await fixture();
        await render(setup, verification(resolved));
        expect(
          await gate(
            setup.root,
            "fix-verification-resolved",
            "additive verification artifact validates and clears",
            shell,
          ),
        ).toBe(resolved ? 0 : 1);
      });
    }
    for (const file of [
      "fix-verification-resolved",
      "fix-verification-regression-scope",
      "fix-verification-unavailable",
      "fix-verification-progress-advisory",
      "fix-verification-regression-second-round",
    ]) {
      for (const variant of [
        "canonical",
        "matching summaries",
        "empty reports",
        "stale artifact",
      ] as const) {
        test(`${file}: ${variant}`, async () => {
          const setup = await fixture();
          if (file === "fix-verification-regression-second-round") {
            // The prior artifact sorts after the current one and has no report.
            const previous = join(
              setup.root,
              ".git/darrow-review.zz-previous/verification.json",
            );
            await mkdir(join(previous, ".."), { recursive: true });
            await writeFile(
              previous,
              verification(true, "prior check evidence"),
            );
            await writeFile(
              join(setup.root, ".git/verification-input"),
              JSON.stringify({
                previous_verification: {
                  checksum: "prior-checksum",
                  path: previous,
                },
              }),
            );
          }
          const output = await render(setup, verification());
          if (variant === "matching summaries" || variant === "empty reports") {
            const summary =
              variant === "empty reports"
                ? "\n"
                : "# Repair verification — CLEAR\n\nAll findings resolved.\n";
            await writeFile(join(setup.artifacts, "verification.md"), summary);
            await writeFile(join(setup.root, ".git/last-message.md"), summary);
          } else if (variant === "stale artifact") {
            await writeFile(
              join(setup.artifacts, "verification.json"),
              verification(true, "exited 0: fresh check output"),
            );
          } else {
            // Existing presentation gates intentionally ignore blank lines.
            await writeFile(
              join(setup.root, ".git/last-message.md"),
              output.replaceAll("\n\n", "\n"),
            );
          }
          expect(
            await gate(
              setup.root,
              file,
              "final response is the complete rendered verification report",
              shell,
            ),
          ).toBe(variant === "canonical" ? 0 : 1);
        });
      }
    }
  });
}
