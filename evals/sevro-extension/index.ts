#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
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
  keys(fixture, ["commits", "files", "staged", "commit_files"], "fixture");
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
    kind: "generated",
    commits,
    ...fixtureOverlay(fixture),
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

function neutralCase(value: unknown, source: string, root: string) {
  const selected = record(value, "case");
  keys(
    selected,
    [
      "id",
      "invariant",
      "prompt",
      "fixture",
      "checks",
      "output_checks",
      "semantic_output_checks",
    ],
    "case",
  );
  const id = string(selected.id, "case ID");
  const prompt = string(selected.prompt, "case prompt");
  if (prompt.includes("{{skill_invocation}}"))
    throw new Error("case needs a host-specific skill invocation");
  if (/\{\{[a-z_]+\}\}/.test(prompt))
    throw new Error("case uses an unsupported prompt template");
  const invariant = string(selected.invariant, "case invariant");
  const skillDir = skillDirForSource(source);
  const checks = [
    ...shellChecks(selected.checks),
    ...outputChecks(selected.output_checks),
    ...semanticOutputChecks(selected.semantic_output_checks),
  ];
  return {
    id,
    prompt,
    fixture: generatedFixture(selected.fixture),
    checks,
    requiredEvidence: [],
    extensionData: {
      "darrow.case": {
        invariant,
        source,
        ...(skillDir
          ? { mount: { projectRoot: pathToFileURL(root).href, skillDir } }
          : {}),
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
  return { skillRoot, skillName };
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

async function skillArtifacts(skillRoot: string, skillName: string) {
  const artifacts: SkillArtifact[] = [];
  let totalBytes = 0;
  async function collect(directory: string, parts: string[]): Promise<void> {
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
        await collect(path, next);
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
  await collect(skillRoot, []);
  if (
    !artifacts.some(
      (artifact) =>
        artifact.relativePath === `.agents/skills/${skillName}/SKILL.md`,
    )
  )
    throw new Error("selected skill has no SKILL.md");
  return artifacts;
}

async function prepareCase(params: RecordValue) {
  const selected = record(params.case, "prepared case");
  const data = record(selected.extensionData, "case extension data");
  const details = record(data["darrow.case"], "Darrow case data");
  if (details.mount === undefined)
    return { artifacts: [], requestedInstrumentation: [], extensionData: {} };
  const { skillRoot, skillName } = await skillMountSource(details);
  const artifacts = await skillArtifacts(skillRoot, skillName);
  return { artifacts, requestedInstrumentation: [], extensionData: {} };
}

function within(root: string, path: string): boolean {
  const child = relative(root, path);
  return child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

async function resolveCase(params: RecordValue) {
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
          optionalCapabilities: [],
          graders: [],
          taskVerdictPolicies: [],
        }
      : method === "resolve"
        ? await resolveCase(params)
        : method === "prepare"
          ? await prepareCase(params)
          : method === "evaluate"
            ? { checks: [], metrics: [] }
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
