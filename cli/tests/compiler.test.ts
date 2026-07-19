import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  compile,
  createLock,
  orderWorkflowSteps,
  snapshot,
  validateExecutionProtocolSupport,
  validateWorkflowGraph,
  verifyResolvedPlan,
  verifyRunSnapshot,
} from "../src/compiler";
import { replaceJson, writeJson } from "../src/io";
import { SOURCE_PLUGIN_ROOT } from "../src/paths";
import { initRepository } from "../src/repository";
import { validateSchema } from "../src/schema";
import type { WorkflowDefinition } from "../src/types";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map(async (path) => {
      await chmod(
        resolve(path, ".darrow", "runs", "test-run", "snapshot"),
        0o755,
      ).catch(() => {});
      await Bun.spawn(["chmod", "-R", "u+w", path]).exited;
      await rm(path, { recursive: true, force: true });
    }),
  );
});

function git(cwd: string, args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function repo(): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), "darrow-compiler-"));
  temps.push(path);
  git(path, ["init", "-q"]);
  git(path, ["config", "user.name", "Test"]);
  git(path, ["config", "user.email", "test@example.com"]);
  await writeFile(resolve(path, "README.md"), "fixture\n");
  git(path, ["add", "README.md"]);
  git(path, ["commit", "-qm", "fixture"]);
  await initRepository(path);
  return path;
}

describe("M1 compiler", () => {
  test("preflights portable delivery evidence execution", () => {
    expect(() =>
      validateExecutionProtocolSupport(
        "structured",
        "claude",
        "linux",
        undefined,
      ),
    ).not.toThrow();
    expect(() =>
      validateExecutionProtocolSupport(
        "delivery-tdd",
        "claude",
        "darwin",
        undefined,
      ),
    ).not.toThrow();
    expect(() =>
      validateExecutionProtocolSupport(
        "delivery-tdd",
        "codex",
        "linux",
        "workspace-write",
      ),
    ).not.toThrow();
    expect(() =>
      validateExecutionProtocolSupport(
        "delivery-tdd",
        "claude",
        "linux",
        undefined,
      ),
    ).toThrow("without a locked Codex evidence permission profile");
    expect(() =>
      validateExecutionProtocolSupport(
        "delivery-tdd",
        "codex",
        "linux",
        undefined,
      ),
    ).toThrow("without a locked Codex evidence permission profile");
  });

  test("resolves command and hard capability into a valid immutable plan and lock", async () => {
    const root = await repo();
    const previous = process.env.DARROW_PLUGIN_ROOTS;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.DARROW_PLUGIN_ROOTS = SOURCE_PLUGIN_ROOT;
    process.env.CODEX_HOME = resolve(root, "codex-home");
    const compilation = await compile(root, "implement-change", {
      change: "return hello",
    }).finally(() => {
      restoreEnvironment("DARROW_PLUGIN_ROOTS", previous);
      restoreEnvironment("CODEX_HOME", previousCodexHome);
    });
    expect(compilation.plan.steps[0]?.commandId).toBe(
      "darrow-delivery:implement",
    );
    expect(compilation.plan.steps[0]?.dependsOn).toEqual([]);
    expect(compilation.plan.steps[0]?.cancellation).toBe("wait_for_boundary");
    expect(compilation.plan.steps[0]?.role).toBe("default");
    expect(compilation.plan.steps[0]?.route).toMatchObject({
      profileId: "codex",
      harness: "codex",
      provider: "openai",
      adapter: { id: "codex-cli", version: "0.1.0" },
      selectionSource: "fixed_plan",
    });
    expect(compilation.plan.steps[0]?.route.routeId).toMatch(/^sha256:/);
    const mismatchedRoute = structuredClone(compilation.plan);
    mismatchedRoute.steps[0]!.route.model = "silently-substituted-model";
    await expect(verifyResolvedPlan(mismatchedRoute)).rejects.toThrow(
      "route does not match role",
    );
    expect(compilation.plan.capabilities[0]?.providerId).toBe(
      "darrow-git:create-branch",
    );
    expect(compilation.plan.capabilities[0]?.version).toBe("1.0.0");
    const runDir = resolve(root, ".darrow", "runs", "test-run");
    await mkdir(runDir, { recursive: true });
    const lock = await createLock(compilation, "test-run");
    await writeJson(resolve(runDir, "lock.json"), lock);
    const snapshotDir = await snapshot(compilation, runDir);
    expect(
      await readdir(
        resolve(
          snapshotDir,
          "commands",
          "codex",
          "darrow-delivery",
          "implement",
        ),
      ),
    ).toContain("SKILL.md");
    await validateSchema("lock.schema.json", lock, "lock");
    await expect(
      verifyRunSnapshot(runDir, compilation.plan),
    ).resolves.toBeUndefined();
    const tamperedLock = structuredClone(lock) as Record<string, any>;
    tamperedLock.routes[0].model = "silently-substituted-model";
    await replaceJson(resolve(runDir, "lock.json"), tamperedLock);
    await expect(verifyRunSnapshot(runDir, compilation.plan)).rejects.toThrow(
      "lock routing does not match",
    );
    await replaceJson(resolve(runDir, "lock.json"), lock);
    await chmod(resolve(snapshotDir, "workflow.yaml"), 0o644);
    await writeFile(resolve(snapshotDir, "workflow.yaml"), "corrupt\n");
    await expect(verifyRunSnapshot(runDir, compilation.plan)).rejects.toThrow(
      "workflow digest mismatch",
    );
  });

  test("an incompatible harness-enabled provider fails before worktree creation and does not fall through", async () => {
    const root = await repo();
    const plugin = resolve(root, "bad-plugin");
    await mkdir(resolve(plugin, ".codex-plugin"), { recursive: true });
    await mkdir(resolve(plugin, ".claude-plugin"), { recursive: true });
    await mkdir(resolve(plugin, "codex-skills", "create-branch"), {
      recursive: true,
    });
    const manifest = { name: "darrow-git", version: "9.0.0" };
    await writeFile(
      resolve(plugin, ".codex-plugin", "plugin.json"),
      JSON.stringify({ ...manifest, skills: "./codex-skills/" }),
    );
    await writeFile(
      resolve(plugin, ".claude-plugin", "plugin.json"),
      JSON.stringify({ ...manifest, skills: "./claude-skills/" }),
    );
    await writeFile(
      resolve(plugin, "codex-skills", "create-branch", "SKILL.md"),
      "# incompatible\n",
    );
    await writeFile(
      resolve(plugin, "codex-skills", "create-branch", "darrow.json"),
      JSON.stringify({
        schemaVersion: 1,
        kind: "capability",
        provides: [{ contract: "git.branch.create", version: "0.5.0" }],
      }),
    );
    const previous = process.env.DARROW_PLUGIN_ROOTS;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.DARROW_PLUGIN_ROOTS = plugin;
    process.env.CODEX_HOME = resolve(root, "codex-home");
    try {
      await expect(
        compile(root, "implement-change", { change: "return hello" }),
      ).rejects.toThrow("does not satisfy ^1.0.0");
    } finally {
      restoreEnvironment("DARROW_PLUGIN_ROOTS", previous);
      restoreEnvironment("CODEX_HOME", previousCodexHome);
    }
    expect(await readdir(resolve(root, ".darrow", "worktrees"))).toEqual([]);
  });

  test("fails preflight when the selected native manifest projection is missing", async () => {
    const root = await repo();
    const plugin = resolve(root, "missing-projection-plugin");
    await mkdir(resolve(plugin, ".codex-plugin"), { recursive: true });
    await mkdir(resolve(plugin, ".claude-plugin"), { recursive: true });
    const manifest = { name: "missing-projection", version: "1.0.0" };
    await writeFile(
      resolve(plugin, ".codex-plugin", "plugin.json"),
      JSON.stringify({ ...manifest, skills: "./codex-skills/" }),
    );
    await writeFile(
      resolve(plugin, ".claude-plugin", "plugin.json"),
      JSON.stringify({ ...manifest, skills: "./claude-skills/" }),
    );
    const previous = process.env.DARROW_PLUGIN_ROOTS;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.DARROW_PLUGIN_ROOTS = plugin;
    process.env.CODEX_HOME = resolve(root, "codex-home");
    try {
      await expect(
        compile(root, "implement-change", { change: "return hello" }),
      ).rejects.toThrow("cannot resolve codex skills projection");
    } finally {
      restoreEnvironment("DARROW_PLUGIN_ROOTS", previous);
      restoreEnvironment("CODEX_HOME", previousCodexHome);
    }
    expect(await readdir(resolve(root, ".darrow", "worktrees"))).toEqual([]);
  });

  test("resolves a declared ticket publication into the immutable plan", async () => {
    const root = await repo();
    await writeFile(
      resolve(root, ".darrow", "workflows", "implement-change.yaml"),
      `schemaVersion: 0.1.0
id: implement-change
version: 0.1.0
engine: ^0.1.0
inputs:
  change: { type: string, required: true }
  ticket-id: { type: string, required: true }
requirements:
  capabilities:
    - { contract: git.branch.create, version: ^1.0.0 }
profile: codex
loops: []
steps:
  - id: implement
    dependsOn: []
    command: { id: darrow-delivery:implement, version: ^0.1.0 }
    with: { change: "\${inputs.change}" }
    publish:
      ticket:
        backend: github
        project: BjRo/darrow
        nativeId: "\${inputs.ticket-id}"
        url: "https://github.com/BjRo/darrow/issues/4"
      artifactTypes: [darrow.tdd-evidence]
`,
    );
    const previous = process.env.DARROW_PLUGIN_ROOTS;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.DARROW_PLUGIN_ROOTS = SOURCE_PLUGIN_ROOT;
    process.env.CODEX_HOME = resolve(root, "codex-home");
    try {
      const compilation = await compile(root, "implement-change", {
        change: "return hello",
        "ticket-id": "4",
      });
      expect(compilation.plan.steps[0]?.publish).toEqual({
        ticket: {
          backend: "github",
          project: "BjRo/darrow",
          nativeId: "4",
          url: "https://github.com/BjRo/darrow/issues/4",
        },
        artifactTypes: ["darrow.tdd-evidence"],
      });
    } finally {
      restoreEnvironment("DARROW_PLUGIN_ROOTS", previous);
      restoreEnvironment("CODEX_HOME", previousCodexHome);
    }
  });

  test("resolves a Claude Code profile and locks its native adapter and enabled capability", async () => {
    const root = await repo();
    const claudeHome = resolve(root, "claude-home");
    const cachedPlugin = resolve(
      claudeHome,
      "plugins",
      "cache",
      "darrow",
      "darrow-git",
      "0.1.2",
    );
    await mkdir(resolve(claudeHome), { recursive: true });
    await cp(resolve(SOURCE_PLUGIN_ROOT, "darrow-git"), cachedPlugin, {
      recursive: true,
    });
    await writeFile(resolve(claudeHome, "settings.json"), JSON.stringify({}));
    await mkdir(resolve(root, ".claude"), { recursive: true });
    await writeFile(
      resolve(root, ".claude", "settings.json"),
      JSON.stringify({ enabledPlugins: { "darrow-git@darrow": true } }),
    );
    const workflowPath = resolve(
      root,
      ".darrow",
      "workflows",
      "implement-change.yaml",
    );
    await writeFile(
      workflowPath,
      (await Bun.file(workflowPath).text()).replace(
        "profile: codex",
        "profile: claude",
      ),
    );
    const previousRoots = process.env.DARROW_PLUGIN_ROOTS;
    const previousClaudeHome = process.env.CLAUDE_CONFIG_DIR;
    process.env.DARROW_PLUGIN_ROOTS = "";
    process.env.CLAUDE_CONFIG_DIR = claudeHome;
    try {
      const compilation = await compile(root, "implement-change", {
        change: "return hello",
      });
      expect(compilation.plan.roles[0]?.profile).toMatchObject({
        harness: "claude",
        provider: "anthropic",
        model: "claude-sonnet-4-6",
      });
      expect(compilation.plan.steps[0]?.route).toMatchObject({
        profileId: "claude",
        harness: "claude",
        adapter: { id: "claude-code" },
      });
      expect(compilation.plan.capabilities[0]?.source).toContain(cachedPlugin);
      const lock = (await createLock(compilation, "claude-run")) as Record<
        string,
        any
      >;
      expect(lock.adapters[0]).toMatchObject({
        id: "claude-code",
        harness: "claude",
        routeIds: [compilation.plan.steps[0]!.route.routeId],
      });
      expect(lock.adapters[0].nativePermissions.configurationSources).toEqual([
        {
          path: resolve(claudeHome, "settings.json"),
          scope: "user",
          present: true,
          digest: expect.stringMatching(/^sha256:/),
        },
        {
          path: resolve(root, ".claude", "settings.json"),
          scope: "project",
          present: true,
          digest: expect.stringMatching(/^sha256:/),
        },
        {
          path: resolve(root, ".claude", "settings.local.json"),
          scope: "local",
          present: false,
          digest: expect.stringMatching(/^sha256:/),
        },
      ]);
      const configurationEnvironment =
        lock.adapters[0].nativePermissions.configurationEnvironment;
      expect(configurationEnvironment.CLAUDE_CONFIG_DIR).toBe(claudeHome);
      expect(typeof configurationEnvironment.PATH).toBe("string");
      await validateSchema("lock.schema.json", lock, "Claude lock");
    } finally {
      restoreEnvironment("DARROW_PLUGIN_ROOTS", previousRoots);
      restoreEnvironment("CLAUDE_CONFIG_DIR", previousClaudeHome);
    }
  });
});

describe("M2b role-bound routing", () => {
  test("locks dependent command steps to independent Codex and Claude routes", async () => {
    const root = await repo();
    await mkdir(resolve(root, ".darrow", "profiles"), { recursive: true });
    await writeFile(
      resolve(root, ".darrow", "profiles", "claude-review.yaml"),
      `schemaVersion: 0.1.0
id: claude-review
harness: claude
provider: anthropic
model: claude-sonnet-4-6
reasoningEffort: medium
permissions:
  inherit: true
`,
    );
    await writeFile(
      resolve(root, ".darrow", "workflows", "mixed-review.yaml"),
      `schemaVersion: 0.1.0
id: mixed-review
version: 0.1.0
engine: ^0.1.0
inputs:
  change: { type: string, required: true }
requirements:
  capabilities:
    - { contract: git.branch.create, version: ^1.0.0 }
roles:
  implement: { profile: codex }
  review: { profile: claude-review }
loops: []
steps:
  - id: implement
    role: implement
    dependsOn: []
    command: { id: darrow-delivery:implement, version: ^0.1.0 }
    with: { change: "\${inputs.change}" }
  - id: review
    role: review
    dependsOn: [implement]
    command: { id: darrow-delivery:implement, version: ^0.1.0 }
    with: { change: review current implementation }
`,
    );
    const previousRoots = process.env.DARROW_PLUGIN_ROOTS;
    const previousCodexHome = process.env.CODEX_HOME;
    const previousClaudeHome = process.env.CLAUDE_CONFIG_DIR;
    process.env.DARROW_PLUGIN_ROOTS = SOURCE_PLUGIN_ROOT;
    process.env.CODEX_HOME = resolve(root, "codex-home");
    process.env.CLAUDE_CONFIG_DIR = resolve(root, "claude-home");
    try {
      const compilation = await compile(root, "mixed-review", {
        change: "return hello",
      });
      expect(
        compilation.plan.roles.map(({ id, profile }) => ({
          id,
          harness: profile.harness,
        })),
      ).toEqual([
        { id: "implement", harness: "codex" },
        { id: "review", harness: "claude" },
      ]);
      expect(
        compilation.plan.steps.map(({ id, role, route }) => ({
          id,
          role,
          harness: route.harness,
          model: route.model,
          effort: route.reasoningEffort,
        })),
      ).toEqual([
        {
          id: "implement",
          role: "implement",
          harness: "codex",
          model: "gpt-5.6-sol",
          effort: "high",
        },
        {
          id: "review",
          role: "review",
          harness: "claude",
          model: "claude-sonnet-4-6",
          effort: "medium",
        },
      ]);
      expect(
        compilation.plan.capabilities.map((capability) => capability.harness),
      ).toEqual(["codex", "claude"]);
      expect(compilation.commands.map(({ harness }) => harness)).toEqual([
        "codex",
        "claude",
      ]);
      expect(compilation.commands[0]?.candidate.skillDir).toContain(
        "/codex-skills/implement",
      );
      expect(compilation.commands[1]?.candidate.skillDir).toContain(
        "/claude-skills/implement",
      );
      expect(compilation.plan.steps[0]?.source).toContain(
        "/codex-skills/implement",
      );
      expect(compilation.plan.steps[1]?.source).toContain(
        "/claude-skills/implement",
      );

      const runDir = resolve(root, ".darrow", "runs", "mixed-run");
      await mkdir(runDir, { recursive: true });
      const lock = (await createLock(compilation, "mixed-run")) as Record<
        string,
        any
      >;
      expect(lock.routes).toHaveLength(2);
      expect(
        lock.adapters.map((adapter: { id: string }) => adapter.id),
      ).toEqual(["codex-cli", "claude-code"]);
      expect(lock.adapters[0].routeIds).toEqual([
        compilation.plan.steps[0]!.route.routeId,
      ]);
      expect(lock.adapters[1].routeIds).toEqual([
        compilation.plan.steps[1]!.route.routeId,
      ]);
      await writeJson(resolve(runDir, "lock.json"), lock);
      const snapshotDir = await snapshot(compilation, runDir);
      for (const harness of ["codex", "claude"])
        expect(
          await readdir(
            resolve(
              snapshotDir,
              "commands",
              harness,
              "darrow-delivery",
              "implement",
            ),
          ),
        ).toContain("SKILL.md");
      await expect(
        verifyRunSnapshot(runDir, compilation.plan),
      ).resolves.toBeUndefined();
    } finally {
      restoreEnvironment("DARROW_PLUGIN_ROOTS", previousRoots);
      restoreEnvironment("CODEX_HOME", previousCodexHome);
      restoreEnvironment("CLAUDE_CONFIG_DIR", previousClaudeHome);
    }
  });

  test("deduplicates profile and adapter locks when roles share one profile", async () => {
    const root = await repo();
    const workflowPath = resolve(
      root,
      ".darrow",
      "workflows",
      "implement-change.yaml",
    );
    const source = await Bun.file(workflowPath).text();
    await writeFile(
      workflowPath,
      source
        .replace(
          "profile: codex",
          "roles:\n  implement: { profile: codex }\n  review: { profile: codex }",
        )
        .replace(
          "  - id: implement\n",
          "  - id: implement\n    role: implement\n",
        ),
    );
    const previousRoots = process.env.DARROW_PLUGIN_ROOTS;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.DARROW_PLUGIN_ROOTS = SOURCE_PLUGIN_ROOT;
    process.env.CODEX_HOME = resolve(root, "codex-home");
    try {
      const compilation = await compile(root, "implement-change", {
        change: "return hello",
      });
      expect(compilation.plan.roles).toHaveLength(2);
      expect(compilation.profiles).toHaveLength(1);
      const lock = (await createLock(compilation, "shared-run")) as Record<
        string,
        any
      >;
      expect(lock.routes).toHaveLength(1);
      expect(lock.adapters).toHaveLength(1);
      expect(lock.adapters[0].routeIds).toEqual([lock.routes[0].routeId]);
    } finally {
      restoreEnvironment("DARROW_PLUGIN_ROOTS", previousRoots);
      restoreEnvironment("CODEX_HOME", previousCodexHome);
    }
  });

  test("rejects a command step that names an unknown explicit role", async () => {
    const root = await repo();
    const workflowPath = resolve(
      root,
      ".darrow",
      "workflows",
      "implement-change.yaml",
    );
    const source = await Bun.file(workflowPath).text();
    await writeFile(
      workflowPath,
      source
        .replace("profile: codex", "roles:\n  implement: { profile: codex }")
        .replace(
          "  - id: implement\n",
          "  - id: implement\n    role: review\n",
        ),
    );
    await expect(
      compile(root, "implement-change", { change: "return hello" }),
    ).rejects.toThrow("references unknown role review");
  });
});

function graphWorkflow(
  steps: Array<{ id: string; dependsOn: string[] }>,
): WorkflowDefinition {
  return {
    schemaVersion: "0.1.0",
    id: "graph-test",
    version: "0.1.0",
    engine: "^0.1.0",
    inputs: {},
    requirements: { capabilities: [] },
    profile: "codex",
    loops: [],
    steps: steps.map((step) => ({
      ...step,
      command: { id: "darrow-delivery:implement", version: "^0.1.0" },
      with: {},
    })),
  };
}

describe("M2 static workflow graph", () => {
  test("accepts roots, joins, and dependencies declared after their consumer", () => {
    const workflow = graphWorkflow([
      { id: "join", dependsOn: ["left", "right"] },
      { id: "left", dependsOn: [] },
      { id: "right", dependsOn: [] },
    ]);
    expect(() => validateWorkflowGraph(workflow)).not.toThrow();
    expect(orderWorkflowSteps(workflow).map((step) => step.id)).toEqual([
      "left",
      "right",
      "join",
    ]);
  });

  test("rejects duplicate, missing, self, and cyclic dependencies", () => {
    const invalid: Array<[WorkflowDefinition, string]> = [
      [
        graphWorkflow([
          { id: "same", dependsOn: [] },
          { id: "same", dependsOn: [] },
        ]),
        "duplicate workflow step ID",
      ],
      [graphWorkflow([{ id: "step", dependsOn: ["missing"] }]), "unknown step"],
      [
        graphWorkflow([{ id: "step", dependsOn: ["step"] }]),
        "depend on itself",
      ],
      [
        graphWorkflow([
          { id: "left", dependsOn: ["right"] },
          { id: "right", dependsOn: ["left"] },
        ]),
        "workflow dependency cycle",
      ],
    ];
    for (const [workflow, message] of invalid)
      expect(() => validateWorkflowGraph(workflow)).toThrow(message);
  });

  test("accepts a finite linear loop with a declared downstream waiver target", () => {
    const workflow = graphWorkflow([
      { id: "implement", dependsOn: [] },
      { id: "review", dependsOn: ["implement"] },
      { id: "publish", dependsOn: ["review"] },
    ]);
    workflow.loops = [
      {
        id: "implementation-review",
        steps: ["implement", "review"],
        maxAttempts: 3,
        until: { stepId: "review", output: "summary", equals: "approved" },
        waiver: {
          id: "review-rejection",
          description: "Accept the implementation despite review.",
          instructionsTo: "publish",
        },
      },
    ];
    expect(() => validateWorkflowGraph(workflow)).not.toThrow();
  });

  test("rejects overlapping, nonlinear, and externally exposed loop regions", () => {
    const overlapping = graphWorkflow([
      { id: "implement", dependsOn: [] },
      { id: "review", dependsOn: ["implement"] },
    ]);
    overlapping.loops = [
      {
        id: "first-loop",
        steps: ["implement", "review"],
        maxAttempts: 2,
        until: { stepId: "review", output: "summary", equals: "approved" },
        waiver: null,
      },
      {
        id: "second-loop",
        steps: ["review"],
        maxAttempts: 2,
        until: { stepId: "review", output: "summary", equals: "approved" },
        waiver: null,
      },
    ];
    expect(() => validateWorkflowGraph(overlapping)).toThrow(
      "belongs to loops",
    );

    const nonlinear = graphWorkflow([
      { id: "implement", dependsOn: [] },
      { id: "review", dependsOn: [] },
    ]);
    nonlinear.loops = [
      {
        id: "bad-loop",
        steps: ["implement", "review"],
        maxAttempts: 2,
        until: { stepId: "review", output: "summary", equals: "approved" },
        waiver: null,
      },
    ];
    expect(() => validateWorkflowGraph(nonlinear)).toThrow("linear region");

    const exposed = graphWorkflow([
      { id: "implement", dependsOn: [] },
      { id: "review", dependsOn: ["implement"] },
      { id: "publish", dependsOn: ["implement"] },
    ]);
    exposed.loops = [
      {
        id: "bad-loop",
        steps: ["implement", "review"],
        maxAttempts: 2,
        until: { stepId: "review", output: "summary", equals: "approved" },
        waiver: null,
      },
    ];
    expect(() => validateWorkflowGraph(exposed)).toThrow(
      "must depend on final step",
    );
  });

  test("rejects a dependency on a collapsed member of another loop", () => {
    const workflow = graphWorkflow([
      { id: "first-implement", dependsOn: [] },
      { id: "first-review", dependsOn: ["first-implement"] },
      { id: "second-implement", dependsOn: ["first-implement"] },
      { id: "second-review", dependsOn: ["second-implement"] },
    ]);
    workflow.loops = [
      {
        id: "first-loop",
        steps: ["first-implement", "first-review"],
        maxAttempts: 2,
        until: {
          stepId: "first-review",
          output: "summary",
          equals: "approved",
        },
        waiver: null,
      },
      {
        id: "second-loop",
        steps: ["second-implement", "second-review"],
        maxAttempts: 2,
        until: {
          stepId: "second-review",
          output: "summary",
          equals: "approved",
        },
        waiver: null,
      },
    ];
    expect(() => validateWorkflowGraph(workflow)).toThrow(
      "second-implement in loop second-loop must depend on final step first-review of loop first-loop, not collapsed member first-implement",
    );
  });

  test("rejects publication from inside a retry loop", () => {
    const workflow = graphWorkflow([
      { id: "implement", dependsOn: [] },
      { id: "review", dependsOn: ["implement"] },
    ]);
    workflow.steps[1]!.publish = {
      ticket: {
        backend: "github",
        project: "BjRo/darrow",
        nativeId: "4",
        url: "https://github.com/BjRo/darrow/issues/4",
      },
      artifactTypes: ["darrow.tdd-evidence"],
    };
    workflow.loops = [
      {
        id: "implementation-review",
        steps: ["implement", "review"],
        maxAttempts: 2,
        until: { stepId: "review", output: "summary", equals: "approved" },
        waiver: null,
      },
    ];
    expect(() => validateWorkflowGraph(workflow)).toThrow(
      "cannot publish from inside loop",
    );
  });
});
