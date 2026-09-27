#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

type RecordValue = Record<string, unknown>;

function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as RecordValue;
}

function keys(value: RecordValue, allowed: string[], label: string): void {
  const unsupported = Object.keys(value).filter(
    (key) => !allowed.includes(key),
  );
  if (unsupported.length)
    throw new Error(
      `${label} uses unsupported fields: ${unsupported.join(", ")}`,
    );
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} must be a nonempty string`);
  return value;
}

function files(value: unknown, label: string): Record<string, string> {
  const entries = record(value, label);
  if (Object.values(entries).some((item) => typeof item !== "string"))
    throw new Error(`${label} must contain text files`);
  return entries as Record<string, string>;
}

function fixtureOverlay(fixture: RecordValue) {
  const overlay =
    fixture.files === undefined
      ? undefined
      : files(fixture.files, "fixture files");
  if (
    fixture.staged !== undefined &&
    (!Array.isArray(fixture.staged) ||
      !fixture.staged.every((path) => typeof path === "string"))
  )
    throw new Error("fixture staged paths are invalid");
  if (
    fixture.commit_files !== undefined &&
    typeof fixture.commit_files !== "boolean"
  )
    throw new Error("fixture commit_files must be a boolean");
  return {
    ...(overlay ? { files: overlay } : {}),
    ...(fixture.staged ? { staged: fixture.staged } : {}),
    ...(fixture.commit_files ? { commitFiles: true } : {}),
  };
}

function generatedFixture(value: unknown) {
  const fixture = record(value, "fixture");
  keys(
    fixture,
    ["commits", "files", "staged", "commit_files", "setup"],
    "fixture",
  );
  if (!Array.isArray(fixture.commits) || !fixture.commits.length)
    throw new Error("case needs a generated Git history");
  const commits = fixture.commits.map((entry, index) => {
    const commit = record(entry, `commit ${index + 1}`);
    keys(commit, ["message", "files"], `commit ${index + 1}`);
    return {
      message: string(commit.message, `commit ${index + 1} message`),
      files: files(commit.files, `commit ${index + 1} files`),
    };
  });
  return {
    kind: "generated" as const,
    commits,
    ...fixtureOverlay(fixture),
  };
}

function repositoryFixture(fixture: RecordValue) {
  keys(
    fixture,
    ["source", "files", "staged", "commit_files", "setup"],
    "fixture",
  );
  const sourceRef = string(fixture.source, "fixture source");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(sourceRef))
    throw new Error("fixture source ID is invalid");
  return { kind: "repository" as const, sourceRef, ...fixtureOverlay(fixture) };
}

function fixtureSetupScript(fixture: RecordValue): string | null {
  if (fixture.setup === undefined) return null;
  const script = string(fixture.setup, "fixture setup");
  if (Buffer.byteLength(script, "utf8") > 60 * 1024)
    throw new Error("fixture setup exceeds the size limit");
  return script;
}

function caseFixture(value: unknown) {
  const fixture = record(value, "fixture");
  const setup = fixtureSetupScript(fixture);
  return {
    fixture:
      fixture.source === undefined
        ? generatedFixture(fixture)
        : repositoryFixture(fixture),
    ...(setup
      ? { setupDigest: createHash("sha256").update(setup).digest("hex") }
      : {}),
  };
}

function shellChecks(value: unknown) {
  if (!Array.isArray(value)) throw new Error("case checks must be an array");
  return value.map((entry, index) => {
    const check = record(entry, `check ${index + 1}`);
    keys(
      check,
      [
        "name",
        "run",
        "expect_exact",
        "expect_regex",
        "not_regex",
        "flags",
        "exit_code",
      ],
      `check ${index + 1}`,
    );
    string(check.name, `check ${index + 1} name`);
    const run = string(check.run, `check ${index + 1} run`);
    const configuration = {
      run,
      ...(check.exit_code === undefined
        ? {}
        : { expectedExitCode: check.exit_code }),
      ...(check.expect_exact === undefined
        ? {}
        : { expectExact: check.expect_exact }),
      ...(check.expect_regex === undefined
        ? {}
        : { expectRegex: check.expect_regex }),
      ...(check.not_regex === undefined ? {} : { notRegex: check.not_regex }),
      ...(check.flags === undefined ? {} : { flags: check.flags }),
    };
    return {
      id: `darrow.shell.${index + 1}`,
      grader: "sevro.shell",
      configuration,
    };
  });
}

function outputChecks(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error("case output_checks must be an array");
  return value.map((entry, index) => {
    const check = record(entry, `output check ${index + 1}`);
    keys(
      check,
      [
        "name",
        "valid_json",
        "json_path",
        "expect_json",
        "contains_json",
        "expect_exact",
        "expect_regex",
        "not_regex",
        "flags",
      ],
      `output check ${index + 1}`,
    );
    string(check.name, `output check ${index + 1} name`);
    return {
      id: `darrow.output.${index + 1}`,
      grader: "sevro.output",
      configuration: {
        ...(check.valid_json === undefined
          ? {}
          : { validJson: check.valid_json }),
        ...(check.json_path === undefined ? {} : { jsonPath: check.json_path }),
        ...(Object.hasOwn(check, "expect_json")
          ? { expectJson: check.expect_json }
          : {}),
        ...(Object.hasOwn(check, "contains_json")
          ? { containsJson: check.contains_json }
          : {}),
        ...(check.expect_exact === undefined
          ? {}
          : { expectExact: check.expect_exact }),
        ...(check.expect_regex === undefined
          ? {}
          : { expectRegex: check.expect_regex }),
        ...(check.not_regex === undefined ? {} : { notRegex: check.not_regex }),
        ...(check.flags === undefined ? {} : { flags: check.flags }),
      },
    };
  });
}

function semanticOutputChecks(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error("case semantic_output_checks must be an array");
  return value.map((entry, index) => {
    const check = record(entry, `semantic output check ${index + 1}`);
    keys(check, ["name", "proposition"], `semantic output check ${index + 1}`);
    string(check.name, `semantic output check ${index + 1} name`);
    return {
      id: `darrow.semantic.${index + 1}`,
      grader: "sevro.semantic",
      configuration: {
        proposition: string(
          check.proposition,
          `semantic output check ${index + 1} proposition`,
        ),
      },
    };
  });
}

function skillDirForSource(source: string): string | null {
  const parts = source.split("/");
  return parts.length === 7 &&
    parts[0] === "plugins" &&
    parts[3] === "skills" &&
    parts[5] === "evals" &&
    parts[6]?.endsWith(".yaml")
    ? parts.slice(0, 5).join("/")
    : null;
}

function checkNames(selected: RecordValue) {
  return [
    ...(selected.checks as RecordValue[]).map((check) => check.name),
    ...((selected.output_checks ?? []) as RecordValue[]).map(
      (check) => check.name,
    ),
    ...((selected.semantic_output_checks ?? []) as RecordValue[]).map(
      (check) => check.name,
    ),
  ];
}

function skillNames(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((name) => typeof name !== "string" || !name.trim())
  )
    throw new Error(`${label} must be a non-empty skill-name list`);
  return value as string[];
}

function caseActivationLists(selected: RecordValue) {
  const sequence = skillNames(
    selected.activation_sequence,
    "activation_sequence",
  );
  const includes = skillNames(
    selected.activation_includes,
    "activation_includes",
  );
  const excludes = skillNames(
    selected.activation_excludes,
    "activation_excludes",
  );
  return {
    ...(sequence ? { sequence } : {}),
    ...(includes ? { includes } : {}),
    ...(excludes ? { excludes } : {}),
  };
}

function validateActivationSequence(
  value: "positive" | "negative" | "competition",
  targetSkill: string,
  mountPluginSkills: boolean,
  sequence: string[] | undefined,
): void {
  if (sequence && (value === "negative" || sequence[0] !== targetSkill))
    throw new Error(
      "activation_sequence must start with a positive owning skill",
    );
  if (sequence && sequence.length > 1 && !mountPluginSkills)
    throw new Error(
      "composed activation_sequence requires sibling skill mounts",
    );
}

function validateActivationClass(
  value: unknown,
  targetSkill: string,
  mountPluginSkills: boolean,
  sequence: string[] | undefined,
): asserts value is "positive" | "negative" | "competition" {
  if (value !== "positive" && value !== "negative" && value !== "competition")
    throw new Error("case uses an unsupported activation class");
  if (value === "competition" && !mountPluginSkills)
    throw new Error("competition activation requires sibling skill mounts");
  validateActivationSequence(value, targetSkill, mountPluginSkills, sequence);
}

function caseActivation(
  selected: RecordValue,
  skillDir: string | null,
  mountPluginSkills: boolean,
) {
  const value = selected.activation;
  const lists = caseActivationLists(selected);
  if (value === undefined && Object.keys(lists).length)
    throw new Error("activation expectations require an activation class");
  if (value === undefined) return {};
  if (!skillDir)
    throw new Error("activation requires a colocated owning skill");
  const targetSkill = skillDir.split("/").at(-1)!;
  validateActivationClass(
    value,
    targetSkill,
    mountPluginSkills,
    lists.sequence,
  );
  return {
    activation: { class: value, targetSkill, ...lists },
  };
}

function caseMount(value: unknown, source: string, root: string) {
  const skillDir = skillDirForSource(source);
  if (value !== undefined && typeof value !== "boolean")
    throw new Error("mount_plugin_skills must be a boolean");
  const mountPluginSkills = value === true;
  if (mountPluginSkills && !skillDir)
    throw new Error("sibling skill mounts require a colocated owning skill");
  return {
    skillDir,
    mountPluginSkills,
    ...(skillDir
      ? {
          mount: {
            projectRoot: pathToFileURL(root).href,
            skillDir,
            mountPluginSkills,
          },
        }
      : {}),
  };
}

function casePrompt(value: unknown) {
  const prompt = string(value, "case prompt");
  if (prompt.includes("{{skill_invocation}}"))
    throw new Error("case needs a host-specific skill invocation");
  if (prompt.replaceAll("{{repo_dir}}", "").includes("{{"))
    throw new Error("case uses an unsupported prompt template");
  return prompt.replaceAll("{{repo_dir}}", "{{sevro.workspace}}");
}

const CASE_FIELDS = [
  "id",
  "invariant",
  "prompt",
  "fixture",
  "checks",
  "output_checks",
  "semantic_output_checks",
  "activation",
  "activation_sequence",
  "activation_includes",
  "activation_excludes",
  "mount_plugin_skills",
];

function neutralCase(value: unknown, source: string, root: string) {
  const selected = record(value, "case");
  keys(selected, CASE_FIELDS, "case");
  const id = string(selected.id, "case ID");
  const prompt = casePrompt(selected.prompt);
  const invariant = string(selected.invariant, "case invariant");
  const { fixture, ...setup } = caseFixture(selected.fixture);
  const { skillDir, mountPluginSkills, ...mount } = caseMount(
    selected.mount_plugin_skills,
    source,
    root,
  );
  const checks = [
    ...shellChecks(selected.checks),
    ...outputChecks(selected.output_checks),
    ...semanticOutputChecks(selected.semantic_output_checks),
  ];
  return {
    id,
    prompt,
    fixture,
    checks,
    requiredEvidence: [],
    extensionData: {
      "darrow.case": {
        invariant,
        source,
        projectRoot: pathToFileURL(root).href,
        ...setup,
        ...mount,
        ...caseActivation(selected, skillDir, mountPluginSkills),
        checkNames: checkNames(selected),
      },
    },
  };
}

const OMITTED_SKILL_ENTRIES = new Set([
  ".coverage",
  ".hypothesis",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  "__pycache__",
  "coverage.json",
  "evals",
]);

interface SkillArtifact {
  id: string;
  relativePath: string;
  sha256: string;
  contentBase64: string;
  gitExclude: true;
  executable?: true;
}

function portableName(name: string): boolean {
  return (
    name !== "." &&
    name !== ".." &&
    !name.includes(":") &&
    !name.includes("\\") &&
    ![...name].some((character) => {
      const code = character.codePointAt(0)!;
      return code < 32 || code === 127;
    })
  );
}

async function siblingSkillSources(root: string, skillRoot: string) {
  const siblings = await readdir(join(skillRoot, ".."), {
    withFileTypes: true,
  });
  const sources: { skillRoot: string; skillName: string }[] = [];
  for (const entry of siblings.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )) {
    if (entry.isSymbolicLink())
      throw new Error("sibling skill mount contains a symbolic link");
    if (!entry.isDirectory()) continue;
    if (!portableName(entry.name))
      throw new Error("sibling skill name is not a portable fixture path");
    const siblingRoot = await realpath(join(skillRoot, "..", entry.name));
    if (!within(root, siblingRoot))
      throw new Error("sibling skill mount escapes the project root");
    sources.push({ skillRoot: siblingRoot, skillName: entry.name });
  }
  return sources;
}

async function skillMountSource(details: RecordValue) {
  const mount = record(details.mount, "skill mount");
  const rootUrl = string(mount.projectRoot, "mount project root");
  if (!rootUrl.startsWith("file:///"))
    throw new Error("mount project root must be a file URL");
  const root = await realpath(fileURLToPath(rootUrl));
  const skillDir = string(mount.skillDir, "mount skill directory");
  if (skillDir !== skillDirForSource(string(details.source, "case source")))
    throw new Error("skill mount does not match the selected case");
  const skillRoot = await realpath(join(root, skillDir));
  if (!within(root, skillRoot) || !(await stat(skillRoot)).isDirectory())
    throw new Error("skill mount escapes the project root");
  const skillName = skillDir.split("/").at(-1)!;
  if (!portableName(skillName))
    throw new Error("skill name is not a portable fixture path");
  if (typeof mount.mountPluginSkills !== "boolean")
    throw new Error("skill mount must declare sibling selection");
  if (!mount.mountPluginSkills) return [{ skillRoot, skillName }];
  return siblingSkillSources(root, skillRoot);
}

function skillArtifact(
  bytes: Buffer,
  relativePath: string,
  index: number,
  executable: boolean,
): SkillArtifact {
  return {
    id: `darrow.skill.${index}`,
    relativePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    contentBase64: bytes.toString("base64"),
    gitExclude: true,
    ...(executable ? { executable: true } : {}),
  };
}

function checkSkillArtifactLimit(bytes: Buffer, total: number, count: number) {
  if (bytes.byteLength > 1024 * 1024 || total > 4 * 1024 * 1024 || count >= 128)
    throw new Error("skill mount exceeds the artifact limit");
}

async function skillArtifacts(
  sources: { skillRoot: string; skillName: string }[],
) {
  const artifacts: SkillArtifact[] = [];
  let totalBytes = 0;
  async function collect(
    skillRoot: string,
    skillName: string,
    directory: string,
    parts: string[],
  ): Promise<void> {
    const entries = (await readdir(directory, { withFileTypes: true })).sort(
      (left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      if (OMITTED_SKILL_ENTRIES.has(entry.name)) continue;
      if (!portableName(entry.name) || entry.isSymbolicLink())
        throw new Error("skill mount contains an unsafe entry");
      const next = [...parts, entry.name];
      const path = join(directory, entry.name);
      if (!within(skillRoot, await realpath(path)))
        throw new Error("skill mount escapes its source directory");
      if (entry.isDirectory()) {
        await collect(skillRoot, skillName, path, next);
        continue;
      }
      if (!entry.isFile()) throw new Error("skill mount contains a non-file");
      const bytes = await readFile(path);
      const executable = ((await stat(path)).mode & 0o111) !== 0;
      totalBytes += bytes.byteLength;
      checkSkillArtifactLimit(bytes, totalBytes, artifacts.length);
      const relativePath = [".agents", "skills", skillName, ...next].join("/");
      artifacts.push(
        skillArtifact(bytes, relativePath, artifacts.length + 1, executable),
      );
    }
  }
  for (const { skillRoot, skillName } of sources) {
    await collect(skillRoot, skillName, skillRoot, []);
    if (
      !artifacts.some(
        (artifact) =>
          artifact.relativePath === `.agents/skills/${skillName}/SKILL.md`,
      )
    )
      throw new Error("selected skill has no SKILL.md");
  }
  return artifacts;
}

async function caseSetup(details: RecordValue, caseId: string) {
  if (details.setupDigest === undefined) return null;
  const rootUrl = string(details.projectRoot, "case project root");
  if (!rootUrl.startsWith("file:///"))
    throw new Error("case project root must be a file URL");
  const root = await realpath(fileURLToPath(rootUrl));
  const source = string(details.source, "case source");
  if (
    isAbsolute(source) ||
    source.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("case source path is invalid");
  const path = await realpath(join(root, source));
  if (!within(root, path))
    throw new Error("case source escapes the project root");
  const selected = record(parseYaml(await readFile(path, "utf8")), "case");
  if (selected.id !== caseId)
    throw new Error("case source changed after resolution");
  const script = fixtureSetupScript(record(selected.fixture, "fixture"));
  const actualDigest = script
    ? createHash("sha256").update(script).digest("hex")
    : null;
  if (!script || actualDigest !== details.setupDigest)
    throw new Error("fixture setup changed after resolution");
  return {
    command: [
      "/bin/bash",
      "-c",
      script.replaceAll("{{case_dir}}", "$DARROW_EVAL_CASE_DIR"),
    ],
    environment: {
      DARROW_EVAL_CASE_DIR: `{{sevro.project}}/${dirname(source).split(sep).join("/")}`,
    },
  };
}

async function prepareCase(params: RecordValue) {
  const selected = record(params.case, "prepared case");
  const data = record(selected.extensionData, "case extension data");
  const details = record(data["darrow.case"], "Darrow case data");
  const setup = await caseSetup(details, string(selected.id, "case ID"));
  const sources =
    details.mount === undefined ? [] : await skillMountSource(details);
  if (details.activation !== undefined) {
    const expected = activationExpectation(details.activation);
    for (const skill of [
      expected.targetSkill,
      ...(expected.sequence ?? []),
      ...(expected.includes ?? []),
      ...(expected.excludes ?? []),
    ]) {
      if (!sources.some((source) => source.skillName === skill))
        throw new Error(
          `activation skill ${skill} is absent from the mounted set`,
        );
    }
  }
  const artifacts = await skillArtifacts(sources);
  return {
    artifacts,
    requestedInstrumentation: [],
    ...(setup ? { fixtureSetup: setup } : {}),
    extensionData: {},
  };
}

function within(root: string, path: string): boolean {
  const child = relative(root, path);
  return child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

export async function resolveCase(params: RecordValue) {
  const url = string(params.projectRoot, "project root");
  if (!url.startsWith("file:///"))
    throw new Error("project root must be a file URL");
  const root = await realpath(fileURLToPath(url));
  const selectors = record(params.selectors, "selectors");
  if (!Array.isArray(selectors.caseIds) || selectors.caseIds.length !== 1)
    throw new Error("resolve needs exactly one case ID");
  const target = string(selectors.caseIds[0], "selected case ID");
  const matches: { value: unknown; source: string }[] = [];
  for (const pattern of [
    "evals/experiments/*/cases/*.yaml",
    "plugins/*/*/skills/*/evals/*.yaml",
  ]) {
    const glob = new Bun.Glob(pattern);
    for await (const source of glob.scan({ cwd: root })) {
      const path = await realpath(join(root, source));
      if (!within(root, path))
        throw new Error("case path escapes the project root");
      const value = parseYaml(await readFile(path, "utf8")) as unknown;
      if (record(value, "case").id === target) matches.push({ value, source });
    }
  }
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? "selected case ID is ambiguous"
        : "selected case ID was not found",
    );
  return { cases: [neutralCase(matches[0]!.value, matches[0]!.source, root)] };
}

function activationExpectation(value: unknown) {
  const activation = record(value, "activation expectation");
  const activationClass = string(activation.class, "activation class");
  const targetSkill = string(activation.targetSkill, "activation target skill");
  if (
    activationClass !== "positive" &&
    activationClass !== "negative" &&
    activationClass !== "competition"
  )
    throw new Error("unsupported activation expectation");
  return {
    activationClass,
    targetSkill,
    sequence: skillNames(activation.sequence, "activation sequence"),
    includes: skillNames(activation.includes, "activation inclusion"),
    excludes: skillNames(activation.excludes, "activation exclusion"),
  };
}

function activationObservation(value: unknown): RecordValue | null {
  if (!Array.isArray(value))
    throw new Error("evaluation observations must be an array");
  const matches = value.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      (item.id === "darrow.activation" ||
        item.id === "sevro.codex.skill-reads"),
  );
  return matches.length === 1
    ? record(matches[0], "activation observation")
    : null;
}

function activationData(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function skillSequence(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((skill) => typeof skill === "string" && skill.length))
    return null;
  return value as string[];
}

function supportedActivationSource(
  observation: RecordValue,
  data: RecordValue,
): boolean {
  if (observation.id === "darrow.activation") return true;
  return (
    observation.id === "sevro.codex.skill-reads" &&
    observation.source === "sevro.host.codex" &&
    data.method === "skill_file_read_probe"
  );
}

function observedActivation(observation: RecordValue | null) {
  if (observation?.completeness !== "complete") return null;
  const data = activationData(observation.data);
  if (!data) return null;
  if (!supportedActivationSource(observation, data)) return null;
  const observedSkills = skillSequence(data.observedSkills);
  if (!observedSkills) return null;
  const primarySkill = data.primarySkill;
  if (primarySkill !== null && !nonemptyString(primarySkill)) return null;
  if (primarySkill !== (observedSkills[0] ?? null)) return null;
  return { primarySkill, observedSkills };
}

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function matchesSkillExpectations(
  expected: ReturnType<typeof activationExpectation>,
  observedSkills: string[],
) {
  const sequencePassed =
    expected.sequence?.every(
      (skill, index) => observedSkills[index] === skill,
    ) ?? true;
  const includesPassed =
    expected.includes?.every((skill) => observedSkills.includes(skill)) ?? true;
  const excludesPassed =
    expected.excludes?.every((skill) => !observedSkills.includes(skill)) ??
    true;
  return sequencePassed && includesPassed && excludesPassed;
}

function activationStatus(
  expected: ReturnType<typeof activationExpectation>,
  observed: ReturnType<typeof observedActivation>,
) {
  if (!observed) return "unavailable";
  const selected = observed.primarySkill === expected.targetSkill;
  const primaryPassed = (expected.activationClass !== "negative") === selected;
  return primaryPassed &&
    matchesSkillExpectations(expected, observed.observedSkills)
    ? "passed"
    : "failed";
}

function activationOutcomeData(
  expected: ReturnType<typeof activationExpectation>,
  observation: RecordValue | null,
  observed: ReturnType<typeof observedActivation>,
) {
  return {
    class: expected.activationClass,
    targetSkill: expected.targetSkill,
    ...(expected.sequence ? { expectedSkills: expected.sequence } : {}),
    ...(expected.includes ? { requiredSkills: expected.includes } : {}),
    ...(expected.excludes ? { excludedSkills: expected.excludes } : {}),
    source: observation?.source ?? null,
    primarySkill: observed?.primarySkill ?? null,
    observedSkills: observed?.observedSkills ?? [],
  };
}

function evaluateCase(params: RecordValue) {
  const extensionData = record(
    params.extensionData,
    "evaluation extension data",
  );
  const details = record(extensionData["darrow.case"], "Darrow case data");
  if (details.activation === undefined)
    return { checks: [], metrics: [], domainOutcomes: [] };
  const expected = activationExpectation(details.activation);
  const observation = activationObservation(params.observations);
  const observed = observedActivation(observation);
  const status = activationStatus(expected, observed);
  return {
    checks: [],
    metrics: [],
    domainOutcomes: [
      {
        id: "darrow.evals.activation",
        status,
        evidenceRefs: observation
          ? [string(observation.id, "activation evidence ID")]
          : [],
        detail: observed
          ? "Activation graded from complete host observation"
          : "Activation observation unavailable or incomplete",
        data: activationOutcomeData(expected, observation, observed),
      },
    ],
  };
}

if (import.meta.main) {
  const requestText = await Bun.stdin.text();
  if (Buffer.byteLength(requestText, "utf8") > 8 * 1024 * 1024)
    throw new Error("extension request is too large");
  const request = record(JSON.parse(requestText) as unknown, "request");
  const id = string(request.id, "request ID");
  const method = string(request.method, "request method");
  const protocol =
    method === "describe" ? "sevro.discovery.v1" : "sevro.extension.v1";
  if (request.protocol !== protocol)
    throw new Error("extension protocol mismatch");
  let response: RecordValue;
  try {
    const params = record(request.params, "request params");
    const result =
      method === "describe"
        ? {
            extension: { id: "darrow.evals", version: "0.1.0" },
            protocols: ["sevro.extension.v1"],
            requiredCapabilities: ["sevro.host.exec"],
            optionalCapabilities: ["sevro.fixture.setup"],
            graders: [],
            taskVerdictPolicies: [],
          }
        : method === "resolve"
          ? await resolveCase(params)
          : method === "prepare"
            ? await prepareCase(params)
            : method === "evaluate"
              ? evaluateCase(params)
              : (() => {
                  throw new Error("unsupported extension method");
                })();
    response = { protocol, id, method, result };
  } catch (error) {
    response = {
      protocol,
      id,
      method,
      error: {
        code: "darrow.extension.invalid",
        message: (error instanceof Error
          ? error.message
          : "extension failed"
        ).slice(0, 4096),
      },
    };
  }
  process.stdout.write(JSON.stringify(response));
}
