import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
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
  validateWorkflowGraph,
  verifyRunSnapshot,
} from "../src/compiler";
import { writeJson } from "../src/io";
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
        resolve(snapshotDir, "commands", "darrow-delivery", "implement"),
      ),
    ).toContain("SKILL.md");
    await validateSchema("lock.schema.json", lock, "lock");
    await expect(
      verifyRunSnapshot(runDir, compilation.plan),
    ).resolves.toBeUndefined();
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
    await mkdir(resolve(plugin, "skills", "create-branch"), {
      recursive: true,
    });
    const manifest = { name: "darrow-git", version: "9.0.0" };
    await writeFile(
      resolve(plugin, ".codex-plugin", "plugin.json"),
      JSON.stringify({ ...manifest, skills: "./skills/" }),
    );
    await writeFile(
      resolve(plugin, ".claude-plugin", "plugin.json"),
      JSON.stringify(manifest),
    );
    await writeFile(
      resolve(plugin, "skills", "create-branch", "SKILL.md"),
      "# incompatible\n",
    );
    await writeFile(
      resolve(plugin, "skills", "create-branch", "darrow.json"),
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
});
