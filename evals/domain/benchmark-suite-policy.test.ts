import { expect, test } from "bun:test";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { policyProject } from "./policy-project";

type Route = { model: string; effort: string };
type Routes = Record<string, Route>;

const suiteDirectory = "evals/experiments/orchestration";
const adaptiveDirectory = "plugins/orchestration/darrow-adaptive-goal";
const ossRoutes: Routes = {
  "orchestration-oss-ajv-instance-path": {
    model: "gpt-5.6-sol",
    effort: "high",
  },
  "orchestration-oss-click-streams": { model: "gpt-5.6-sol", effort: "high" },
  "orchestration-oss-express-links": {
    model: "gpt-5.6-luna",
    effort: "medium",
  },
  "orchestration-oss-go-git-insteadof": {
    model: "gpt-5.6-sol",
    effort: "high",
  },
  "orchestration-oss-requests-proxy": { model: "gpt-5.6-sol", effort: "high" },
  "orchestration-oss-commander-env": {
    model: "gpt-5.6-terra",
    effort: "medium",
  },
  "orchestration-oss-cobra-lifecycle": {
    model: "gpt-5.6-terra",
    effort: "medium",
  },
};

async function canonicalProject(filename: string, routes: Routes) {
  const project = await policyProject(
    { id: "unused-fixture-case" },
    {
      directory: adaptiveDirectory,
      plugin: "darrow-adaptive-goal",
      skill: "adaptive-goal",
    },
  );
  const cases = join(project.root, suiteDirectory, "cases");
  await mkdir(cases, { recursive: true });
  for (const id of Object.keys(routes))
    await writeFile(
      join(cases, id + ".yaml"),
      JSON.stringify({
        id,
        invariant: "SE-C9",
        prompt: "Return ready.",
        fixture: {
          commits: [
            { message: "Initial", files: { "README.md": "fixture\n" } },
          ],
        },
        checks: [],
        output_checks: [{ name: "response", expect_exact: "ready" }],
      }),
    );
  const suite = join(project.root, suiteDirectory, filename);
  await copyFile(
    resolve(import.meta.dir, "..", "..", suiteDirectory, filename),
    suite,
  );
  const conditions = [
    "native-goal-codex.md",
    "darrow-adaptive-goal-workflow-codex.md",
    "darrow-adaptive-goal-codex.md",
  ];
  for (const name of conditions) {
    const target = join(project.root, suiteDirectory, "conditions", name);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(
      resolve(import.meta.dir, "..", "..", suiteDirectory, "conditions", name),
      target,
    );
  }
  const binary = join(project.root, "dry-codex");
  await writeFile(binary, "#!/bin/sh\nexit 99\n", { mode: 0o700 });
  const credential = join(project.root, "auth.json");
  await writeFile(credential, '{"test":"dry-only"}\n');
  return { root: project.root, suite, binary, credential };
}

async function runCanonicalSuite(
  filename: string,
  routes: Routes,
  modes: string[],
) {
  const { root, suite, binary, credential } = await canonicalProject(
    filename,
    routes,
  );
  const results = join(root, "results");
  const child = Bun.spawn(
    [
      process.execPath,
      resolve(import.meta.dir, "../sevro-extension/suite.ts"),
      "--suite",
      suite,
      "--project-root",
      root,
      "--results-root",
      results,
      "--harness",
      "codex",
      ...modes.flatMap((mode) => ["--mode", mode]),
      "--trials",
      "1",
      "--threshold",
      "1",
      "--seed",
      "benchmark-migration-1",
      "--",
      "--dry",
      "--host",
      "codex",
      "--codex-bin",
      binary,
      "--codex-auth-file",
      credential,
      "--model",
      "benchmark-parent",
      "--effort",
      "low",
      "--shell-isolation",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  let diagnostics = stderr + stdout;
  if (
    code !== 0 &&
    (await Bun.file(join(results, "suite-run.json")).exists())
  ) {
    const manifest = JSON.parse(
      await readFile(join(results, "suite-run.json"), "utf8"),
    );
    diagnostics += "\n" + JSON.stringify(manifest.cells.slice(0, 2));
    if (manifest.cells[0]?.result)
      diagnostics += "\n" + (await readFile(manifest.cells[0].result, "utf8"));
  }
  expect(code, diagnostics).toBe(0);
  return JSON.parse(await readFile(join(results, "suite-run.json"), "utf8"));
}

async function expectOwnerComparisons(
  filename: string,
  routes: Routes,
  modes: string[],
) {
  const manifest = await runCanonicalSuite(filename, routes, modes);
  expect(manifest.harnesses).toEqual(["codex"]);
  expect(manifest.caseIds.slice().sort()).toEqual(Object.keys(routes).sort());
  expect(manifest.cells).toHaveLength(
    Object.keys(routes).length * modes.length,
  );
  for (const cell of manifest.cells) {
    expect(modes).toContain(cell.mode);
    expect(cell.condition).toBe("enforced");
    expect(cell.exitCode).toBe(0);
    const evidence = JSON.parse(await readFile(cell.evidencePath, "utf8"));
    if (process.env.SEVRO_CHECKOUT !== undefined) {
      expect(evidence.runner).toMatchObject({
        source: "checkout",
        root: pathToFileURL(process.env.SEVRO_CHECKOUT).href,
      });
      expect(evidence.runner.revision).toMatch(/^[a-f0-9]{40}$/);
      expect(evidence.runner.buildDigest).toMatch(/^[a-f0-9]{64}$/);
    } else {
      expect(evidence.runner).toMatchObject({
        source: "package",
        packageName: "@bjoernrochel/sevro",
      });
    }
    expect(evidence.routes).toContainEqual({
      role: "candidate",
      host: "sevro.host.codex",
      model: "benchmark-parent",
      effort: "low",
    });
    expect(
      evidence.configuration.redacted.extensionConfiguration
        .effectiveOwnerRoute,
    ).toEqual(routes[cell.caseId]);
    expect(evidence.result).toMatchObject({
      execution: { status: "not_run" },
      grading: { status: "not_requested" },
      task: { verdict: "not_assessed" },
    });
    expect(evidence.result.cases[0].caseId).toBe(cell.caseId);
  }
}

test(
  "profile-impact canonical suite retains task and native owner-route comparisons",
  () =>
    expectOwnerComparisons("profile-impact-suite.yaml", ossRoutes, [
      "darrow-workflow",
      "darrow-workflow-risk",
    ]),
  120_000,
);

async function expectPassiveComparisons(
  filename: string,
  routes: Routes,
  modes: string[],
  routedModes: string[],
) {
  const passiveModes = modes.map((mode) => `${mode}-passive`);
  const manifest = await runCanonicalSuite(filename, routes, [
    ...modes,
    ...passiveModes,
  ]);
  expect(manifest.harnesses).toEqual(["codex"]);
  expect(manifest.caseIds.slice().sort()).toEqual(Object.keys(routes).sort());
  expect(manifest.cells).toHaveLength(
    Object.keys(routes).length * modes.length * 2,
  );
  for (const cell of manifest.cells) {
    const passive = passiveModes.includes(cell.mode);
    const baseMode = passive
      ? cell.mode.slice(0, -"-passive".length)
      : cell.mode;
    expect(modes).toContain(baseMode);
    expect(cell.condition).toBe(passive ? "passive" : "enforced");
    expect(cell.exitCode).toBe(0);
    const evidence = JSON.parse(await readFile(cell.evidencePath, "utf8"));
    expect(evidence.evaluationIdentity.dimensions.condition).toBe(
      cell.condition,
    );
    expect(evidence.routes).toContainEqual({
      role: "candidate",
      host: "sevro.host.codex",
      ...(routedModes.includes(baseMode)
        ? routes[cell.caseId]
        : { model: "benchmark-parent", effort: "low" }),
    });
    expect(
      evidence.configuration.redacted.extensionConfiguration
        .effectiveOwnerRoute ?? null,
    ).toEqual(routedModes.includes(baseMode) ? null : routes[cell.caseId]);
    expect(evidence.result).toMatchObject({
      execution: { status: "not_run" },
      grading: { status: "not_requested" },
      task: { verdict: "not_assessed" },
    });
    if (passive) {
      const original = manifest.cells.find(
        (peer: { mode: string; caseId: string }) =>
          peer.mode === baseMode && peer.caseId === cell.caseId,
      );
      expect(original).toBeDefined();
      const peer = JSON.parse(await readFile(original.evidencePath, "utf8"));
      expect(evidence.evaluationIdentity.digest).not.toBe(
        peer.evaluationIdentity.digest,
      );
    }
  }
}

test(
  "profile-impact exposes passive comparisons alongside enforced modes",
  () =>
    expectPassiveComparisons(
      "profile-impact-suite.yaml",
      ossRoutes,
      ["native-goal", "darrow-workflow", "darrow-workflow-risk"],
      ["native-goal"],
    ),
  120_000,
);

test(
  "localized-routing canonical suite retains task and native owner-route comparisons",
  () =>
    expectOwnerComparisons(
      "localized-routing-policy-suite.yaml",
      {
        "orchestration-routing-localized-mechanical": {
          model: "gpt-5.6-luna",
          effort: "medium",
        },
        "orchestration-routing-localized-quality-feature": {
          model: "gpt-5.6-luna",
          effort: "high",
        },
      },
      ["adaptive-policy"],
    ),
  30_000,
);

test(
  "localized-routing exposes passive comparisons alongside enforced modes",
  () =>
    expectPassiveComparisons(
      "localized-routing-policy-suite.yaml",
      {
        "orchestration-routing-localized-mechanical": {
          model: "gpt-5.6-luna",
          effort: "medium",
        },
        "orchestration-routing-localized-quality-feature": {
          model: "gpt-5.6-luna",
          effort: "high",
        },
      },
      ["adaptive-policy"],
      [],
    ),
  30_000,
);

test(
  "promoted-routing canonical suite retains task and native owner-route comparisons",
  () =>
    expectOwnerComparisons(
      "promoted-routing-suite.yaml",
      {
        "orchestration-oss-express-links": {
          model: "gpt-5.6-luna",
          effort: "medium",
        },
        "orchestration-oss-commander-env": {
          model: "gpt-5.6-terra",
          effort: "medium",
        },
        "orchestration-oss-cobra-lifecycle": {
          model: "gpt-5.6-terra",
          effort: "medium",
        },
      },
      ["darrow-promoted-route"],
    ),
  45_000,
);

test(
  "promoted-routing exposes passive comparisons alongside enforced modes",
  () =>
    expectPassiveComparisons(
      "promoted-routing-suite.yaml",
      {
        "orchestration-oss-express-links": {
          model: "gpt-5.6-luna",
          effort: "medium",
        },
        "orchestration-oss-commander-env": {
          model: "gpt-5.6-terra",
          effort: "medium",
        },
        "orchestration-oss-cobra-lifecycle": {
          model: "gpt-5.6-terra",
          effort: "medium",
        },
      },
      ["native-promoted-route", "darrow-promoted-route"],
      ["native-promoted-route"],
    ),
  45_000,
);
