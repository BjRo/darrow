import { describe, expect, test } from "bun:test";
import { codexRunSucceeded } from "./codex";

describe("Codex terminal stream state", () => {
  test("accepts a recovered reconnect error followed by completion", () => {
    const stream = [
      JSON.stringify({ type: "error", message: "Reconnecting..." }),
      JSON.stringify({ type: "turn.completed" }),
    ].join("\n");
    expect(codexRunSucceeded(0, stream)).toBe(true);
    expect(
      codexRunSucceeded(
        0,
        JSON.stringify({ type: "event_msg", msg: { type: "turn.completed" } }),
      ),
    ).toBe(true);
  });

  test("rejects terminal failure, missing completion, and nonzero exit", () => {
    expect(codexRunSucceeded(0, JSON.stringify({ type: "turn.failed" }))).toBe(
      false,
    );
    expect(
      codexRunSucceeded(
        0,
        [
          JSON.stringify({ type: "turn.completed" }),
          JSON.stringify({ type: "event_msg", msg: { type: "turn.failed" } }),
        ].join("\n"),
      ),
    ).toBe(false);
    expect(codexRunSucceeded(0, JSON.stringify({ type: "error" }))).toBe(false);
    expect(
      codexRunSucceeded(1, JSON.stringify({ type: "turn.completed" })),
    ).toBe(false);
  });
});
