#!/usr/bin/env bun
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
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

function neutralCase(value: unknown, source: string) {
  const selected = record(value, "case");
  keys(selected, ["id", "invariant", "prompt", "fixture", "checks"], "case");
  const id = string(selected.id, "case ID");
  const prompt = string(selected.prompt, "case prompt");
  if (prompt.includes("{{skill_invocation}}"))
    throw new Error("case needs a host-specific skill invocation");
  const invariant = string(selected.invariant, "case invariant");
  const checks = shellChecks(selected.checks);
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
        checkNames: (selected.checks as RecordValue[]).map(
          (check) => check.name,
        ),
      },
    },
  };
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
  const glob = new Bun.Glob("evals/experiments/*/cases/*.yaml");
  for await (const source of glob.scan({ cwd: root })) {
    const path = await realpath(join(root, source));
    if (!within(root, path))
      throw new Error("case path escapes the project root");
    const value = parseYaml(await readFile(path, "utf8")) as unknown;
    if (record(value, "case").id === target) matches.push({ value, source });
  }
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? "selected case ID is ambiguous"
        : "selected case ID was not found",
    );
  return { cases: [neutralCase(matches[0]!.value, matches[0]!.source)] };
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
          ? { artifacts: [], requestedInstrumentation: [], extensionData: {} }
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
