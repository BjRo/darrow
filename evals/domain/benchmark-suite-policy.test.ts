import { expect, test } from "bun:test";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { planSuite, runSuite } from "../sevro-extension/suite";
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

async function canonicalArguments(
  filename: string,
  routes: Routes,
  modes: string[],
) {
  const { root, suite, binary, credential } = await canonicalProject(
    filename,
    routes,
  );
  return [
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    join(root, "results"),
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
  ];
}

function option(command: string[], name: string) {
  const index = command.indexOf(name);
  return index < 0 ? undefined : command[index + 1];
}

async function canonicalPlan(
  filename: string,
  routes: Routes,
  modes: string[],
) {
  const args = await canonicalArguments(filename, routes, modes);
  const plan = await planSuite(args);
  expect(plan.manifest.cells).toEqual([]);
  expect(plan.manifest.report).toBeNull();
  expect(await Bun.file(option(args, "--results-root")!).exists()).toBeFalse();
  expect(plan.manifest.harnesses).toEqual(["codex"]);
  expect(plan.manifest.caseIds.slice().sort()).toEqual(
    Object.keys(routes).sort(),
  );
  expect(plan.cells).toHaveLength(Object.keys(routes).length * modes.length);
  expect(
    plan.cells.map((cell) => ({
      index: cell.index,
      harness: cell.harness,
      mode: cell.mode,
      caseId: cell.caseId,
    })),
  ).toEqual(plan.manifest.cellPlan);
  return plan;
}

async function expectOwnerComparisons(
  filename: string,
  routes: Routes,
  modes: string[],
) {
  const plan = await canonicalPlan(filename, routes, modes);
  for (const cell of plan.cells) {
    expect(modes).toContain(cell.mode);
    expect(cell.condition).toBe("enforced");
    expect(cell.effectiveOwnerRoute).toEqual(routes[cell.caseId]);
    expect(
      JSON.parse(option(cell.command, "--assert-effective-owner-routes")!),
    ).toEqual({ [cell.caseId]: routes[cell.caseId] });
    expect(option(cell.command, "--model")).toBe("benchmark-parent");
    expect(option(cell.command, "--effort")).toBe("low");
    expect(option(cell.command, "--condition")).toBe("enforced");
    expect(option(cell.command, "--case-id")).toBe(cell.caseId);
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
  const plan = await canonicalPlan(filename, routes, [
    ...modes,
    ...passiveModes,
  ]);
  for (const cell of plan.cells) {
    const passive = passiveModes.includes(cell.mode);
    const baseMode = passive
      ? cell.mode.slice(0, -"-passive".length)
      : cell.mode;
    const routed = routedModes.includes(baseMode);
    const route = routed
      ? routes[cell.caseId]!
      : { model: "benchmark-parent", effort: "low" };
    expect(modes).toContain(baseMode);
    expect(cell.condition).toBe(passive ? "passive" : "enforced");
    expect(option(cell.command, "--condition")).toBe(cell.condition);
    expect(option(cell.command, "--model")).toBe(route.model);
    expect(option(cell.command, "--effort")).toBe(route.effort);
    expect(cell.effectiveOwnerRoute ?? null).toEqual(
      routed ? null : routes[cell.caseId]!,
    );
    const ownerRoutes = option(cell.command, "--assert-effective-owner-routes");
    expect(ownerRoutes === undefined ? null : JSON.parse(ownerRoutes)).toEqual(
      routed ? null : { [cell.caseId]: routes[cell.caseId] },
    );
    if (passive) {
      const peer = plan.cells.find(
        (peer) => peer.mode === baseMode && peer.caseId === cell.caseId,
      )!;
      expect(peer).toBeDefined();
      expect(peer.condition).toBe("enforced");
      expect(peer.effectiveOwnerRoute).toEqual(cell.effectiveOwnerRoute);
      expect(peer.requestedRoute).toEqual(cell.requestedRoute);
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

test("canonical owner-route conditions reach installed Sevro without claiming dry measurements", async () => {
  const routes = {
    "orchestration-routing-localized-mechanical": {
      model: "gpt-5.6-luna",
      effort: "medium",
    },
  };
  const args = await canonicalArguments(
    "localized-routing-policy-suite.yaml",
    routes,
    ["adaptive-policy", "adaptive-policy-passive"],
  );
  const result = await runSuite(args);
  expect(result).toMatchObject({ cells: 2, failed: 0 });
  const manifest = JSON.parse(await readFile(result.manifest, "utf8"));
  const evidence = await Promise.all(
    manifest.cells.map(
      async (cell: {
        evidencePath: string;
        caseId: string;
        condition: string;
      }) => {
        const retained = JSON.parse(await readFile(cell.evidencePath, "utf8"));
        if (process.env.SEVRO_CHECKOUT !== undefined) {
          expect(retained.runner).toMatchObject({
            source: "checkout",
            root: pathToFileURL(process.env.SEVRO_CHECKOUT).href,
          });
          expect(retained.runner.revision).toMatch(/^[a-f0-9]{40}$/);
          expect(retained.runner.buildDigest).toMatch(/^[a-f0-9]{64}$/);
        } else {
          expect(retained.runner).toMatchObject({
            source: "package",
            packageName: "@bjoernrochel/sevro",
          });
        }
        expect(retained.routes).toContainEqual({
          role: "candidate",
          host: "sevro.host.codex",
          model: "benchmark-parent",
          effort: "low",
        });
        expect(
          retained.configuration.redacted.extensionConfiguration
            .effectiveOwnerRoute,
        ).toEqual(routes["orchestration-routing-localized-mechanical"]);
        expect(retained.evaluationIdentity.dimensions.condition).toBe(
          cell.condition,
        );
        expect(retained.result).toMatchObject({
          execution: { status: "not_run" },
          grading: { status: "not_requested" },
          task: { verdict: "not_assessed" },
        });
        expect(retained.result.cases[0].caseId).toBe(cell.caseId);
        return retained;
      },
    ),
  );
  expect(evidence[0].evaluationIdentity.digest).not.toBe(
    evidence[1].evaluationIdentity.digest,
  );
}, 30_000);
