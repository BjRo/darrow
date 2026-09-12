import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderCoverageReport, scanInvariantCoverage } from "./coverage";

const roots: string[] = [];

async function treeSnapshot(
  root: string,
  directory = root,
): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    const path = join(directory, entry.name);
    const relativePath = path.slice(root.length + 1);
    if (entry.isDirectory()) {
      snapshot[`${relativePath}/`] = "directory";
      Object.assign(snapshot, await treeSnapshot(root, path));
    } else if (entry.isFile()) {
      snapshot[relativePath] = await readFile(path, "utf8");
    }
  }
  return snapshot;
}

async function fixture(): Promise<{
  root: string;
  specs: string;
  evals: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "darrow-coverage-"));
  roots.push(root);
  const specs = join(root, "specs");
  const evals = join(root, "plugin", "skills", "sample", "evals");
  await mkdir(specs, { recursive: true });
  await mkdir(evals, { recursive: true });
  return { root, specs, evals };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("invariant coverage", () => {
  test("default CLI coverage includes canonical repository cases without scanning host mirrors", async () => {
    const { root } = await fixture();
    for (const directory of [
      "docs/specs",
      "plugins",
      ".agents/skills/guide/evals",
      ".claude/skills/guide/evals",
    ])
      await mkdir(join(root, directory), { recursive: true });
    await writeFile(
      join(root, "docs/specs/guide.md"),
      "- **RG-C1 — Repository guide.**\n",
    );
    await writeFile(
      join(root, ".agents/skills/guide/evals/direct.yaml"),
      "id: repository-question\ninvariant: RG-C1\nprompt: Explain it\nfixture: {}\nchecks: []\n",
    );
    await writeFile(
      join(root, ".claude/skills/guide/evals/direct.yaml"),
      "id: mirror-not-canonical\ninvariant: UNKNOWN-C1\nprompt: Ignore\nfixture: {}\nchecks: []\n",
    );
    const proc = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "coverage.ts"),
        "--root",
        root,
        "--json",
        "--strict",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code, stderr).toBe(0);
    expect(
      JSON.parse(stdout).invariants[0].cases.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual(["repository-question"]);
  });
  test("reports covered, uncovered, and unknown IDs without treating uncovered as invalid", async () => {
    const { root, specs, evals } = await fixture();
    await writeFile(
      join(specs, "sample.md"),
      [
        "# Sample",
        "",
        "Prose may cite an example such as `**EX-OLD0 — ...**` without defining it.",
        "",
        "- **EX-C1 — Covered behavior.** Details.",
        "- **EX-C2 — Uncovered behavior.** Details.",
      ].join("\n"),
    );
    await writeFile(
      join(evals, "sample.yaml"),
      [
        "id: sample-case",
        'invariant: "EX-C1,EX-OLD1"',
        'prompt: "Exercise the behavior."',
        "fixture:",
        "  commits: []",
        "checks: []",
      ].join("\n"),
    );

    const report = await scanInvariantCoverage({
      root,
      specInputs: [specs],
      evalInputs: [join(root, "plugin")],
    });

    expect(report.invariants.map((item) => item.id)).toEqual([
      "EX-C1",
      "EX-C2",
    ]);
    expect(report.invariants[0]?.cases.map((item) => item.id)).toEqual([
      "sample-case",
    ]);
    expect(report.uncovered).toEqual(["EX-C2"]);
    expect(report.unknownReferences.map((item) => item.id)).toEqual([
      "EX-OLD1",
    ]);
    expect(report.valid).toBe(false);
    expect(renderCoverageReport(report)).toContain(
      "EX-C2 — no eval case references this invariant",
    );
    expect(renderCoverageReport(report)).toContain(
      "EX-OLD1 — referenced by sample-case",
    );
  });

  test("detects duplicate definitions and strict uncovered failure separately", async () => {
    const { root, specs, evals } = await fixture();
    await writeFile(join(specs, "one.md"), "- **EX-C1 — First.**\n");
    await writeFile(join(specs, "two.md"), "1. **EX-C1 — Second.**\n");
    await writeFile(
      join(evals, "sample.yaml"),
      "id: sample-case\ninvariant: EX-C1\nprompt: sample\nfixture: {}\nchecks: []\n",
    );

    const report = await scanInvariantCoverage({
      root,
      specInputs: [specs],
      evalInputs: [join(root, "plugin")],
    });
    expect(report.duplicateDefinitions).toHaveLength(1);
    expect(report.valid).toBe(false);

    await writeFile(join(specs, "two.md"), "- **EX-C2 — Uncovered.**\n");
    const uncovered = await scanInvariantCoverage({
      root,
      specInputs: [specs],
      evalInputs: [join(root, "plugin")],
    });
    expect(uncovered.valid).toBe(true);
    expect(uncovered.strictValid).toBe(false);
  });

  test("fails closed on malformed or empty input and leaves files unchanged", async () => {
    const { root, specs, evals } = await fixture();
    const spec = join(specs, "sample.md");
    const evalCase = join(evals, "sample.yaml");
    await writeFile(spec, "- **EX-C1 — Covered.**\n");
    await writeFile(evalCase, "id: [unterminated\n");
    const before = await treeSnapshot(root);

    await expect(
      scanInvariantCoverage({
        root,
        specInputs: [specs],
        evalInputs: [join(root, "plugin")],
      }),
    ).rejects.toThrow(/sample\.yaml/);
    expect(await treeSnapshot(root)).toEqual(before);

    await rm(spec);
    await expect(
      scanInvariantCoverage({
        root,
        specInputs: [specs],
        evalInputs: [join(root, "plugin")],
      }),
    ).rejects.toThrow(/no specification files/i);
  });

  test("refuses an unreadable case instead of skipping it", async () => {
    const { root, specs, evals } = await fixture();
    await writeFile(join(specs, "sample.md"), "- **EX-C1 — Covered.**\n");
    const evalCase = join(evals, "sample.yaml");
    await writeFile(
      evalCase,
      "id: sample-case\ninvariant: EX-C1\nprompt: sample\nfixture: {}\nchecks: []\n",
    );
    await chmod(evalCase, 0);
    try {
      await expect(
        scanInvariantCoverage({
          root,
          specInputs: [specs],
          evalInputs: [join(root, "plugin")],
        }),
      ).rejects.toThrow();
    } finally {
      await chmod(evalCase, 0o600);
    }
  });
});
