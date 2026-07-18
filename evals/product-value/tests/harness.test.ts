import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { invoke } from "../src/harness";
import type { Protocol } from "../src/types";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("product-value harness isolation (PV-3, PV-6)", () => {
  test("allows workspace changes but denies the hidden source", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-harness-test-"));
    roots.push(root);
    const repo = join(root, "repo");
    const state = join(root, "state");
    const hidden = join(root, "hidden-source");
    await Promise.all([mkdir(repo), mkdir(state), mkdir(hidden)]);
    await writeFile(join(hidden, "oracle.txt"), "not visible\n");
    const executable = join(root, "fake-codex");
    await writeFile(
      executable,
      `#!/bin/sh
if /bin/cat '${join(hidden, "oracle.txt")}' >/dev/null 2>&1; then
  printf leaked > leaked.txt
  exit 7
fi
printf safe > changed.txt
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":12,"output_tokens":3}}'
`,
    );
    await chmod(executable, 0o755);
    const protocol: Protocol = {
      schemaVersion: "1.0.0",
      preregisteredAt: new Date(0).toISOString(),
      frozenSeed: "test",
      repeats: 2,
      treatments: ["native", "plugins", "cli"],
      harnesses: {
        codex: {
          executable,
          version: "fake",
          model: "fake",
          effort: "medium",
          permissionMode: "test",
          authFiles: [],
        },
        claude: {
          executable,
          version: "fake",
          model: "fake",
          effort: "medium",
          permissionMode: "test",
          authFiles: [],
        },
      },
      design: {
        alpha: 0.05,
        power: 0.8,
        pairedTaskSd: 0.18,
        qualityNonInferiorityMargin: 0.05,
        usefulQualityGain: 0.1,
        usefulAttentionReduction: 0.2,
        maxCostRatio: 1.5,
        maxWallTimeRatio: 1.75,
        maxOperationalFailureRate: 0.05,
        bootstrapSamples: 100,
        randomizationSamples: 100,
      },
      budgets: {
        pilotCostUsd: 1,
        confirmatoryCostUsd: 1,
        pilotTokens: 100,
        confirmatoryTokens: 100,
      },
      paths: {
        pluginRoot: "plugins",
        bunExecutable: Bun.which("bun")!,
        darrowExecutable: "cli.ts",
        toolchainHome: "toolchain",
      },
    };

    const result = await invoke(
      protocol,
      "codex",
      "native",
      repo,
      state,
      "task",
      join(root, "plugins"),
      Bun.which("bun")!,
      join(root, "cli.ts"),
      [hidden],
    );

    expect(result.ok).toBe(true);
    expect(result.inputTokens).toBe(12);
    expect(await Bun.file(join(repo, "changed.txt")).text()).toBe("safe");
    expect(await Bun.file(join(repo, "leaked.txt")).exists()).toBe(false);
  });
});
