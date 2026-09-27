import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { selectCaseIds } from "../../sevro-extension/index";

const roots: string[] = [];
const suiteCommand = resolve(import.meta.dir, "../../sevro-extension/suite.ts");

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-suite-"));
  roots.push(root);
  expect(Bun.spawnSync(["git", "init", "--quiet", root]).exitCode).toBe(0);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  for (const id of ["suite-alpha", "suite-beta"]) {
    await writeFile(
      join(cases, `${id}.yaml`),
      JSON.stringify({
        id,
        invariant: "EXAMPLE-C1",
        prompt: "Return ready.",
        fixture: {
          commits: [
            { message: "chore: init", files: { "README.md": "ready\n" } },
          ],
        },
        checks: [],
        output_checks: [{ name: "response", expect_exact: "ready" }],
      }),
    );
  }
  const adapter = join(root, "adapter.ts");
  await writeFile(
    adapter,
    `import { writeFile } from "node:fs/promises";
export default {
  id: "sevro.host.codex", model: "synthetic", effort: "none",
  async run({ condition, signal }) {
    if (process.env.SEVRO_SUITE_READY_PATH) {
      await writeFile(process.env.SEVRO_SUITE_READY_PATH, "ready");
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
      });
    }
    return { finalMessage: "ready", complete: true, actualCondition: condition,
      inputTokens: 1, outputTokens: 1, usageComplete: true };
  },
};\n`,
  );
  const suite = join(root, "suite.yaml");
  await writeFile(
    suite,
    JSON.stringify({
      version: 1,
      experiment: "example",
      harnesses: ["codex"],
      case_filter: "suite-",
      modes: {
        passive: { owner_evaluation: "passive" },
        enforced: { owner_evaluation: "enforced" },
      },
    }),
  );
  return { root, cases, adapter, suite, results: join(root, "results") };
}

async function waitForFile(path: string) {
  const deadline = Date.now() + 10_000;
  while (!(await Bun.file(path).exists())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`);
    await Bun.sleep(20);
  }
}

async function invoke(args: string[]) {
  const proc = Bun.spawn([process.execPath, suiteCommand, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

test("suite selection rejects duplicate IDs and unsupported modes before running", async () => {
  const { root, cases, suite, results } = await fixture();
  expect(await selectCaseIds(root, ["suite-"])).toEqual([
    "suite-alpha",
    "suite-beta",
  ]);
  expect(selectCaseIds(root, ["missing"])).rejects.toThrow("No cases matched.");
  await writeFile(
    join(cases, "duplicate.yaml"),
    JSON.stringify({ id: "suite-alpha" }),
  );
  expect(selectCaseIds(root, ["suite-"])).rejects.toThrow("duplicate case ID");
  const duplicate = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--",
    "--dry",
  ]);
  expect(duplicate.code).toBe(64);
  expect(await Bun.file(results).exists()).toBeFalse();
  await rm(join(cases, "duplicate.yaml"));
  const unsupported = JSON.parse(await readFile(suite, "utf8"));
  unsupported.modes.passive.without_skill = true;
  await writeFile(suite, JSON.stringify(unsupported));
  const rejected = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--",
    "--dry",
  ]);
  expect(rejected.code).toBe(64);
  expect(rejected.stderr).toContain("unsupported passive mode fields");
  expect(await Bun.file(results).exists()).toBeFalse();
});

test("suite runs every selected mode and case through Sevro public commands", async () => {
  const { root, adapter, suite, results } = await fixture();
  const route = process.env.SEVRO_CHECKOUT
    ? {
        SEVRO_CHECKOUT: process.env.SEVRO_CHECKOUT,
        SEVRO_PACKAGE_BIN: undefined,
      }
    : {
        SEVRO_CHECKOUT: undefined,
        SEVRO_PACKAGE_BIN: process.env.SEVRO_PACKAGE_BIN,
      };
  expect(route.SEVRO_CHECKOUT || route.SEVRO_PACKAGE_BIN).toBeTruthy();
  const run = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--trials",
    "1",
    "--threshold",
    "1",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ]);
  const diagnostics = await readFile(join(results, "suite-run.json"), "utf8");
  const firstResult = JSON.parse(diagnostics).cells[0].result;
  const firstEvidence = firstResult ? await readFile(firstResult, "utf8") : "";
  expect(run.code, `${run.stderr}\n${run.stdout}\n${firstEvidence}`).toBe(0);
  expect(JSON.parse(run.stdout)).toMatchObject({ cells: 4, failed: 0 });
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  expect(manifest.format).toBe("darrow-sevro-suite-v1");
  expect(manifest.harnesses).toEqual(["codex"]);
  expect(manifest.caseIds).toEqual(["suite-alpha", "suite-beta"]);
  expect(manifest.modes).toEqual([
    { name: "passive", condition: "passive" },
    { name: "enforced", condition: "enforced" },
  ]);
  expect(
    manifest.cells.map((cell: { caseId: string; mode: string }) => [
      cell.mode,
      cell.caseId,
    ]),
  ).toEqual([
    ["passive", "suite-alpha"],
    ["passive", "suite-beta"],
    ["enforced", "suite-alpha"],
    ["enforced", "suite-beta"],
  ]);
  for (const cell of manifest.cells) {
    expect(cell.exitCode).toBe(0);
    expect(cell.provenance.evaluationDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(cell.provenance.runner.source).toBe(
      process.env.SEVRO_CHECKOUT ? "checkout" : "package",
    );
    expect(cell.provenance.project.root).toStartWith("file:///");
    expect(cell.provenance.extension.id).toBe("darrow.evals");
    expect(cell.provenance.routes).toContainEqual({
      role: "candidate",
      host: "sevro.host.codex",
      model: "synthetic",
      effort: "none",
    });
    const result = JSON.parse(await readFile(cell.result, "utf8"));
    expect(result.cases[0].caseId).toBe(cell.caseId);
    expect(result.task.verdict).toBe("passed");
    const evidence = JSON.parse(await readFile(cell.evidencePath, "utf8"));
    expect(evidence.condition.requested).toBe(cell.condition);
  }
});

test("suite retains failed cells and continues the remaining public runs", async () => {
  const { root, cases, adapter, suite, results } = await fixture();
  const beta = join(cases, "suite-beta.yaml");
  const definition = JSON.parse(await readFile(beta, "utf8"));
  definition.output_checks[0].expect_exact = "different";
  await writeFile(beta, JSON.stringify(definition));
  const run = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--trials",
    "1",
    "--threshold",
    "1",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ]);
  expect(run.code).toBe(1);
  expect(JSON.parse(run.stdout)).toMatchObject({ cells: 4, failed: 2 });
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  expect(
    manifest.cells.map((cell: { exitCode: number }) => cell.exitCode),
  ).toEqual([0, 1, 0, 1]);
  for (const cell of manifest.cells) {
    const result = JSON.parse(await readFile(cell.result, "utf8"));
    expect(result.task.verdict).toBe(
      cell.caseId === "suite-beta" ? "failed" : "passed",
    );
    expect(cell.provenance.evaluationDigest).toMatch(/^[a-f0-9]{64}$/);
  }
});

test("suite interruption cancels the active Sevro cell and stops selection", async () => {
  const { root, adapter, suite, results } = await fixture();
  const ready = join(root, "suite-ready");
  const child = Bun.spawn(
    [
      process.execPath,
      suiteCommand,
      "--suite",
      suite,
      "--project-root",
      root,
      "--results-root",
      results,
      "--trials",
      "1",
      "--threshold",
      "1",
      "--",
      "--adapter-module",
      adapter,
      "--shell-isolation",
    ],
    {
      env: { ...process.env, SEVRO_SUITE_READY_PATH: ready },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  try {
    await waitForFile(ready);
    child.kill("SIGTERM");
    const [stdout, code] = await Promise.all([
      new Response(child.stdout).text(),
      child.exited,
    ]);
    expect(code).toBe(143);
    expect(JSON.parse(stdout)).toMatchObject({
      cells: 1,
      interrupted: "SIGTERM",
    });
    const manifest = JSON.parse(
      await readFile(join(results, "suite-run.json"), "utf8"),
    );
    expect(manifest.interrupted).toBe("SIGTERM");
    expect(manifest.cells).toHaveLength(1);
    expect(manifest.cells[0].provenance.runner.source).toBe(
      process.env.SEVRO_CHECKOUT ? "checkout" : "package",
    );
    const result = JSON.parse(await readFile(manifest.cells[0].result, "utf8"));
    expect(result.execution.status).toBe("cancelled");
    expect(result.task.verdict).toBe("not_assessed");
  } finally {
    child.kill("SIGKILL");
    await child.exited;
  }
}, 20_000);
