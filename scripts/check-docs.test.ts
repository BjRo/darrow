import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});
async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "darrow-doc-check-"));
  roots.push(root);
  const baseline = {
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "darrow",
      plugins: [],
    }),
    ".agents/skills/darrow-guide/SKILL.md": "# Guide\n",
    ".claude/skills/darrow-guide/SKILL.md": "# Guide\n",
    ".agents/skills/darrow-guide/scripts/find-plugin-claim.sh":
      "# Read-only lookup\n",
    ".claude/skills/darrow-guide/scripts/find-plugin-claim.sh":
      "# Read-only lookup\n",
    ".agents/skills/darrow-guide/evals/inventory.json": JSON.stringify({
      version: 1,
      questions: [],
    }),
    "docs/choosing-plugins.md": "# Choose\n",
    "python-packages.txt": "# No Python packages in the minimal fixture.\n",
  };
  for (const [path, text] of Object.entries({ ...baseline, ...files })) {
    const destination = join(root, path);
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFile(destination, text);
  }
  return root;
}
async function check(root: string) {
  const proc = Bun.spawn(
    [process.execPath, join(import.meta.dir, "check-docs.ts"), "--root", root],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { output: stdout + stderr, code };
}
test("checks rendered links and GitHub duplicate heading anchors, ignoring code examples", async () => {
  const root = await fixture({
    "README.md":
      "# Root\n\n[second](other.md#hello-world-1)\n\n[reference][target]\n\n[target]: other.md#hello-world\n\n```text\n[example](missing.md)\n```\n",
    "other.md": "# Hello, *World*!\n\n## Hello, World!\n",
  });
  const result = await check(root);
  expect(result.code, result.output).toBe(0);
});
test("reports broken links, anchors, image alternatives and unlabelled fences", async () => {
  const root = await fixture({
    "README.md":
      "# Root\n\n[missing](absent.md)\n[anchor](#absent)\n![](image.svg)\n\n```\ncode\n```\n",
    "image.svg": "<svg/>",
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  for (const message of [
    "absent.md",
    "#absent",
    "image alternative",
    "fence language",
  ])
    expect(result.output).toContain(message);
});
test("rejects guide drift and unpublished catalog paths", async () => {
  const root = await fixture({
    ".claude/skills/darrow-guide/SKILL.md": "# A different guide\n",
    "docs/choosing-plugins.md":
      "# Choose\n\n[stale](../plugins/capability/removed/README.md)\n",
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  expect(result.output).toContain("guide entrypoints differ");
  expect(result.output).toContain("removed/README.md");
});
test.each(["different", "missing"])(
  "rejects %s guide lookup mirrors",
  async (state) => {
    const mirror = ".claude/skills/darrow-guide/scripts/find-plugin-claim.sh";
    const root = await fixture({ [mirror]: "# Different lookup\n" });
    if (state === "missing") await rm(join(root, mirror));
    const result = await check(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain("scripts/find-plugin-claim.sh");
  },
);
test("validates paired manifests, required README sections and catalog membership", async () => {
  const plugin = "plugins/capability/example";
  const root = await fixture({
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "darrow",
      plugins: [{ name: "example", source: "./" + plugin }],
    }),
    [plugin + "/README.md"]: "# Example\n",
    [plugin + "/.claude-plugin/plugin.json"]: JSON.stringify({
      name: "example",
      version: "1.0.0",
    }),
    [plugin + "/.codex-plugin/plugin.json"]: JSON.stringify({
      name: "wrong",
      version: "1.0.1",
      skills: "./skills/",
    }),
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  for (const message of [
    "manifest identity",
    "manifest versions",
    "When to use",
    "catalog",
  ])
    expect(result.output).toContain(message);
});
test("rejects Codex-only hooks at Claude Code's default hook path", async () => {
  const plugin = "plugins/capability/example";
  const root = await fixture({
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "darrow",
      plugins: [{ name: "example", source: "./" + plugin }],
    }),
    [plugin + "/hooks/hooks.json"]: JSON.stringify({
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: 'bash "${PLUGIN_ROOT}/hooks/session-start.sh"',
              },
            ],
          },
        ],
      },
    }),
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  expect(result.output).toContain(
    "Claude Code loads hooks/hooks.json without PLUGIN_ROOT",
  );
});
test("rejects an inventory with missing cases or source routes", async () => {
  const root = await fixture({
    ".agents/skills/darrow-guide/evals/inventory.json": JSON.stringify({
      version: 1,
      questions: [
        {
          id: "guide-example",
          sources: ["absent.md"],
          static_page: "docs/absent.md",
        },
      ],
    }),
    ".agents/skills/darrow-guide/evals/unlisted.yaml": "id: unlisted\n",
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  for (const message of [
    "missing or invalid case",
    "absent.md",
    "case absent from inventory",
  ])
    expect(result.output).toContain(message);
});

test.each([
  [
    "rejects",
    "uv run --quiet --frozen --no-dev --project backend example-command",
    1,
  ],
  [
    "accepts",
    "uv run --quiet --no-project backend/scripts/run_locked.py example-command",
    0,
  ],
])("%s installed Python runtime command policy", async (_, command, code) => {
  const plugin = "plugins/capability/example";
  const readme = `# Example

## When to use

Example.

## Hosts and prerequisites

UV.

## Installation

Install it.

## Usage

\`\`\`sh
${command}
\`\`\`

## Expected result

Success.

## Safety boundaries

Read only.

## Troubleshooting

Check UV.

## License

BUSL.
`;
  const root = await fixture({
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "darrow",
      plugins: [{ name: "example", source: "./" + plugin }],
    }),
    "docs/choosing-plugins.md":
      "# Choose\n\n[Example](../" + plugin + "/README.md)\n",
    "python-packages.txt": plugin + "/backend\n",
    [plugin + "/README.md"]: readme,
    [plugin + "/.claude-plugin/plugin.json"]: JSON.stringify({
      name: "example",
      version: "1.0.0",
    }),
    [plugin + "/.codex-plugin/plugin.json"]: JSON.stringify({
      name: "example",
      version: "1.0.0",
      skills: "./skills/",
    }),
    [plugin + "/skills/example/SKILL.md"]:
      "---\nname: example\ndescription: Example.\n---\n",
    [plugin + "/backend/scripts/run_locked.py"]: "# runtime launcher\n",
  });
  const result = await check(root);
  expect(result.code, result.output).toBe(code);
  if (code)
    expect(result.output).toContain("bypasses backend/scripts/run_locked.py");
});

test("rejects a generated runtime command that bypasses the launcher", async () => {
  const plugin = "plugins/capability/example";
  const root = await fixture({
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "darrow",
      plugins: [{ name: "example", source: "./" + plugin }],
    }),
    "docs/choosing-plugins.md":
      "# Choose\n\n[Example](../" + plugin + "/README.md)\n",
    "python-packages.txt": plugin + "/backend\n",
    [plugin + "/README.md"]: `# Example

## When to use

Example.

## Hosts and prerequisites

UV.

## Installation

Install it.

## Usage

Run it.

## Expected result

Success.

## Safety boundaries

Read only.

## Troubleshooting

Check UV.

## License

BUSL.
`,
    [plugin + "/.claude-plugin/plugin.json"]: JSON.stringify({
      name: "example",
      version: "1.0.0",
    }),
    [plugin + "/.codex-plugin/plugin.json"]: JSON.stringify({
      name: "example",
      version: "1.0.0",
      skills: "./skills/",
    }),
    [plugin + "/skills/example/SKILL.md"]:
      "---\nname: example\ndescription: Example.\n---\n",
    [plugin + "/backend/scripts/run_locked.py"]: "# runtime launcher\n",
    [plugin + "/backend/src/example/runtime.py"]:
      'valid = ["uv", "run", "--no-project", "backend/scripts/run_locked.py", "example"]\n' +
      'bypass = ["uv", "run", "--project", str(backend), "example"]\n',
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  expect(result.output).toContain("generated runtime command bypasses");
});

test("rejects a model-facing eval fixture that bypasses the launcher", async () => {
  const plugin = "plugins/capability/example";
  const root = await fixture({
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "darrow",
      plugins: [{ name: "example", source: "./" + plugin }],
    }),
    "docs/choosing-plugins.md":
      "# Choose\n\n[Example](../" + plugin + "/README.md)\n",
    "python-packages.txt": plugin + "/backend\n",
    [plugin + "/README.md"]: `# Example

## When to use

Example.

## Hosts and prerequisites

UV.

## Installation

Install it.

## Usage

Run it.

## Expected result

Success.

## Safety boundaries

Read only.

## Troubleshooting

Check UV.

## License

BUSL.
`,
    [plugin + "/.claude-plugin/plugin.json"]: JSON.stringify({
      name: "example",
      version: "1.0.0",
    }),
    [plugin + "/.codex-plugin/plugin.json"]: JSON.stringify({
      name: "example",
      version: "1.0.0",
      skills: "./skills/",
    }),
    [plugin + "/skills/example/SKILL.md"]:
      "---\nname: example\ndescription: Example.\n---\n",
    [plugin + "/skills/example/evals/fixtures/SKILL.fixture.md"]:
      'uv run --quiet --project "$skill_dir/../../backend" example\n',
    [plugin + "/backend/scripts/run_locked.py"]: "# runtime launcher\n",
  });
  const result = await check(root);
  expect(result.code).toBe(1);
  expect(result.output).toContain("installed runtime command bypasses");
});

const archiveReport =
  "# Frozen observation\n\n[retired source](../../plugins/capability/retired/SKILL.md)\n";
function archiveFixture(report = archiveReport) {
  const revision = "de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89";
  return {
    "docs/research/frozen.md": report,
    "docs/research/retired-links.json": JSON.stringify({
      revision,
      files: [
        {
          path: "docs/research/frozen.md",
          sha256: createHash("sha256").update(archiveReport).digest("hex"),
          missingLinks: [
            {
              target: "../../plugins/capability/retired/SKILL.md",
              source: `https://github.com/BjRo/darrow/blob/${revision}/plugins/capability/retired/SKILL.md`,
              sha256: "a".repeat(64),
            },
          ],
        },
      ],
    }),
  };
}
test("accepts only exact frozen historical links with immutable source mappings", async () => {
  const result = await check(await fixture(archiveFixture()));
  expect(result.code, result.output).toBe(0);
});
test("rejects altered frozen reports even when their links still resolve through the archive", async () => {
  const result = await check(
    await fixture(archiveFixture(archiveReport + "Changed observation.\n")),
  );
  expect(result.code).toBe(1);
  expect(result.output).toContain("frozen report hash differs");
});
test("archive mappings do not hide unknown or current broken links", async () => {
  const files = archiveFixture();
  const result = await check(
    await fixture({
      ...files,
      "docs/current.md":
        "# Current\n[broken](../plugins/capability/retired/SKILL.md)\n",
      "docs/research/unknown.md": "# Unknown\n[broken](absent.md)\n",
    }),
  );
  expect(result.code).toBe(1);
  expect(result.output).toContain(
    "missing internal link: ../plugins/capability/retired/SKILL.md",
  );
  expect(result.output).toContain("missing internal link: absent.md");
});
test("rejects an archive URL that does not identify the exact frozen target", async () => {
  const files = archiveFixture();
  files["docs/research/retired-links.json"] = files[
    "docs/research/retired-links.json"
  ].replace("/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/", "/blob/main/");
  const result = await check(await fixture(files));
  expect(result.code).toBe(1);
  expect(result.output).toContain("invalid archived target");
});

test("an exact frozen report cannot exempt an unlisted missing link", async () => {
  const report = archiveReport + "[unknown](unknown.md)\n";
  const files = archiveFixture(report);
  const manifest = JSON.parse(files["docs/research/retired-links.json"]);
  manifest.files[0].sha256 = createHash("sha256").update(report).digest("hex");
  files["docs/research/retired-links.json"] = JSON.stringify(manifest);
  const result = await check(await fixture(files));
  expect(result.code).toBe(1);
  expect(result.output).toContain("missing internal link: unknown.md");
  expect(result.output).not.toContain("frozen report hash differs");
});
