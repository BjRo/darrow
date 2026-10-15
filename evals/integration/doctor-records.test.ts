import { afterAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { captureTestCommand } from "../test-command";
import {
  sevroCommand,
  sevroEnvironment,
} from "../sevro-extension/sevro-command";

let preparedRoot: string | undefined;
afterAll(async () => {
  if (preparedRoot) await rm(preparedRoot, { recursive: true, force: true });
});

test("Doctor source records accept valid isolated reports and reject wrong sources", async () => {
  const source = resolve(
    import.meta.dir,
    "../../plugins/orchestration/darrow-adaptive-goal/skills/doctor-adaptive-goal/evals/direct-codex.yaml",
  );
  const canonical = parse(await readFile(source, "utf8")) as {
    output_checks: unknown[];
  };
  const config = "/tmp/doctor-eval/codex-home/config.toml";
  const records = [
    "configuration_sources_checked: " + config,
    "configuration_sources_used: " + config,
    "checkout_config_used: no",
  ] as const;
  const concurrency =
    "concurrency_control: agents.max_concurrent_threads_per_session";
  const nesting = "nesting_control: agents.max_depth (V1 only; ignored by V2)";
  const report =
    [
      "Configured concurrency is 5. The backend and current free capacity are unknown.",
      ...records,
      concurrency,
      nesting,
      "Configuration alone does not establish available capacity.",
    ].join("\n") + "\n";
  const controls: [string, string, string[]][] = [
    ["valid report", report, []],
    [
      "reordered records",
      [nesting, records[1], records[2], concurrency, records[0]].join("\n") +
        "\n",
      [],
    ],
    [
      "Windows absolute source",
      report.replaceAll(config, "C:\\eval\\codex-home\\config.toml"),
      [],
    ],
    [
      "missing checked record",
      report.replace(records[0] + "\n", ""),
      ["darrow.output.1"],
    ],
    [
      "checkout source",
      report.replaceAll(config, "/tmp/checkout/.codex/config.toml"),
      ["darrow.output.1"],
    ],
    [
      "different used source",
      report.replace(
        records[1],
        "configuration_sources_used: /tmp/other/codex-home/config.toml",
      ),
      ["darrow.output.1"],
    ],
    [
      "relative source",
      report.replaceAll(config, "codex-home/config.toml"),
      ["darrow.output.1"],
    ],
    [
      "checkout used",
      report.replace(records[2], "checkout_config_used: yes"),
      ["darrow.output.2"],
    ],
    [
      "checkout status missing",
      report.replace(records[2] + "\n", ""),
      ["darrow.output.2"],
    ],
    [
      "concurrency control missing",
      report.replace(concurrency, ""),
      ["darrow.output.3"],
    ],
    [
      "nesting substituted for concurrency",
      report.replace(concurrency, "concurrency_control: agents.max_depth"),
      ["darrow.output.3"],
    ],
    [
      "V1-only applicability omitted",
      report.replace(nesting, "nesting_control: agents.max_depth"),
      ["darrow.output.4"],
    ],
  ];
  const root = await mkdtemp(join(tmpdir(), "darrow-doctor-records-"));
  preparedRoot = root;
  const cases = join(root, "evals/experiments/doctor-records/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "probe.yaml"),
    JSON.stringify({
      id: "doctor-records-control",
      invariant: "ADL-D1",
      prompt: "Return the supplied diagnostic control.",
      fixture: {
        commits: [
          { message: "Initialize", files: { "README.md": "Oracle control\n" } },
        ],
      },
      checks: [],
      output_checks: canonical.output_checks,
    }),
  );
  const output = join(root, "response.txt");
  const adapter = join(root, "candidate.ts");
  await writeFile(
    adapter,
    `import { readFile } from "node:fs/promises";
export default {
  id: "fixture.doctor-records", model: "retained-output-control", effort: "none",
  async run() { return { finalMessage: await readFile(${JSON.stringify(output)}, "utf8"), complete: true }; }
};`,
  );
  const extension = resolve(import.meta.dir, "../sevro-extension/index.ts");
  const commandFile = join(root, "extension-command.json");
  await writeFile(commandFile, JSON.stringify([process.execPath, extension]));
  const route = sevroCommand();
  const env = sevroEnvironment();
  delete env.SEVRO_CHECKOUT;
  delete env.SEVRO_PACKAGE_BIN;
  for (const [index, [name, response, failures]] of controls.entries()) {
    await writeFile(output, response);
    const reply = await captureTestCommand(
      [
        ...route.launch,
        "run",
        "--json",
        ...route.extraArgs,
        "--extension-command-file",
        commandFile,
        "--extension-source-file",
        extension,
        "--project-root",
        root,
        "--case-id",
        "doctor-records-control",
        "--results-root",
        join(root, "results-" + index),
        "--adapter-module",
        adapter,
        "--condition",
        "passive",
        "--trials",
        "1",
        "--jobs",
        "1",
        "--threshold",
        "1",
      ],
      undefined,
      { env },
    );
    expect(reply.exitCode, name + ": " + reply.stderr + reply.stdout).toBe(
      failures.length ? 1 : 0,
    );
    const result = JSON.parse(reply.stdout) as {
      task: { verdict: string };
      cases: { trials: { checks: { id: string; status: string }[] }[] }[];
    };
    expect(result.task.verdict, name).toBe(
      failures.length ? "failed" : "passed",
    );
    const checks = result.cases[0]!.trials[0]!.checks;
    expect(checks.map((check) => check.id).sort(), name).toEqual([
      "darrow.output.1",
      "darrow.output.2",
      "darrow.output.3",
      "darrow.output.4",
    ]);
    expect(
      checks
        .filter((check) => check.status !== "passed")
        .map((check) => check.id)
        .sort(),
      name,
    ).toEqual(failures);
  }
}, 60_000);
