import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const extension = resolve(import.meta.dir, "../../sevro-extension/index.ts");
const projectRoot = resolve(import.meta.dir, "../../..");
const roots: string[] = [];
const digest = "a".repeat(64);

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function command<T>(
  argv: string[],
  input?: unknown,
): Promise<{
  code: number;
  stderr: string;
  value: T;
}> {
  const proc = Bun.spawn(argv, {
    stdin: input === undefined ? "ignore" : "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (input !== undefined) {
    if (!proc.stdin || typeof proc.stdin === "number")
      throw new Error("stdin unavailable");
    await proc.stdin.write(JSON.stringify(input));
    await proc.stdin.end();
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stderr, value: JSON.parse(stdout) as T };
}

interface ExtensionReply {
  result: {
    extension: { id: string };
    protocols: string[];
    cases: Array<{
      fixture: { kind: string; commits: Array<{ message: string }> };
      checks: Array<{ grader: string }>;
      extensionData: { "darrow.case": { invariant: string } };
    }>;
  };
  error: { code: string; message: string };
}

interface CliReply {
  task: { verdict: string };
  cases: Array<{
    trials: Array<{ checks: Array<{ id: string; status: string }> }>;
  }>;
  evidencePath: string;
}

function request(method: string, params: Record<string, unknown>) {
  return {
    protocol:
      method === "describe" ? "sevro.discovery.v1" : "sevro.extension.v1",
    id: `request-${method}`,
    method,
    params,
  };
}

test("Darrow extension resolves an existing skill-free case and rejects unsupported setup", async () => {
  const describe = await command<ExtensionReply>(
    [process.execPath, extension],
    request("describe", {}),
  );
  expect(describe.code).toBe(0);
  expect(describe.value.result.extension.id).toBe("darrow.evals");
  expect(describe.value.result.protocols).toEqual(["sevro.extension.v1"]);
  const resolveParams = (caseId: string) => ({
    projectRoot: pathToFileURL(projectRoot).href,
    selectors: { caseIds: [caseId] },
    configuration: {},
  });
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request(
      "resolve",
      resolveParams("orchestration-routing-localized-mechanical"),
    ),
  );
  expect(resolved.code).toBe(0);
  const selected = resolved.value.result.cases[0]!;
  expect(selected.fixture).toMatchObject({
    kind: "generated",
    commits: [{ message: "chore: init" }],
  });
  expect(
    selected.checks.map((check: { grader: string }) => check.grader),
  ).toEqual(["sevro.shell", "sevro.shell"]);
  expect(selected.extensionData["darrow.case"].invariant).toBe(
    "ORCH-ROUTING-LOCALIZED-MECHANICAL",
  );
  const unsupported = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", resolveParams("orchestration-oss-requests-proxy")),
  );
  expect(unsupported.value.error.code).toBe("darrow.extension.invalid");
  expect(unsupported.value.error.message).toMatch(
    /unsupported|generated Git history/,
  );
});

test("Darrow extension grades combined shell and final-message assertions", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-stdout-"));
  roots.push(root);
  const caseDir = join(root, "evals/experiments/example/cases");
  await mkdir(caseDir, { recursive: true });
  await writeFile(
    join(caseDir, "stdout.yaml"),
    JSON.stringify({
      id: "stdout-case",
      invariant: "EXAMPLE-C1",
      prompt: "Inspect the fixture.",
      fixture: {
        commits: [{ message: "Initialize", files: { "README.md": "ready\n" } }],
      },
      checks: [
        {
          name: "stdout contract",
          run: "cat README.md",
          expect_exact: "ready",
          expect_regex: "^ready$",
          not_regex: "missing",
          flags: "i",
          exit_code: 0,
        },
      ],
      output_checks: [
        {
          name: "final response contract",
          valid_json: true,
          json_path: "/status",
          expect_json: "ready",
          expect_exact: '{"status":"ready"}',
          expect_regex: "ready",
          not_regex: "secret",
        },
      ],
    }),
  );
  const resolved = await command<ExtensionReply>(
    [process.execPath, extension],
    request("resolve", {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: ["stdout-case"] },
      configuration: {},
    }),
  );
  expect(resolved.value.result.cases[0]!.checks[0]).toMatchObject({
    grader: "sevro.shell",
    configuration: {
      run: "cat README.md",
      expectExact: "ready",
      expectRegex: "^ready$",
      notRegex: "missing",
      flags: "i",
      expectedExitCode: 0,
    },
  });
  expect(resolved.value.result.cases[0]!.checks[1]).toMatchObject({
    id: "darrow.output.1",
    grader: "sevro.output",
    configuration: {
      validJson: true,
      jsonPath: "/status",
      expectJson: "ready",
      expectExact: '{"status":"ready"}',
      expectRegex: "ready",
      notRegex: "secret",
    },
  });

  const checkout = process.env.SEVRO_CHECKOUT;
  if (!checkout || !checkout.startsWith("/"))
    throw new Error("SEVRO_CHECKOUT must name an absolute local checkout");
  const commandFile = join(root, "extension-command.json");
  const adapter = join(root, "candidate.ts");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  const invoke = async (status: string) => {
    await writeFile(
      adapter,
      `export default {
  id: "darrow.host.output-synthetic", model: "synthetic-v1", effort: "none",
  async run() { return { finalMessage: JSON.stringify({ status: ${JSON.stringify(status)} }), complete: true }; },
};
`,
    );
    return command<CliReply>([
      process.execPath,
      join(checkout, "src/cli.ts"),
      "run",
      "--json",
      "--extension-command-file",
      commandFile,
      "--extension-source-file",
      extension,
      "--extension-source-file",
      join(projectRoot, "package.json"),
      "--extension-source-file",
      join(projectRoot, "bun.lock"),
      "--case-id",
      "stdout-case",
      "--adapter-module",
      adapter,
      "--shell-isolation",
      "--project-root",
      root,
      "--results-root",
      join(root, "results"),
      "--runner-build-digest",
      digest,
      "--project-digest",
      digest,
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
    ]);
  };
  const passed = await invoke("ready");
  expect(passed.code, passed.stderr).toBe(0);
  expect(
    passed.value.cases[0]!.trials[0]!.checks.map((check) => check.status),
  ).toEqual(["passed", "passed"]);
  const failed = await invoke("wait");
  expect(failed.code, failed.stderr).toBe(1);
  expect(
    failed.value.cases[0]!.trials[0]!.checks.map((check) => check.status),
  ).toEqual(["passed", "failed"]);
});

test("Sevro runs an existing Darrow case through the extension protocol", async () => {
  const checkout = process.env.SEVRO_CHECKOUT;
  if (!checkout || !checkout.startsWith("/"))
    throw new Error("SEVRO_CHECKOUT must name an absolute local checkout");
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-extension-"));
  roots.push(root);
  const commandFile = join(root, "extension-command.json");
  const adapter = join(root, "candidate.ts");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  await writeFile(
    adapter,
    `import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export default {
  id: "darrow.host.synthetic", model: "synthetic-v1", effort: "none",
  async run({ workspace }) {
    await writeFile(join(workspace, "NOTES.md"), "# Notes\\n\\n- alpha\\n- maple\\n- zebra\\n");
    return { finalMessage: "Sorted the notes.", complete: true };
  },
};
`,
  );
  const result = await command<CliReply>([
    process.execPath,
    join(checkout, "src/cli.ts"),
    "run",
    "--json",
    "--extension-command-file",
    commandFile,
    "--extension-source-file",
    extension,
    "--extension-source-file",
    join(projectRoot, "package.json"),
    "--extension-source-file",
    join(projectRoot, "bun.lock"),
    "--case-id",
    "orchestration-routing-localized-mechanical",
    "--adapter-module",
    adapter,
    "--shell-isolation",
    "--project-root",
    projectRoot,
    "--results-root",
    join(root, "results"),
    "--runner-build-digest",
    digest,
    "--project-digest",
    digest,
    "--condition",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
  ]);
  expect(result.code, result.stderr).toBe(0);
  expect(result.value.task.verdict).toBe("passed");
  expect(result.value.cases[0]!.trials[0]!.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "darrow.shell.1", status: "passed" }),
      expect.objectContaining({ id: "darrow.shell.2", status: "passed" }),
    ]),
  );
  const evidence = JSON.parse(
    await readFile(result.value.evidencePath, "utf8"),
  );
  expect(evidence.extension).toMatchObject({
    id: "darrow.evals",
    protocol: "sevro.extension.v1",
  });
  expect(evidence.trials[0].condition.requested).toBe("passive");
});
