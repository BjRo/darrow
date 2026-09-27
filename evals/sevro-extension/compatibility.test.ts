import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditCaseCompatibility } from "./index";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function invoke(root: string, extra: string[] = []) {
  const child = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "compatibility.ts"),
      "--project-root",
      root,
      "--json",
      ...extra,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, stderr, report: JSON.parse(stdout) };
}

test("compatibility inventory names unsupported cases and fails closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-inventory-"));
  roots.push(root);
  const cases = join(root, "evals/experiments/sample/cases");
  await mkdir(cases, { recursive: true });
  const base = {
    invariant: "EXAMPLE-C1",
    prompt: "Return ready.",
    fixture: {
      commits: [{ message: "chore: init", files: { "README.md": "ready\n" } }],
    },
    checks: [],
  };
  await writeFile(
    join(cases, "supported.yaml"),
    JSON.stringify({ ...base, id: "supported" }),
  );
  const unsupported = join(cases, "unsupported.yaml");
  await writeFile(
    unsupported,
    JSON.stringify({
      ...base,
      id: "unsupported",
      transcript_checks: [{ name: "raw", expect_regex: "tool" }],
    }),
  );
  const inventory = await auditCaseCompatibility(root);
  expect(inventory).toMatchObject({
    format: "darrow-sevro-compatibility-v1",
    total: 2,
    supported: 1,
    valid: false,
    failures: [
      {
        id: "unsupported",
        source: await realpath(unsupported),
        error: expect.stringContaining("transcript_checks"),
      },
    ],
  });
  const strict = await invoke(root);
  expect(strict.code, strict.stderr).toBe(1);
  expect(strict.report.failures).toEqual(inventory.failures);
  expect((await invoke(root, ["--allow-unsupported"])).code).toBe(0);
  await rm(unsupported);
  expect((await invoke(root)).report).toMatchObject({
    supported: 1,
    valid: true,
    failures: [],
  });
});
