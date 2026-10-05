import { expect, test } from "bun:test";
import { claudeNativeGoalEvidence } from "./claude-native-goal";
import { nativeGoalCheck } from "../native-goal";

const id = "original-session";
const result = JSON.stringify({
  type: "result",
  session_id: id,
  subtype: "success",
  is_error: false,
});
const row = (attachment?: object) =>
  JSON.stringify({
    sessionId: id,
    type: attachment ? "attachment" : "user",
    isSidechain: false,
    attachment,
  });
const active = {
  type: "goal_status",
  condition: "Requested outcome",
  met: false,
  sentinel: true,
};

test("Claude native activation and assessed completion are independently observed", () => {
  const transcript =
    row(active) + "\n" + row({ ...active, met: true, sentinel: false });
  const evidence = claudeNativeGoalEvidence(result, transcript, id);
  expect(evidence.goalStatus).toBe("complete");
  expect(nativeGoalCheck(JSON.stringify(evidence), "required").passed).toBe(
    true,
  );
});

test("a native sentinel clear cannot be mistaken for assessed success", () => {
  const evidence = claudeNativeGoalEvidence(
    result,
    row(active) + "\n" + row({ ...active, met: true }),
    id,
  );
  expect(evidence.goalStatus).toBe("cleared");
  expect(nativeGoalCheck(JSON.stringify(evidence), "required").passed).toBe(
    false,
  );
});

test("complete observation of no native goal supports a nonactivation case", () => {
  const evidence = claudeNativeGoalEvidence(result, row(), id);
  expect(nativeGoalCheck(JSON.stringify(evidence), "forbidden").passed).toBe(
    true,
  );
});

test.each([
  { transcript: "", stream: result },
  {
    transcript: row({ ...active, condition: "x".repeat(4001) }),
    stream: result,
  },
  {
    transcript: row(active),
    stream: result.replace('"is_error":false', '"is_error":true'),
  },
  { transcript: row(active).replace(id, "foreign-session"), stream: result },
])(
  "invalid native evidence is not a lifecycle success %#",
  ({ transcript, stream }) => {
    expect(() => claudeNativeGoalEvidence(stream, transcript, id)).toThrow();
  },
);
