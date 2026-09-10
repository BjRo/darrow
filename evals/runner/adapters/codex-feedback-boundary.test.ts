import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { retainedCodexEvidence } from "./codex";

const casePath = resolve(
  "plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/cross-turn-feedback-answer.yaml",
);
const evalCase = parse(readFileSync(casePath, "utf8"));
const ownerCheck = evalCase.transcript_checks.find((check: { name: string }) =>
  check.name.startsWith("one accepted owner"),
);
const ownerPattern = new RegExp(ownerCheck.expect_regex);

function proof(accepted: number, boundaries: unknown[]) {
  const payloads = [
    {
      ordinal: accepted - 3,
      payload: {
        type: "function_call",
        namespace: "collaboration",
        name: "spawn_agent",
        call_id: "owner-call",
        arguments: JSON.stringify({
          task_name: "migration_owner",
          model: "gpt-5.6-terra",
          reasoning_effort: "medium",
          fork_turns: "none",
          message: "private-contract-not-retained",
        }),
      },
    },
    {
      ordinal: accepted - 1,
      payload: {
        type: "item_completed",
        item: {
          type: "SubAgentActivity",
          id: "owner-call",
          kind: "started",
          agent_thread_id: "owner-thread",
          agent_path: "/root/migration_owner",
        },
      },
    },
    {
      ordinal: accepted,
      payload: {
        type: "function_call_output",
        call_id: "owner-call",
        output: JSON.stringify({ task_name: "/root/migration_owner" }),
      },
    },
  ];
  return retainedCodexEvidence(
    boundaries
      .map((ordinal) =>
        JSON.stringify({
          type: "darrow.eval.follow_up_turn",
          native_after_ordinal: ordinal,
        }),
      )
      .join("\n"),
    "/tmp/eval",
    {
      exitCode: 0,
      stderrPresent: false,
      nativeSession: payloads.map((entry) => JSON.stringify(entry)).join("\n"),
    },
  );
}

for (const [name, accepted, boundaries, expected] of [
  ["accepted before feedback", 32, [56], true],
  ["accepted at the last pre-feedback ordinal", 60, [60], true],
  // Observed failed-trial ordinals: boundary26, requested57, accepted60.
  ["first accepted after feedback", 60, [26], false],
  ["missing boundary", 32, [], null],
  ["duplicate boundary", 32, [56, 56], null],
  ["malformed boundary", 32, ["56"], null],
] as const) {
  test(`cross-turn owner timing: ${name}`, () => {
    const retained = proof(accepted, [...boundaries]);
    const owner = retained
      .split("\n")
      .map((line) => JSON.parse(line))
      .find(
        (event) => event.type === "darrow.codex_native_single_agent_accepted",
      );
    expect(owner).toBeDefined();
    expect(owner.accepted_before_follow_up).toBe(expected);
    expect(ownerPattern.test(retained)).toBe(expected === true);
    expect(retained).not.toContain("private-contract-not-retained");
  });
}

test("existing stream-based pre-feedback acceptance remains supported", () => {
  const complete = JSON.stringify({
    type: "darrow.goal_agent_completion",
    status: "completed",
    agent_id: "owner-1",
  });
  const boundary = JSON.stringify({ type: "darrow.eval.follow_up_turn" });
  expect(ownerPattern.test(`${complete}\n${boundary}`)).toBeTrue();
  expect(ownerPattern.test(`${boundary}\n${complete}`)).toBeFalse();
});
