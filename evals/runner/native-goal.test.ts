import { expect, test } from "bun:test";
import { nativeGoalCheck } from "./native-goal";

const evidence = {
  type: "darrow.eval.app_server",
  threadId: "original-thread",
  goals: [
    { status: "active", characters: 800, turnId: "turn-1", at: "first" },
    { status: "complete", characters: 800, turnId: "turn-2", at: "last" },
  ],
  goalStatus: "complete",
};
const raw = (value: unknown) => JSON.stringify(value) + "\n";

test("native main-thread goal accepts coordination and several bounded children", () => {
  const transcript =
    raw(evidence) +
    raw({ type: "darrow.codex_native_parent_tool_after_agent" }) +
    raw({
      type: "darrow.codex_native_spawn",
      status: "accepted",
      task_name: "implementation",
    }) +
    raw({
      type: "darrow.codex_native_spawn",
      status: "accepted",
      task_name: "verification",
    });
  expect(nativeGoalCheck(transcript, "required").passed).toBe(true);
});

test.each([
  "",
  "not-json\n",
  raw({ ...evidence, failure: "lost connection" }),
  raw({ ...evidence, threadId: "" }),
  raw({ ...evidence, goals: [{ status: "active", characters: 4001 }] }),
  raw({ ...evidence, goals: [] }),
  raw({ ...evidence, goalStatus: null }),
  raw(evidence) + raw(evidence),
])("missing or invalid native evidence fails closed: %s", (transcript) => {
  expect(nativeGoalCheck(transcript, "required").passed).toBe(false);
});

test("forbidden activation requires complete native observation", () => {
  expect(
    nativeGoalCheck(
      raw({ ...evidence, goals: [], goalStatus: null }),
      "forbidden",
    ).passed,
  ).toBe(true);
  expect(nativeGoalCheck(raw(evidence), "forbidden").passed).toBe(false);
  expect(nativeGoalCheck("", "forbidden").passed).toBe(false);
});

test("completion followed by another goal is not the same retained goal", () => {
  const restarted = {
    ...evidence,
    goals: [...evidence.goals, evidence.goals[0]],
  };
  expect(nativeGoalCheck(raw(restarted), "required").passed).toBe(false);
});
