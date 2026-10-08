import { afterEach } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureExtensionRequest } from "./fixture-command";

type RecordValue = Record<string, unknown>;
export type PolicyCase = {
  id: string;
  prompt: string;
  checks: { id: string; grader: string }[];
  extensionData: { "darrow.case": RecordValue };
};
export type ActivationOutcome = {
  id: string;
  status: string;
  data: RecordValue;
};

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function skillFiles(directory: string, name: string) {
  await mkdir(join(directory, "evals"), { recursive: true });
  await writeFile(
    join(directory, "SKILL.md"),
    `---\nname: ${name}\ndescription: Fixture capability\n---\n\nReturn the requested response.\n`,
  );
}

async function pluginFiles(
  root: string,
  directory: string,
  name: string,
  skills: string[],
) {
  const plugin = join(root, directory);
  for (const host of ["claude", "codex"]) {
    await mkdir(join(plugin, `.${host}-plugin`), { recursive: true });
    await writeFile(
      join(plugin, `.${host}-plugin/plugin.json`),
      JSON.stringify({
        name,
        version: "0.1.0",
        ...(host === "codex" ? { skills: "./skills/" } : {}),
      }),
    );
  }
  for (const skill of new Set(skills))
    await skillFiles(join(plugin, "skills", skill), skill);
}

type ProjectOptions = {
  skill?: string;
  plugin?: string;
  directory?: string;
  repository?: boolean;
  skillless?: boolean;
};

async function projectLayout(root: string, options: ProjectOptions) {
  const skill = options.skill ?? "grilling";
  const plugin = options.plugin ?? "sample";
  const directory = options.directory ?? `plugins/capability/${plugin}`;
  const skillDir = options.skillless
    ? "evals/experiments/policy"
    : options.repository
      ? `.agents/skills/${skill}`
      : `${directory}/skills/${skill}`;
  if (options.skillless)
    await mkdir(join(root, skillDir, "cases"), { recursive: true });
  else if (options.repository) {
    await skillFiles(join(root, skillDir), skill);
    await skillFiles(join(root, ".claude/skills", skill), skill);
  } else {
    await pluginFiles(root, directory, plugin, [
      skill,
      "plan-implementation",
      "discover-feature",
    ]);
  }
  await pluginFiles(root, "plugins/capability/provider", "provider", [
    "verify-change",
    "code-review",
  ]);
  return join(
    root,
    skillDir,
    options.skillless ? "cases/policy.yaml" : "evals/policy.yaml",
  );
}

async function resolvePolicy(root: string, id: string) {
  const result = await fixtureExtensionRequest<{ cases: PolicyCase[] }>(
    "resolve",
    {
      projectRoot: pathToFileURL(root).href,
      selectors: { caseIds: [id] },
      configuration: {},
    },
  );
  if (result.cases.length !== 1 || result.cases[0]?.id !== id)
    throw new Error("policy resolution did not select the exact fixture case");
  return result.cases[0];
}

/** Own a small source project for public policy requests, without engine code. */
export async function policyProject(
  overrides: RecordValue = {},
  options: ProjectOptions = {},
) {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-policy-project-")),
  );
  roots.push(root);
  const caseFile = await projectLayout(root, options);
  const definition = {
    id: "activation-case",
    invariant: "SE-C9",
    prompt: "Grill this plan.",
    fixture: {
      commits: [{ message: "Initial", files: { "README.md": "fixture\n" } }],
    },
    checks: [],
    ...overrides,
  };
  const write = async (changes: RecordValue) => {
    Object.assign(definition, changes);
    await writeFile(caseFile, JSON.stringify(definition));
  };
  await write({});
  return {
    root,
    definition,
    write,
    resolve: () => resolvePolicy(root, definition.id),
  };
}

export const policyHostCapabilities = (host: "codex" | "claude") =>
  host === "codex"
    ? [
        "sevro.codex.plugin-marketplace",
        "sevro.codex.explicit-invocation",
        "sevro.codex.repository-invocation",
        "sevro.codex.native-calls",
      ]
    : [
        "sevro.claude.plugin-dirs",
        "sevro.claude.explicit-invocation",
        "sevro.claude.repository-invocation",
      ];

export function preparePolicy(
  selected: PolicyCase,
  host: "codex" | "claude" = "codex",
) {
  return fixtureExtensionRequest<RecordValue>("prepare", {
    case: selected,
    host: {
      id: `sevro.host.${host}`,
      capabilities: policyHostCapabilities(host),
    },
    condition: "passive",
    configuration: {},
  });
}

export function activationReceipt(skills: string[], complete = true) {
  return {
    id: "sevro.codex.skill-reads",
    source: "sevro.host.codex",
    completeness: complete ? "complete" : "partial",
    data: {
      method: "skill_file_read_probe",
      primarySkill: skills[0] ?? null,
      observedSkills: skills,
    },
  };
}

export async function evaluateActivation(
  selected: PolicyCase,
  observations: unknown[],
) {
  const result = await fixtureExtensionRequest<{
    domainOutcomes: ActivationOutcome[];
  }>("evaluate", {
    extensionData: selected.extensionData,
    observations,
  });
  const outcome = result.domainOutcomes.find(
    (entry) => entry.id === "darrow.evals.activation",
  );
  if (!outcome) throw new Error("public activation outcome is missing");
  return outcome;
}

async function promptAdapter(root: string, host: "codex" | "claude") {
  const adapter = join(root, `echo-${host}.ts`);
  await writeFile(
    adapter,
    `export default {
    id: ${JSON.stringify(`sevro.host.${host}`)}, model: "synthetic", effort: "none",
    hostCapabilities: ${JSON.stringify(policyHostCapabilities(host))},
    async run({ prompt }) { return { finalMessage: prompt, complete: true }; }
  };\n`,
  );
  return adapter;
}

function promptArguments(
  project: Awaited<ReturnType<typeof policyProject>>,
  host: "codex" | "claude",
  adapter: string,
) {
  return [
    process.execPath,
    resolve(import.meta.dir, "../sevro-extension/run.ts"),
    "--case-id",
    project.definition.id,
    "--project-root",
    project.root,
    "--results-root",
    join(project.root, `results-${host}`),
    "--",
    "--adapter-module",
    adapter,
    "--condition",
    "passive",
    "--shell-isolation",
    "--trials",
    "1",
    "--threshold",
    "1",
  ];
}

export async function runPolicyPrompt(
  project: Awaited<ReturnType<typeof policyProject>>,
  host: "codex" | "claude",
  expected: string,
) {
  await project.write({
    invariant: "SE-C12",
    output_checks: [{ name: "emitted prompt", expect_exact: expected }],
  });
  const adapter = await promptAdapter(project.root, host);
  const command = Bun.spawn(promptArguments(project, host, adapter), {
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([name, value]) =>
          value !== undefined &&
          !/(?:api[_-]?key|token|secret|password|credential)/i.test(name),
      ),
    ),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(command.stdout).text(),
    new Response(command.stderr).text(),
    command.exited,
  ]);
  return {
    exitCode,
    diagnostic: stderr || stdout,
    value: JSON.parse(stdout) as {
      format: string;
      execution: { status: string };
      grading: { status: string };
      task: { verdict: string };
      diagnostic?: { code: string; message: string };
      cases: { caseId: string; trials: { checks: { status: string }[] }[] }[];
    },
  };
}
