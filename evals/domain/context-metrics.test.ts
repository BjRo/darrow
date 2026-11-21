import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  contextMetricsCheck,
  contextMetricsPolicy,
  contextMetricsOutcomes,
} from "../sevro-extension/context-metrics";
import { fixtureExtensionRequest } from "./fixture-command";

const finalId = "sevro.observation.final-message";
const shellId = "sevro.observation.shell.darrow.shell.1";
const policy = contextMetricsPolicy({
  checks: [{ name: "metrics", expect_regex: "^codex" }],
  output_checks: [{ name: "reported metrics", context_metrics: "metrics" }],
});
const text = `Codex bytes: before 449 bytes; after 320 bytes
Codex tokens: before 113 ~tokens; after 80 ~tokens
Claude bytes: before 49 bytes; after 49 bytes
Claude tokens: before 13 ~tokens; after 13 ~tokens`;
const bytes = "codex 449 113 320 80\nclaude 49 13 49 13\n";
const final = {
  id: finalId,
  source: "sevro.host.codex",
  completeness: "complete",
  data: { text },
};
const canonical = {
  id: shellId,
  source: "sevro.shell",
  completeness: "complete",
  data: {
    exitCode: 0,
    expectedExitCode: 0,
    stdoutSha256: createHash("sha256").update(bytes).digest("hex"),
    stdoutByteLength: Buffer.byteLength(bytes),
  },
};
const grade = (observations: unknown) =>
  contextMetricsOutcomes(policy.details.contextMetricsChecks, observations)[0]!
    .status;

test("reported runtime metrics match independently captured bytes and tokens", () => {
  for (const response of [text, text.replace(/tokens:/g, "**tokens:**")])
    expect(grade([{ ...final, data: { text: response } }, canonical])).toBe(
      "passed",
    );
  for (const response of [
    text.replace("320 bytes", "319 bytes"),
    text.replace("13 ~tokens", "12 ~tokens"),
    text.replace(
      "Claude bytes: before 49 bytes; after 49 bytes",
      "Claude unchanged",
    ),
    text + "\nCodex bytes: before 449 bytes; after 320 bytes",
    "",
  ])
    expect(grade([{ ...final, data: { text: response } }, canonical])).toBe(
      "failed",
    );
});

test("missing, duplicated, foreign, partial or failed metric evidence is unavailable", () => {
  for (const observations of [
    [],
    [final],
    [canonical],
    [final, final, canonical],
    [final, canonical, canonical],
    [{ ...final, completeness: "partial" }, canonical],
    [{ ...final, source: "other.host" }, canonical],
    [final, { ...canonical, completeness: "partial" }],
    [final, { ...canonical, source: "other.shell" }],
    [final, { ...canonical, data: { ...canonical.data, exitCode: 1 } }],
    [
      final,
      { ...canonical, data: { ...canonical.data, stdoutSha256: "invalid" } },
    ],
    [final, { ...canonical, data: { ...canonical.data, stdoutByteLength: 0 } }],
  ])
    expect(grade(observations)).toBe("unavailable");
});

test("metric declarations bind exactly one successful capturing check", () => {
  for (const entry of [
    { context_metrics: true },
    { context_metrics: "" },
    { context_metrics: "metrics", expect_regex: "other" },
  ])
    expect(() => contextMetricsCheck(entry, 0)).toThrow();
  for (const checks of [
    [],
    [{ name: "metrics" }],
    [{ name: "metrics", expect_regex: "^", exit_code: 1 }],
    [
      { name: "metrics", expect_regex: "^" },
      { name: "metrics", expect_regex: "^" },
    ],
  ])
    expect(() =>
      contextMetricsPolicy({
        checks,
        output_checks: [{ context_metrics: "metrics" }],
      }),
    ).toThrow();
});

test("the public extension binds the canonical IA metrics to the final response", async () => {
  const resolved = await fixtureExtensionRequest<{
    cases: {
      extensionData: Record<string, unknown>;
      requiredEvidence: string[];
    }[];
  }>("resolve", {
    projectRoot: new URL("../../", import.meta.url).href,
    selectors: {
      caseIds: ["doctor-information-architecture-trim-derived-keep-contracts"],
    },
    configuration: {},
  });
  const selected = resolved.cases[0]!;
  const id = "sevro.observation.shell.darrow.shell.8";
  expect(selected.requiredEvidence).toContain(id);
  const result = await fixtureExtensionRequest<{
    checks: { id: string; status: string }[];
  }>("evaluate", {
    extensionData: selected.extensionData,
    observations: [final, { ...canonical, id }],
    configuration: { withoutSkill: true },
  });
  expect(
    result.checks.find((check) => check.id === "darrow.evals.context-metrics.1")
      ?.status,
  ).toBe("passed");
});
