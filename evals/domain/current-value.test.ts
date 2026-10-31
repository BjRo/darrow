import { afterAll, expect, test } from "bun:test";
import {
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  historicalTasks,
  valueCase,
  prepareValue,
  type ValueCase,
} from "../experiments/orchestration/prepare-value";
import { valueArguments } from "../experiments/orchestration/run-value";
import { planSuite } from "../sevro-extension/suite";
import { resolveCase } from "../sevro-extension/index";
import { fixtureExtensionRequest } from "./fixture-command";
import { pathToFileURL } from "node:url";

const roots: string[] = [];
const servers: ReturnType<typeof Bun.spawn>[] = [];
afterAll(async () => {
  for (const server of servers) server.kill();
  for (const root of roots) await rm(root, { recursive: true, force: true });
});
const experiment = resolve(import.meta.dir, "../experiments/orchestration");

test("frozen suites select exactly one correct-route cell and fit installed preparation limits", async () => {
  const storage = await mkdtemp(join(tmpdir(), "darrow-current-value-"));
  roots.push(storage);
  const snapshot = join(storage, "snapshot");
  const prepared = await prepareValue(snapshot, { warm: false });
  for (const track of ["implementation", "delivery"] as const) {
    const owner = track === "delivery" ? "ticket-to-pr" : "adaptive-goal";
    const profile = await Bun.file(
      join(prepared.project, `runtime-candidate-${track}.json`),
    ).json();
    const declaration = parseYaml(
      await readFile(
        join(
          prepared.project,
          "evals/experiments/current-value/cases",
          `${track}-ajv-instance-path.yaml`,
        ),
        "utf8",
      ),
    ) as ValueCase;
    const providers = new Set(
      declaration.additional_skills?.map((path) => path.split("/")[2]),
    );
    for (const plugin of profile.hooks.plugins)
      expect(providers.has(plugin)).toBeTrue();
    for (const mode of ["vanilla", owner]) {
      const args = await valueArguments([
        "--snapshot",
        snapshot,
        "--output",
        join(storage, `${track}-${mode}`),
        "--track",
        track,
        "--mode",
        mode,
        "--case",
        "ajv-instance-path",
        "--dry",
      ]);
      const plan = await planSuite(args);
      expect(plan.cells).toHaveLength(1);
      expect(plan.cells[0]).toMatchObject({
        caseId: `current-${track}-oss-ajv-instance-path`,
        mode,
        condition: "passive",
        requestedRoute: { model: "gpt-6.1-sol", effort: "medium" },
      });
      expect(
        await Bun.file(
          join(storage, `${track}-${mode}`, "suite-run.json"),
        ).exists(),
      ).toBeFalse();
    }
    const configuration = {
      skillDir: `plugins/${track === "delivery" ? "task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr" : "orchestration/darrow-adaptive-goal/skills/adaptive-goal"}`,
      mountPluginSkills: true,
    };
    const resolved = await resolveCase({
      projectRoot: pathToFileURL(prepared.project).href,
      selectors: { caseIds: [`current-${track}-oss-ajv-instance-path`] },
      configuration,
    });
    const mounted = await fixtureExtensionRequest<{
      artifacts: unknown[];
      fixtureSetup: { environment: Record<string, string> };
    }>("prepare", {
      case: resolved.cases[0],
      configuration,
      host: {
        id: "sevro.host.codex",
        capabilities: [
          "sevro.codex.plugin-marketplace",
          "sevro.codex.explicit-invocation",
          "sevro.codex.native-calls",
        ],
      },
    });
    expect(mounted.artifacts.length).toBeLessThan(256);
    expect(
      Buffer.byteLength(JSON.stringify(mounted.fixtureSetup.environment)),
    ).toBeLessThanOrEqual(16 * 1024);
  }
}, 30_000);

test("current benchmark preserves the four historical engineering contracts and checks", async () => {
  for (const task of historicalTasks) {
    const original = parseYaml(
      await readFile(join(experiment, `cases/oss-${task}.yaml`), "utf8"),
    ) as ValueCase;
    const implementation = valueCase(original, "implementation");
    expect(implementation.prompt).toBe(original.prompt);
    expect(implementation.checks).toEqual(original.checks);
    expect(implementation.fixture.files).toEqual(original.fixture.files);
    expect(implementation.fixture.source).toBe(original.fixture.source);
    const delivery = valueCase(original, "delivery");
    expect(delivery.fixture.source).toBe(original.fixture.source);
    expect(delivery.checks.slice(0, original.checks.length)).toEqual(
      original.checks,
    );
    expect(delivery.fixture.ticket).toBeUndefined();
    expect(delivery.fixture.files["AGENTS.md"]).not.toContain(
      "Do not commit or publish",
    );
    expect(original.id).toBe(`orchestration-oss-${task}`);
  }
});

test.each(["bash", "/bin/bash"])(
  "local delivery fixture binds actual publication and CI with %s",
  async (shell) => {
    const root = await mkdtemp(join(tmpdir(), "darrow-value-forge-"));
    roots.push(root);
    let ciURL = "";
    function run(args: string[], expected = 0) {
      const result = Bun.spawnSync(args, {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          PATH: join(root, ".git/fixture-bin") + delimiter + process.env.PATH,
          DARROW_BENCHMARK_CI_URL: ciURL,
        },
      });
      expect(
        result.exitCode,
        result.stdout.toString() + result.stderr.toString(),
      ).toBe(expected);
      return result.stdout.toString();
    }
    const git = (...args: string[]) => run(["git", ...args]).trim();
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Fixture");
    git("config", "user.email", "fixture@example.invalid");
    await writeFile(join(root, "feature.txt"), "old\n");
    git("add", ".");
    git("commit", "-qm", "chore: initialize fixture");
    git("checkout", "--detach");
    await writeFile(
      join(root, ".git/private-host-sentinel"),
      "must remain outside the CI check sandbox\n",
    );
    const assets = await mkdtemp(join(tmpdir(), "darrow-value-assets-"));
    roots.push(assets);
    const dependencies = join(root, "node_modules");
    await mkdir(join(dependencies, ".bin"), { recursive: true });
    await mkdir(join(dependencies, "fixture-ci-probe/bin"), {
      recursive: true,
    });
    await writeFile(
      join(dependencies, "fixture-ci-probe/value.js"),
      "module.exports = true;\n",
    );
    await writeFile(
      join(dependencies, "fixture-ci-probe/bin/run.js"),
      "#!/usr/bin/env node\nrequire('../value');\n",
      { mode: 0o755 },
    );
    await symlink(
      "../fixture-ci-probe/bin/run.js",
      join(dependencies, ".bin/fixture-ci-probe"),
    );
    await appendFile(join(root, ".git/info/exclude"), "\nnode_modules\n");
    await copyFile(
      join(experiment, "fixtures/value-forge.ts"),
      join(assets, "value-forge.ts"),
    );
    await writeFile(
      join(assets, "task.json"),
      JSON.stringify({
        title: "Update feature",
        body: "Feature must be new",
        ci:
          './node_modules/.bin/fixture-ci-probe && test "$(cat feature.txt)" = new && test ! -r "' +
          root +
          '/.git/private-host-sentinel"',
        base: "main",
        nonce: "fixture-bound-ci-nonce",
      }),
    );
    const ready = join(assets, "server-ready");
    servers.push(
      Bun.spawn(
        [
          process.execPath,
          join(experiment, "fixtures/value-ci.ts"),
          join(assets, "task.json"),
          join(assets, "ci-server.jsonl"),
          ready,
        ],
        { stdout: "ignore", stderr: "inherit" },
      ),
    );
    for (
      let attempt = 0;
      attempt < 100 && !(await Bun.file(ready).exists());
      attempt++
    )
      await new Promise((resolve) => setTimeout(resolve, 10));
    ciURL = (await readFile(ready, "utf8")).trim();
    run([shell, join(experiment, "fixtures/setup-value.sh"), assets]);
    const backend = (plugin: string, command: string, ...args: string[]) =>
      run([
        "uv",
        "run",
        "--quiet",
        "--no-project",
        resolve(
          experiment,
          `../../../plugins/capability/${plugin}/backend/scripts/run_locked.py`,
        ),
        command,
        ...args,
      ]);
    expect(backend("darrow-tickets", "darrow-ticket", "get", "1")).toContain(
      "Feature must be new",
    );
    const forge = (args: string[], code = 0) =>
      run([process.execPath, ".git/fixture-bin/value-forge.ts", ...args], code);
    forge(["check"], 1);
    git("switch", "-qc", "fix/GH-1-feature");
    await writeFile(join(root, "feature.txt"), "new\n");
    git("commit", "-qam", "fix: update feature");
    for (const flag of ["--help", "-h"]) {
      expect(forge(["gh", "pr", "create", flag])).not.toContain("https://");
      forge(["gh", "pr", "checks", flag]);
      expect(
        JSON.parse(
          await readFile(join(root, ".fixture-state/forge.json"), "utf8"),
        ).pr,
      ).toBeNull();
      expect(
        await Bun.file(join(assets, "ci-server.jsonl")).exists(),
      ).toBeFalse();
    }
    forge(
      [
        "gh",
        "pr",
        "create",
        "--head",
        "fix/GH-1-feature",
        "--title",
        "fix: update feature",
      ],
      1,
    );
    expect(
      backend(
        "darrow-git",
        "darrow-create-pr",
        "create",
        "--title",
        "fix: update feature",
        "-b",
        "Update the feature for issue GH-1. Change its public value from old to new.",
      ),
    ).toContain("publication: verified");
    forge(["check"], 1); // Publication without a passing CI observation cannot complete.
    await writeFile(
      join(root, ".fixture-state/ci.jsonl"),
      JSON.stringify({ head: git("rev-parse", "HEAD"), exitCode: 0 }) + "\n",
    );
    forge(["check"], 1); // Candidate-written success cannot manufacture host CI.
    forge(["ci", git("rev-parse", "HEAD")]);
    forge(["check"]);
    await writeFile(join(root, "feature.txt"), "broken\n");
    forge(["ci", git("rev-parse", "HEAD")], 1); // Dirty content cannot borrow an earlier green result.
    git("commit", "-qam", "fix: introduce a failure");
    forge(["check"], 1); // A stale remote and earlier CI receipt cannot complete.
    git("push", "-q", "origin", "HEAD");
    const marker = join(root, ".git/fixture-bin/task.json");
    const modified = JSON.parse(await readFile(marker, "utf8"));
    modified.ci = "true";
    await writeFile(marker, JSON.stringify(modified));
    forge(["ci", git("rev-parse", "HEAD")], 1);
    forge(["check"], 1);
    forge(["gh", "pr", "merge", "1"], 1);
    expect(
      await Bun.file(join(root, ".fixture-state/forbidden-effects")).exists(),
    ).toBeTrue();
  },
  30_000,
);
