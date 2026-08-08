import { describe, expect, test } from "bun:test";
import { isFinalAgentMessage, parseCodexGoalHandoff } from "./codex-goal";

const catalog = [
  { model: "gpt-5.6-terra", efforts: ["low", "medium"] },
  { model: "gpt-5.6-sol", efforts: ["medium", "high"] },
];

describe("Codex native-goal route handoff", () => {
  test("ignores commentary and accepts only the final answer", () => {
    const event = {
      method: "item/completed",
      params: {
        turnId: "turn-1",
        item: { type: "agentMessage", phase: "commentary" },
      },
    };
    expect(isFinalAgentMessage(event, "turn-1")).toBe(false);
    event.params.item.phase = "final_answer";
    expect(isFinalAgentMessage(event, "turn-1")).toBe(true);
    expect(isFinalAgentMessage(event, "turn-2")).toBe(false);
  });

  test("accepts only a concrete model and supported effort", () => {
    const handoff = JSON.stringify({
      format: "darrow-native-goal-handoff-v1",
      template: "bounded-change",
      profile: "standard",
      routeSource: "policy",
      selectedRoute: {
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        effort: "medium",
      },
      goalContract: "Implement the bounded change and run the focused test.",
    });
    expect(parseCodexGoalHandoff(handoff, catalog).selectedRoute).toEqual({
      harness: "codex",
      provider: "openai",
      model: "gpt-5.6-sol",
      effort: "medium",
    });
    expect(() =>
      parseCodexGoalHandoff(handoff.replace("gpt-5.6-sol", "inherit"), catalog),
    ).toThrow("unavailable selected model");
    expect(() =>
      parseCodexGoalHandoff(handoff.replace('"medium"', '"ultra"'), catalog),
    ).toThrow("unsupported selected effort");
    expect(() =>
      parseCodexGoalHandoff(
        handoff
          .replace('"bounded-change"', '"migration"')
          .replace('"standard"', '"deep"'),
        catalog,
      ),
    ).toThrow("does not match deep policy");
    const userOverride = handoff
      .replace('"bounded-change"', '"migration"')
      .replace('"standard"', '"deep"')
      .replace('"policy"', '"user"');
    expect(() => parseCodexGoalHandoff(userOverride, catalog)).toThrow(
      "no matching explicit user route",
    );
    expect(
      parseCodexGoalHandoff(userOverride, catalog, {
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        effort: "medium",
      }).routeSource,
    ).toBe("user");
  });
});
