import type { Check, CheckResult, OutputCheck, TranscriptCheck } from "./types";
import { join, resolve } from "node:path";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isDeepStrictEqual } from "node:util";
import { validateExternalSchema } from "./schema";
import { isolatedCheckEnvironment } from "./environment";
import { sandboxedCommand } from "./sandbox";
import { throwIfInterrupted, trackEvaluationProcess } from "./run-control";

function jsonPointer(value: unknown, pointer: string): unknown {
  if (pointer === "") return value;
  if (!pointer.startsWith("/"))
    throw new Error("JSON pointer must start with /");
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce<unknown>((current, part) => {
      if (!current || typeof current !== "object" || !(part in current))
        throw new Error(`JSON pointer does not resolve: ${pointer}`);
      return (current as Record<string, unknown>)[part];
    }, value);
}

function containsSubset(value: unknown, subset: unknown): boolean {
  if (Array.isArray(subset)) {
    return (
      Array.isArray(value) &&
      subset.every((expected) =>
        value.some((actual) => containsSubset(actual, expected)),
      )
    );
  }
  if (subset && typeof subset === "object") {
    const regex = (subset as Record<string, unknown>).$regex;
    if (Object.keys(subset).length === 1 && typeof regex === "string") {
      return typeof value === "string" && new RegExp(regex).test(value);
    }
    return (
      !!value &&
      typeof value === "object" &&
      Object.entries(subset).every(([key, expected]) =>
        containsSubset((value as Record<string, unknown>)[key], expected),
      )
    );
  }
  return Object.is(value, subset);
}

/** "m" is always applied; a case may add flags such as "i". */
function regexFlags(check: { flags?: string }): string {
  return "m" + (check.flags ?? "");
}

type RegexCheck = {
  name: string;
  expect_regex?: string;
  not_regex?: string;
  after_regex?: string;
  flags?: string;
};

/** Compile declared patterns before an eval spends a harness call on them. */
export function validateRegexChecks(
  checks: RegexCheck[],
  scope: string,
): string[] {
  const failures: string[] = [];
  for (const check of checks) {
    for (const field of ["expect_regex", "not_regex", "after_regex"] as const) {
      const pattern = check[field];
      if (pattern === undefined) continue;
      try {
        const flags =
          field === "after_regex"
            ? regexFlags(check).replaceAll("g", "") + "g"
            : regexFlags(check);
        new RegExp(pattern, flags);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        failures.push(`${scope} ${check.name}: invalid ${field}: ${detail}`);
      }
    }
  }
  return failures;
}

interface OutputContext {
  text: string;
  parsed: unknown;
  parseFailed: boolean;
  exactJsonDocument: boolean;
  schemaBaseDir: string;
}

interface ParsedJsonDocument {
  value: unknown;
  exact: boolean;
}

/** Parse raw JSON or one JSON fence a host may add around the semantic payload. */
function parseJsonDocument(text: string): ParsedJsonDocument {
  try {
    return { value: JSON.parse(text), exact: true };
  } catch {
    const fences = [...text.matchAll(/```json[ \t]*\r?\n([\s\S]*?)\r?\n```/gi)];
    if (fences.length !== 1) throw new Error("not one JSON document");
    const fenced = fences[0]!;
    return {
      value: JSON.parse(fenced[1]!),
      exact: text.trim() === fenced[0],
    };
  }
}

/**
 * One assertion kind. Returns the failure detail, or undefined when the check
 * still holds — including when the case does not request this assertion.
 */
type OutputStage = (
  context: OutputContext,
  check: OutputCheck,
) => string | undefined | Promise<string | undefined>;

function needsJson(check: OutputCheck): boolean {
  return (
    !!check.valid_json ||
    check.schema !== undefined ||
    check.json_path !== undefined
  );
}

const validJsonStage: OutputStage = (context, check) =>
  needsJson(check) && context.parseFailed
    ? "final message is not valid JSON"
    : check.valid_json && !context.exactJsonDocument
      ? "final message is not valid JSON"
      : undefined;

const schemaStage: OutputStage = async (context, check) => {
  if (check.schema === undefined) return undefined;
  try {
    await validateExternalSchema(
      resolve(context.schemaBaseDir, check.schema),
      context.parsed,
      "final message",
    );
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "schema validation failed";
  }
};

function jsonValueFailure(
  check: OutputCheck,
  selected: unknown,
): string | undefined {
  if (
    check.expect_json !== undefined &&
    !isDeepStrictEqual(selected, check.expect_json)
  ) {
    return `JSON value at ${check.json_path} did not equal the expectation`;
  }
  if (
    check.contains_json !== undefined &&
    (!Array.isArray(selected) ||
      !selected.some((item) => containsSubset(item, check.contains_json)))
  ) {
    return `JSON array at ${check.json_path} did not contain the expected item`;
  }
  return undefined;
}

const jsonPathStage: OutputStage = (context, check) => {
  if (check.json_path === undefined) return undefined;
  try {
    return jsonValueFailure(
      check,
      jsonPointer(context.parsed, check.json_path),
    );
  } catch (error) {
    return error instanceof Error ? error.message : "JSON assertion failed";
  }
};

const expectExactStage: OutputStage = (context, check) =>
  check.expect_exact === undefined || context.text === check.expect_exact
    ? undefined
    : `expect_exact ${JSON.stringify(check.expect_exact)} missed`;

const expectRegexStage: OutputStage = (context, check) =>
  check.expect_regex === undefined ||
  new RegExp(check.expect_regex, regexFlags(check)).test(context.text)
    ? undefined
    : `expect_regex /${check.expect_regex}/ missed`;

const notRegexStage: OutputStage = (context, check) =>
  check.not_regex === undefined ||
  !new RegExp(check.not_regex, regexFlags(check)).test(context.text)
    ? undefined
    : `not_regex /${check.not_regex}/ matched`;

/** Order is significant: a JSON parse or schema failure must be reported
 *  instead of the downstream text assertions it would also break. */
const outputStages: OutputStage[] = [
  validJsonStage,
  schemaStage,
  jsonPathStage,
  expectExactStage,
  expectRegexStage,
  notRegexStage,
];

async function textCheck(
  context: OutputContext,
  check: OutputCheck,
): Promise<CheckResult> {
  for (const stage of outputStages) {
    const failure = await stage(context, check);
    if (failure !== undefined) {
      return {
        name: check.name,
        passed: false,
        detail: failure,
        metric: check.metric,
      };
    }
  }
  return { name: check.name, passed: true, detail: "ok", metric: check.metric };
}

export function runOutputChecks(
  resultText: string,
  checks: OutputCheck[],
  schemaBaseDir = ".",
): Promise<CheckResult[]> {
  let parsed: unknown;
  let parseFailed = false;
  let exactJsonDocument = false;
  if (checks.some(needsJson)) {
    try {
      const document = parseJsonDocument(resultText);
      parsed = document.value;
      exactJsonDocument = document.exact;
    } catch {
      parseFailed = true;
    }
  }
  const context: OutputContext = {
    text: resultText,
    parsed,
    parseFailed,
    exactJsonDocument,
    schemaBaseDir,
  };
  return Promise.all(checks.map((check) => textCheck(context, check)));
}

function transcriptSuffix(
  transcript: string,
  check: TranscriptCheck,
): string | undefined {
  if (check.after_regex === undefined) return transcript;
  const flags = regexFlags(check).replaceAll("g", "") + "g";
  const boundary = new RegExp(check.after_regex, flags);
  let suffix: string | undefined;
  for (const match of transcript.matchAll(boundary)) {
    suffix = transcript.slice((match.index ?? 0) + match[0].length);
  }
  return suffix;
}

/** Apply hidden assertions to raw harness evidence, optionally after the final
 * occurrence of a protocol boundary such as the terminal review response. */
export async function runTranscriptChecks(
  transcript: string,
  checks: TranscriptCheck[],
): Promise<CheckResult[]> {
  return Promise.all(
    checks.map(async ({ after_regex, ...check }) => {
      const scoped = transcriptSuffix(transcript, { after_regex, ...check });
      if (scoped === undefined) {
        return {
          name: check.name,
          passed: false,
          detail: `after_regex /${after_regex}/ missed`,
          metric: check.metric,
        };
      }
      return (await runOutputChecks(scoped, [check]))[0]!;
    }),
  );
}

interface CommandOutcome {
  out: string;
  err: string;
  code: number;
}

async function runCommand(
  repoDir: string,
  command: string,
  environment: Record<string, string>,
  profileDir: string,
): Promise<CommandOutcome> {
  const credentialPaths = ["codex", "claude"].flatMap((harness) =>
    ["auth.json", ".credentials.json"].map((name) =>
      join(repoDir, ".git", "darrow-eval", "state", harness, "config", name),
    ),
  );
  const argv = await sandboxedCommand(
    ["/bin/sh", "-e", "-c", command],
    repoDir,
    {
      writeDeniedPaths: [
        join(repoDir, ".git", "retained-harness.jsonl"),
        join(profileDir, "sh.sb"),
      ],
      profileDir,
      deniedPaths: credentialPaths,
    },
  );
  throwIfInterrupted();
  const proc = trackEvaluationProcess(
    Bun.spawn(argv, {
      detached: true,
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
      env: environment,
    }),
  );
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { out, err, code };
}

/** First failing stdout assertion, or undefined when stdout satisfies them all. */
function commandOutputFailure(check: Check, out: string): string | undefined {
  if (check.expect_exact !== undefined) {
    const actual = out.endsWith("\n") ? out.slice(0, -1) : out;
    if (actual !== check.expect_exact) {
      return `expect_exact ${JSON.stringify(check.expect_exact)} missed:\n${JSON.stringify(actual)}`;
    }
  }
  if (
    check.expect_regex !== undefined &&
    !new RegExp(check.expect_regex, regexFlags(check)).test(out)
  ) {
    return `expect_regex /${check.expect_regex}/ missed:\n${out.trim()}`;
  }
  if (
    check.not_regex !== undefined &&
    new RegExp(check.not_regex, regexFlags(check)).test(out)
  ) {
    return `not_regex /${check.not_regex}/ matched:\n${out.trim()}`;
  }
  return undefined;
}

async function runOneCheck(
  repoDir: string,
  check: Check,
  environment: Record<string, string>,
  profileDir: string,
): Promise<CheckResult> {
  const { out, err, code } = await runCommand(
    repoDir,
    check.run,
    environment,
    profileDir,
  );
  const expectedCode = check.exit_code ?? 0;
  if (code !== expectedCode) {
    const processOutput = [out.trim(), err.trim()].filter(Boolean).join("\n");
    return {
      name: check.name,
      passed: false,
      detail: `exit=${code} (expected ${expectedCode}): ${processOutput}`,
      metric: check.metric,
    };
  }
  const failure = commandOutputFailure(check, out);
  return {
    name: check.name,
    passed: failure === undefined,
    detail: failure ?? "ok",
    metric: check.metric,
  };
}

export async function runChecks(
  repoDir: string,
  checks: Check[],
  environment: Record<string, string> = {},
): Promise<CheckResult[]> {
  if (!checks.length) return [];
  // Keep evaluator-owned shell state outside candidate-controlled paths.
  const stateRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-grading-")),
  );
  try {
    const canonicalRepo = await realpath(repoDir);
    const env = await isolatedCheckEnvironment(
      canonicalRepo,
      stateRoot,
      environment,
    );
    const results: CheckResult[] = [];
    for (const check of checks) {
      results.push(await runOneCheck(canonicalRepo, check, env, stateRoot));
    }
    return results;
  } finally {
    await rm(stateRoot, { recursive: true, force: true });
  }
}
