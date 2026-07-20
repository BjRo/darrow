import type { Check, CheckResult, OutputCheck } from "./types";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validateExternalSchema } from "../../cli/src/schema";

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

async function textCheck(
  text: string,
  parsed: unknown,
  parseFailed: boolean,
  check: OutputCheck,
  schemaBaseDir: string,
): Promise<CheckResult> {
  let passed = true;
  let detail = "ok";
  const flags = "m" + (check.flags ?? "");
  const needsJson =
    check.valid_json ||
    check.schema !== undefined ||
    check.json_path !== undefined;
  if (needsJson && parseFailed) {
    passed = false;
    detail = "final message is not valid JSON";
  }
  if (passed && check.schema !== undefined) {
    try {
      await validateExternalSchema(
        resolve(schemaBaseDir, check.schema),
        parsed,
        "final message",
      );
    } catch (error) {
      passed = false;
      detail =
        error instanceof Error ? error.message : "schema validation failed";
    }
  }
  if (passed && check.json_path !== undefined) {
    try {
      const selected = jsonPointer(parsed, check.json_path);
      if (
        check.expect_json !== undefined &&
        !isDeepStrictEqual(selected, check.expect_json)
      ) {
        passed = false;
        detail = `JSON value at ${check.json_path} did not equal the expectation`;
      }
      if (
        passed &&
        check.contains_json !== undefined &&
        (!Array.isArray(selected) ||
          !selected.some((item) => containsSubset(item, check.contains_json)))
      ) {
        passed = false;
        detail = `JSON array at ${check.json_path} did not contain the expected item`;
      }
    } catch (error) {
      passed = false;
      detail = error instanceof Error ? error.message : "JSON assertion failed";
    }
  }
  if (passed && check.expect_exact !== undefined) {
    passed = text === check.expect_exact;
    if (!passed)
      detail = `expect_exact ${JSON.stringify(check.expect_exact)} missed`;
  }
  if (passed && check.expect_regex !== undefined) {
    passed = new RegExp(check.expect_regex, flags).test(text);
    if (!passed) detail = `expect_regex /${check.expect_regex}/ missed`;
  }
  if (passed && check.not_regex !== undefined) {
    passed = !new RegExp(check.not_regex, flags).test(text);
    if (!passed) detail = `not_regex /${check.not_regex}/ matched`;
  }
  return { name: check.name, passed, detail };
}

export function runOutputChecks(
  resultText: string,
  checks: OutputCheck[],
  schemaBaseDir = ".",
): Promise<CheckResult[]> {
  let parsed: unknown;
  let parseFailed = false;
  if (
    checks.some(
      (check) =>
        check.valid_json ||
        check.schema !== undefined ||
        check.json_path !== undefined,
    )
  ) {
    try {
      parsed = JSON.parse(resultText);
    } catch {
      parseFailed = true;
    }
  }
  return Promise.all(
    checks.map((check) =>
      textCheck(resultText, parsed, parseFailed, check, schemaBaseDir),
    ),
  );
}

export async function runChecks(
  repoDir: string,
  checks: Check[],
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    const proc = Bun.spawn(["sh", "-e", "-c", check.run], {
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const expectedCode = check.exit_code ?? 0;
    let passed = code === expectedCode;
    let detail = `exit=${code}`;

    const flags = "m" + (check.flags ?? "");
    if (passed && check.expect_exact !== undefined) {
      const actual = out.endsWith("\n") ? out.slice(0, -1) : out;
      passed = actual === check.expect_exact;
      if (!passed)
        detail = `expect_exact ${JSON.stringify(check.expect_exact)} missed:\n${JSON.stringify(actual)}`;
    }
    if (passed && check.expect_regex !== undefined) {
      passed = new RegExp(check.expect_regex, flags).test(out);
      if (!passed)
        detail = `expect_regex /${check.expect_regex}/ missed:\n${out.trim()}`;
    }
    if (passed && check.not_regex !== undefined) {
      passed = !new RegExp(check.not_regex, flags).test(out);
      if (!passed)
        detail = `not_regex /${check.not_regex}/ matched:\n${out.trim()}`;
    }
    if (code !== expectedCode)
      detail = `exit=${code} (expected ${expectedCode}): ${err.trim()}`;

    results.push({ name: check.name, passed, detail: passed ? "ok" : detail });
  }
  return results;
}
