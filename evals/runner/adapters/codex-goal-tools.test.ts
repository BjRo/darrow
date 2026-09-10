import { expect, test } from "bun:test";
import { retainedCodexEvidence } from "./codex";

function evidence(payloads: object[]): string {
  return retainedCodexEvidence("", "/tmp/eval", {
    exitCode: 0,
    stderrPresent: false,
    nativeSession: payloads
      .map((payload, ordinal) => JSON.stringify({ ordinal, payload }))
      .join("\n"),
  });
}

function observations(payloads: object[]) {
  return evidence(payloads)
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === "darrow.codex_native_goal_control");
}

test("retains a direct goal-control attempt without arguments or result claims", () => {
  const payloads = [
    {
      type: "function_call",
      namespace: "functions",
      name: "create_goal",
      arguments: '{"objective":"private objective"}',
    },
    { type: "function_call_output", output: "private result" },
  ];
  expect(observations(payloads)).toEqual([
    {
      type: "darrow.codex_native_goal_control",
      ordinal: 0,
      tool: "create_goal",
      source: "native_function_call",
      evidence: "invocation_attempt",
      outcome: "unverified",
    },
  ]);
  expect(evidence(payloads)).not.toContain("private");
});

test("retains goal call expressions inside native exec without claiming execution", () => {
  const payloads = [
    {
      type: "custom_tool_call",
      name: "exec",
      input:
        'const r = await tools.create_goal({objective: "private objective"}); text(r);',
    },
  ];
  expect(observations(payloads)).toEqual([
    {
      type: "darrow.codex_native_goal_control",
      ordinal: 0,
      tool: "create_goal",
      source: "submitted_exec_code",
      evidence: "call_expression_reference",
      outcome: "unverified",
    },
  ]);
  expect(evidence(payloads)).not.toContain("private");
  expect(evidence(payloads)).not.toContain("text(r)");
});

test("code references remain references even in dead or deferred code", () => {
  const found = observations([
    {
      type: "custom_tool_call",
      name: "exec",
      input: `
        if (false) await tools.create_goal({objective: "private"});
        const later = () => tools["update_goal"]({status: "complete"});
        await tools.get_goal({});
        await tools.get_goal({});
      `,
    },
  ]);
  expect(found.map((event) => event.tool)).toEqual([
    "create_goal",
    "update_goal",
    "get_goal",
  ]);
  expect(
    found.every((event) => event.evidence === "call_expression_reference"),
  ).toBeTrue();
  expect(found.every((event) => event.outcome === "unverified")).toBeTrue();
});

test("does not treat quoted, commented, unrelated, or aliased text as observed goal calls", () => {
  expect(
    observations([
      {
        type: "custom_tool_call",
        name: "exec",
        input: `
        // tools.create_goal({});
        const example = 'tools.create_goal({})';
        const template = \`tools.create_goal({})\`;
        unrelated.create_goal({});
        const alias = tools.create_goal;
        alias({});
      `,
      },
      { type: "function_call", namespace: "unrelated", name: "create_goal" },
      { type: "function_call", namespace: "functions", name: "private_name" },
      {
        type: "custom_tool_call",
        name: "other",
        input: "tools.create_goal({})",
      },
      { type: "custom_tool_call", name: "exec", input: "gAAAAABencrypted" },
    ]),
  ).toEqual([]);
});
