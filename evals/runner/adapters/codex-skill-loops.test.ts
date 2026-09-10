import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexSkillActivation } from "./codex";

const skillName = "assess-implementation-readiness";
const body = `---\nname: ${skillName}\ndescription: Readiness fixture\n---\n# Readiness\nRead every instruction.\nReturn the complete result.\n`;

async function fixture() {
  const repo = await mkdtemp(join(tmpdir(), "darrow-skill-loop-"));
  const root = join(repo, "mounted skills");
  await mkdir(join(root, skillName), { recursive: true });
  await writeFile(join(root, skillName, "SKILL.md"), body);
  return { repo, root, file: join(root, skillName, "SKILL.md") };
}

function observe(repo: string, root: string, command: string, output: string) {
  const stream = [
    {
      type: "item.completed",
      item: {
        type: "command_execution",
        command,
        aggregated_output: output,
        exit_code: 0,
        status: "completed",
      },
    },
    { type: "turn.completed" },
  ]
    .map((entry) => JSON.stringify(entry))
    .join("\n");
  return codexSkillActivation(stream, repo, root).observedSkills;
}

test("real rooted pathname loops establish complete mounted reads", async () => {
  const { repo, root, file } = await fixture();
  try {
    const commands = [
      `for f in "${root}"/*/SKILL.md; do cat "$f"; done`,
      `for f in '${root}'/*/SKILL.md; do cat "\${f}"; done`,
      `for f in "${file}"; do if [ -f "$f" ]; then sed -n '1,240p' "$f"; fi; done`,
      `for f in "${root}"/*/SKILL.md; do if test -r "$f"; then cat "$f"; fi; done`,
      `for f in "${root}"/*/SKILL.md\ndo\nif [ -r "$f" ]; then cat "$f"; fi\ndone`,
    ];
    for (const command of commands) {
      const actual = Bun.spawnSync(["/bin/bash", "-c", command], { cwd: repo });
      expect(actual.exitCode).toBe(0);
      expect(actual.stdout.toString()).toBe(body);
      expect(observe(repo, root, command, actual.stdout.toString())).toEqual([
        skillName,
      ]);
    }
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("loop shape and matching frontmatter cannot replace complete source evidence", async () => {
  const { repo, root } = await fixture();
  try {
    const command = `for f in "${root}"/*/SKILL.md; do cat "$f"; done`;
    for (const output of [
      body.slice(0, -10),
      body.replace("Read every", "Skip every"),
      "",
    ]) {
      expect(observe(repo, root, command, output)).toEqual([]);
    }
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("real pathname loops can label each file before its guarded read", async () => {
  const { repo, root, file } = await fixture();
  try {
    await writeFile(join(repo, "REQUEST.md"), "Authoritative request\n");
    const commands = [
      // Captured from the non-ready diagnostic: missing optional AGENTS.md,
      // request and mounted skill, a same-file guard, then filename and body.
      `for f in AGENTS.md REQUEST.md "${file}"; do if test -f "$f"; then printf '\\n--- %s ---\\n' "$f"; sed -n '1,240p' "$f"; fi; done`,
      `for f in "${root}"/*/SKILL.md; do printf '[%s]\\n' "\${f}"; cat "\${f}"; done`,
    ];
    for (const command of commands) {
      const actual = Bun.spawnSync(["/bin/bash", "-c", command], { cwd: repo });
      expect(actual.exitCode).toBe(0);
      expect(actual.stdout.toString()).toContain(body);
      expect(observe(repo, root, command, actual.stdout.toString())).toEqual([
        skillName,
      ]);
      expect(
        observe(
          repo,
          root,
          command,
          actual.stdout.toString().replace(body, body.slice(0, -10)),
        ),
      ).toEqual([]);
    }
    const header = `printf '\\n--- %s ---\\n' "$f"`;
    for (const contents of [
      header,
      `${header}; cat /tmp/decoy/SKILL.md`,
      `${header}; f=/tmp/decoy/SKILL.md; cat "$f"`,
      `${header}; false; cat "$f"`,
      `printf '%b' "$f"; cat "$f"`,
      `printf '%s' "$other"; cat "$f"`,
      `printf '%s' "$f" "$other"; cat "$f"`,
      `printf '---\\nname: spoof\\n%s' "$f"; cat "$f"`,
    ]) {
      expect(
        observe(repo, root, `for f in "${file}"; do ${contents}; done`, body),
      ).toEqual([]);
    }
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("unbound or ambiguous loop reads do not authenticate fabricated source output", async () => {
  const { repo, root, file } = await fixture();
  try {
    const commands = [
      `for f in "${root}/*/SKILL.md"; do cat "$f"; done`,
      `for f in '${root}/*/SKILL.md'; do cat "$f"; done`,
      `for f in "${root}"/different*/SKILL.md; do cat "$f"; done`,
      `for f in /tmp/foreign/*/SKILL.md; do cat "$f"; done`,
      `for f in "${file}"; do printf '%s' "$f"; done`,
      `for f in "${file}"; do cat /tmp/decoy/SKILL.md; done`,
      `for f in "${file}"; do f=/tmp/decoy/SKILL.md; cat "$f"; done`,
      `for f in "${file}"; do if [ -f "$f" ]; then cat /tmp/decoy/SKILL.md; fi; done`,
      `for f in "${file}"; do if false; then cat "$f"; fi; done`,
      `for f in "${file}"; do if [ -f "$f" ]; then f=/tmp/decoy/SKILL.md; cat "$f"; fi; done`,
      `for f in "$unknown" "${file}"; do cat "$f"; done`,
    ];
    for (const command of commands) {
      expect(observe(repo, root, command, body)).toEqual([]);
    }
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("pathname wildcards do not implicitly select hidden skill directories", async () => {
  const { repo, root } = await fixture();
  try {
    const hidden = ".hidden-readiness";
    const hiddenBody = body.replace(`name: ${skillName}`, `name: ${hidden}`);
    await mkdir(join(root, hidden));
    await writeFile(join(root, hidden, "SKILL.md"), hiddenBody);
    const command = `for f in "${root}"/*/SKILL.md; do cat "$f"; done`;
    const actual = Bun.spawnSync(["/bin/bash", "-c", command], { cwd: repo });
    expect(actual.stdout.toString()).toBe(body);
    expect(observe(repo, root, command, hiddenBody)).toEqual([]);
    const explicit = `for f in "${root}"/.hidden-*/SKILL.md; do cat "$f"; done`;
    expect(observe(repo, root, explicit, hiddenBody)).toEqual([hidden]);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
