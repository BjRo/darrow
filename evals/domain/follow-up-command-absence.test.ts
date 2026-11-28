import { expect, test } from "bun:test";
import { nativeTranscriptOutcomes } from "../sevro-extension/native-transcript-policy";
import { transcriptPolicy } from "../sevro-extension/transcript-policy";

const preflight =
  "uv run --quiet /plugin/backend/scripts/run_locked.py adaptive-goal-preflight prepare";

function claudeTurn(command?: string) {
  return [
    { type: "system", subtype: "init", session_id: "root" },
    ...(command
      ? [
          {
            type: "assistant",
            message: {
              content: [{ type: "tool_use", name: "Bash", input: { command } }],
            },
          },
        ]
      : []),
    { type: "result", subtype: "success", is_error: false, session_id: "root" },
  ]
    .map((value) => JSON.stringify(value))
    .join("\n");
}

function codexTurn(command?: string) {
  return [
    { type: "turn.started" },
    ...(command
      ? [
          {
            type: "item.completed",
            item: { type: "command_execution", command },
          },
        ]
      : []),
    { type: "turn.completed" },
  ]
    .map((value) => JSON.stringify(value))
    .join("\n");
}

const [check] = transcriptPolicy([
  {
    name: "the follow-up turn runs no second preflight",
    kind: "command-absence",
    turn: "follow-up",
    forbiddenCommandTerms: ["adaptive-goal-preflight"],
  },
]);

function grade(host: "claude" | "codex", initial: string, followUp: unknown) {
  return nativeTranscriptOutcomes([check as never], [], {
    events: initial,
    followUpEvents: followUp as string | null,
    eventId: `sevro.${host}.events`,
    skills: null,
    spawns: null,
    feedback: null,
    claudeTools: null,
    claudeNestedSkills: null,
    claudeCompletedRoutes: null,
  })[0]!;
}

test("follow-up command absence parses only the follow-up turn scope", () => {
  expect(check).toMatchObject({ kind: "command-absence", turn: "follow-up" });
  expect(() =>
    transcriptPolicy([
      {
        name: "bad scope",
        kind: "command-absence",
        turn: "initial",
        forbiddenCommandTerms: ["adaptive-goal-preflight"],
      },
    ]),
  ).toThrow();
});

test.each([
  ["claude", claudeTurn],
  ["codex", codexTurn],
] as const)(
  "%s follow-up command absence ignores the initial turn's preflight",
  (host, turn) => {
    const initial = turn(preflight);
    const passed = grade(host, initial, turn("bash check.sh"));
    expect(passed.status).toBe("passed");
    expect(passed.evidenceRefs).toEqual([`sevro.${host}.follow-up-events`]);
    expect(grade(host, initial, turn(preflight)).status).toBe("failed");
    expect(grade(host, initial, null).status).toBe("unavailable");
  },
);
