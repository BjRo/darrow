import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";
import { validateCaseInventory } from "../sevro-extension/index";
import { policyProject } from "./policy-project";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("the whole case inventory resolves without retired response checks", async () => {
  const inventory = await validateCaseInventory(root);
  expect(inventory.failures).toEqual([]);
  expect(inventory.valid).toBe(true);
  expect(inventory.supported).toBe(inventory.total);
});

test("fixture setup and checks reference existing case resources", async () => {
  for (const pattern of [
    "plugins/**/evals/*.yaml",
    ".agents/skills/*/evals/*.yaml",
    "evals/experiments/**/cases/*.yaml",
  ]) {
    for await (const file of new Bun.Glob(pattern).scan({
      cwd: root,
      dot: true,
    })) {
      const selected = parse(await readFile(join(root, file), "utf8"));
      const commands = [
        selected.fixture?.setup ?? "",
        ...Object.values(selected.fixture?.bin ?? {}),
        ...(selected.checks ?? []).map((check: { run: string }) => check.run),
      ];
      for (const command of commands) {
        for (const match of String(command).matchAll(
          /\{\{case_dir\}\}([^\s"'`;|&<>()]*)/g,
        )) {
          const resource = join(root, dirname(file), match[1]!);
          await expect(
            access(resource).then(
              () => true,
              () => false,
            ),
            `${file}: ${match[0]}`,
          ).resolves.toBe(true);
        }
      }
    }
  }
});

test.each([
  "grep ready .git/last-message.md",
  "! grep failure .git/last-message.md",
  "if test -f .git/last-message.md; then cat .git/last-message.md; fi",
])("retired response check is refused before execution: %s", async (run) => {
  const project = await policyProject({ checks: [{ name: "response", run }] });
  await expect(project.resolve()).rejects.toThrow("retired response file");
});

test("IA canonical checks run in the installed isolated runtime", async () => {
  const source = new URL(
    "../../plugins/foundation/darrow-information-architecture/skills/doctor-information-architecture/evals/trim-derived-keep-contracts.yaml",
    import.meta.url,
  );
  const canonical = await readFixtureCase(source);
  const runtime = await prepareUvFixtureRuntime();
  const check = canonical.checks.find(
    (c) => c.name === "deterministic dual-runtime routing verification passes",
  )!;
  const result = await runFixtureChecks({
    source,
    runtimeConfig: new URL(
      "../sevro-extension/runtime-repository-skills.json",
      import.meta.url,
    ),
    fixtureAssets: new URL(
      "../../plugins/foundation/darrow-information-architecture/",
      import.meta.url,
    ),
    fixture: { ...canonical.fixture, bin: runtime.bin },
    setupPrefix: runtime.setupPrefix,
    checks: [
      check,
      canonical.checks.find(
        (check) => check.name === "canonical runtime metrics",
      )!,
    ],
  });
  expect(
    result.exitCode,
    result.diagnostic + "\n" + JSON.stringify(result.checks),
  ).toBe(0);
}, 30000);
