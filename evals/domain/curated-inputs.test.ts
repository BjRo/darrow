import { afterEach, expect, test } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve(import.meta.dir, "../../scripts/acquire-curated-skills");
const fixtures = join(import.meta.dir, "curated-inputs");
const roots: string[] = [];
const matt =
  "grilling wayfinder grill-with-docs domain-modeling diagnosing-bugs to-spec to-tickets wizard codebase-design improve-codebase-architecture writing-for-agents wait-what tdd implement research prototype setup-matt-pocock-skills".split(
    " ",
  );
const support = [
  "domain-modeling/ADR-FORMAT.md",
  "domain-modeling/GLOSSARY-FORMAT.md",
  "diagnosing-bugs/scripts/hitl-loop.template.sh",
  "wizard/template.sh",
  "codebase-design/DEEPENING.md",
  "codebase-design/DESIGN-IT-TWICE.md",
  "improve-codebase-architecture/HTML-REPORT.md",
  "writing-for-agents/SKILL-MECHANICS.md",
  "tdd/tests.md",
  "tdd/mocking.md",
  "prototype/LOGIC.md",
  "prototype/UI.md",
  "setup-matt-pocock-skills/issue-tracker-github.md",
  "setup-matt-pocock-skills/issue-tracker-gitlab.md",
  "setup-matt-pocock-skills/issue-tracker-local.md",
  "setup-matt-pocock-skills/triage-labels.md",
  "setup-matt-pocock-skills/domain.md",
];

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "darrow-curated-test-"));
  roots.push(root);
  for (const dir of ["bin", "home", "caller", "source/matt", "source/pstack"])
    await mkdir(join(root, dir), { recursive: true });
  for (const path of [
    ...matt.flatMap((name) => [
      `matt/${name}/SKILL.md`,
      `matt/${name}/agents/openai.yaml`,
    ]),
    ...support.map((path) => `matt/${path}`),
    "matt/tdd/references/additional.txt",
    "pstack/unslop/SKILL.md",
  ]) {
    await mkdir(join(root, "source", path, ".."), { recursive: true });
    await writeFile(join(root, "source", path), `fixture ${path}\n`);
  }
  await writeFile(
    join(root, "bin/npx"),
    `#!/bin/bash
set -eu
case "$*" in
  '--yes skills@1.9.0 add mattpocock/skills@abeeaf95660ba9e8b7c753eb38f441ca707a8823 --agent codex --copy --yes --skill ${matt.join(" ")}' ) source=matt ;;
  '--yes skills@1.9.0 add https://github.com/cursor/plugins/tree/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack --agent codex --copy --yes --skill unslop' ) source=pstack ;;
  *) echo 'Unexpected acquisition request' >&2; exit 2 ;;
esac
mkdir -p .agents/skills
cp -R "$CURATED_FIXTURE/source/$source/." .agents/skills/
printf '{"fixture":true}\\n' > skills-lock.json
`,
  );
  await writeFile(
    join(root, "bin/curl"),
    `#!/bin/bash
set -eu
case "$2" in
  https://raw.githubusercontent.com/mattpocock/skills/abeeaf95660ba9e8b7c753eb38f441ca707a8823/LICENSE) source=matt ;;
  https://raw.githubusercontent.com/cursor/plugins/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/LICENSE) source=pstack ;;
  *) exit 2 ;;
esac
test "$1" = -fsSL && test "$3" = -o
cp "$CURATED_NOTICES/$source.LICENSE" "$4"
`,
  );
  for (const bin of ["npx", "curl"]) await chmod(join(root, "bin", bin), 0o755);
  return {
    root,
    output: join(root, "output"),
    env: {
      ...process.env,
      PATH: `${join(root, "bin")}:${process.env.PATH}`,
      CURATED_FIXTURE: root,
      CURATED_NOTICES: fixtures,
    },
  };
}

async function acquire(fixture: Awaited<ReturnType<typeof setup>>) {
  const child = Bun.spawn(
    [process.env.CURATED_TEST_SHELL ?? "bash", script, fixture.output],
    {
      cwd: join(fixture.root, "caller"),
      env: fixture.env,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("acquires the pinned selection, complete support and notices into disposable inputs", async () => {
  const fixture = await setup();
  const result = await acquire(fixture);
  expect(
    result,
    "acquisition command must produce the packaged inputs",
  ).toMatchObject({ code: 0 });
  expect((await readdir(join(fixture.output, "matt/skills"))).sort()).toEqual(
    [...matt].sort(),
  );
  expect(await readdir(join(fixture.output, "pstack/skills"))).toEqual([
    "unslop",
  ]);
  for (const path of [
    ...support,
    "tdd/references/additional.txt",
    ...matt.map((name) => `${name}/agents/openai.yaml`),
  ])
    expect(
      await readFile(join(fixture.output, "matt/skills", path), "utf8"),
    ).toBe(`fixture matt/${path}\n`);
  for (const name of ["matt", "pstack"]) {
    expect(await readFile(join(fixture.output, name, "LICENSE"), "utf8")).toBe(
      await readFile(join(fixtures, `${name}.LICENSE`), "utf8"),
    );
    expect(
      await readFile(join(fixture.output, name, "files.sha256"), "utf8"),
    ).toContain("skills/");
    expect(
      await readFile(join(fixture.output, name, "provenance.txt"), "utf8"),
    ).toContain("skills@1.9.0");
    expect(
      await readFile(join(fixture.output, name, "required-files.txt"), "utf8"),
    ).toContain("SKILL.md");
  }
  expect(
    await readFile(join(fixture.output, "pstack/provenance.txt"), "utf8"),
  ).toContain("unknown");
  expect(await readdir(join(fixture.root, "caller"))).toEqual([]);
  const before = await readFile(
    join(fixture.output, "matt/files.sha256"),
    "utf8",
  );
  expect((await acquire(fixture)).code).not.toBe(0);
  expect(
    await readFile(join(fixture.output, "matt/files.sha256"), "utf8"),
  ).toBe(before);
});

test("rejects incomplete or expanded inputs and damaged notices without publishing a destination", async () => {
  for (const variant of ["support", "selection", "notice"]) {
    const fixture = await setup();
    if (variant === "support")
      await rm(join(fixture.root, "source/matt/prototype/UI.md"));
    if (variant === "selection") {
      await mkdir(join(fixture.root, "source/pstack/benchmark-checklist"));
      await writeFile(
        join(fixture.root, "source/pstack/benchmark-checklist/SKILL.md"),
        "unselected",
      );
    }
    if (variant === "notice") {
      await mkdir(join(fixture.root, "notices"));
      await writeFile(
        join(fixture.root, "notices/matt.LICENSE"),
        "MIT License\nCopyright (c) 2026 Matt Pocock\n",
      );
      await writeFile(
        join(fixture.root, "notices/pstack.LICENSE"),
        await readFile(join(fixtures, "pstack.LICENSE")),
      );
      fixture.env.CURATED_NOTICES = join(fixture.root, "notices");
    }
    const result = await acquire(fixture);
    expect(result.code, variant).not.toBe(0);
    expect(await readdir(fixture.root)).not.toContain("output");
    expect(
      (await readdir(fixture.root)).filter((name) =>
        name.startsWith("output.partial."),
      ),
    ).toEqual([]);
  }
});
