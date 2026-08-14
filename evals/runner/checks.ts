import type { Check, CheckResult, OutputCheck } from "./types";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validateExternalSchema } from "./schema";
import { captureProcess } from "./process";

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

function globalRegexFlags(check: OutputCheck): string {
  return [...new Set((regexFlags(check) + "g").split(""))].join("");
}

const countRegexStage: OutputStage = (context, check) => {
  if (check.count_regex === undefined && check.expect_count === undefined)
    return undefined;
  if (
    check.count_regex === undefined ||
    !Number.isInteger(check.expect_count) ||
    check.expect_count! < 0
  )
    return "count_regex requires one non-negative integer expect_count";
  const actual = [
    ...context.text.matchAll(
      new RegExp(check.count_regex, globalRegexFlags(check)),
    ),
  ].length;
  return actual === check.expect_count
    ? undefined
    : `count_regex /${check.count_regex}/ matched ${actual}, expected ${check.expect_count}`;
};

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
  countRegexStage,
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

interface CommandOutcome {
  out: string;
  err: string;
  code: number;
}

async function runCommand(
  repoDir: string,
  command: string,
): Promise<CommandOutcome> {
  const proc = Bun.spawn(["sh", "-e", "-c", command], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const { out, err, code } = await captureProcess(proc);
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
): Promise<CheckResult> {
  const { out, err, code } = await runCommand(repoDir, check.run);
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
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    results.push(await runOneCheck(repoDir, check));
  }
  return results;
}
