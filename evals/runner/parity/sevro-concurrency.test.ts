import { afterEach, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];
const command = resolve(import.meta.dir, "../../sevro-extension/run.ts");

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("Darrow exact and filtered entrypoints preserve Sevro trial concurrency", async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-sevro-jobs-")),
  );
  roots.push(root);
  const project = join(root, "project");
  const cases = join(project, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "parallel.yaml"),
    JSON.stringify({
      id: "parallel",
      invariant: "SE-C16",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: initial", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "answer", expect_exact: "ready" }],
    }),
  );
  const adapter = join(root, "adapter.ts");
  await writeFile(
    adapter,
    `let active = 0, peak = 0;
let release;
const firstPair = new Promise(resolve => { release = resolve; });
export default {
  id: "test.darrow-parallel", model: "synthetic", effort: "low", capabilities: ["sevro.host.exec"],
  async run({ condition }) {
    active++;
    peak = Math.max(peak, active);
    if (active === 2) release();
    await Promise.race([firstPair, Bun.sleep(2000)]);
    await Bun.sleep(30);
    active--;
    return { finalMessage: "ready", complete: true, actualCondition: condition,
      observations: [{ id: "test.darrow.jobs", completeness: "complete", data: { peak } }] };
  },
};\n`,
  );
  for (const selector of ["--case-id", "--case"]) {
    const child = Bun.spawn(
      [
        process.execPath,
        command,
        selector,
        "parallel",
        "--project-root",
        project,
        "--results-root",
        join(root, selector.slice(2)),
        "--",
        "--adapter-module",
        adapter,
        "--condition",
        "passive",
        "--trials",
        "4",
        "--threshold",
        "1",
        "--jobs",
        "2",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(code, stderr).toBe(0);
    const reply = JSON.parse(stdout);
    const result = selector === "--case-id" ? reply : reply.runs[0].result;
    expect(
      result.cases[0].trials.map((trial: { trial: number }) => trial.trial),
    ).toEqual([1, 2, 3, 4]);
    const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
    expect(evidence.configuration.redacted.jobs).toBe(2);
    expect(
      evidence.trials.map((trial: { trial: number }) => trial.trial),
    ).toEqual([1, 2, 3, 4]);
    const peaks = evidence.trials.map(
      (trial: { observations: { id: string; data: { peak: number } }[] }) =>
        trial.observations.find((row) => row.id === "test.darrow.jobs")!.data
          .peak,
    );
    expect(Math.max(...peaks)).toBe(2);
    expect(evidence.result.execution.status).toBe("completed");
    expect(evidence.result.grading.status).toBe("completed");
    expect(evidence.result.task.verdict).toBe("passed");
  }
}, 15_000);
