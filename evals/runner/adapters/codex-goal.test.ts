import { describe, expect, test } from "bun:test";
import {
  buildPreparedGoalPrompt,
  goalDimensionStage,
  isFinalAgentMessage,
  parseCodexGoalHandoff,
  parsePreparedGoalDimensions,
} from "./codex-goal";

const catalog = [
  { model: "gpt-5.6-terra", efforts: ["low", "medium"] },
  { model: "gpt-5.6-sol", efforts: ["medium", "high"] },
];

const prepared = [
  "format\tdarrow-native-goal-prepared-v1",
  "route\tstandard\tcodex\topenai\tgpt-5.6-sol\tmedium",
  "workflow\tchange-feature\t/plugin/references/workflows/change-feature.md",
  "workflow\tmechanical\t/plugin/references/workflows/mechanical.md",
  "risk\troutine\tfocused acceptance and scoped gate",
  "risk\thigh\tcounterexample and adversarial boundary",
].join("\n");
const dimensions = parsePreparedGoalDimensions(prepared);

function handoffValue() {
  return {
    format: "darrow-native-goal-handoff-v3",
    workflow: "change-feature",
    risk: "high",
    profile: "deep",
    routeSource: "policy",
    selectedRoute: {
      harness: "codex",
      provider: "openai",
      model: "gpt-5.6-sol",
      effort: "high",
    },
    goalContract: [
      "Change the bounded stream behavior and run focused tests.",
      "format\tdarrow-native-goal-preflight-v4",
      "workflow\tchange-feature",
      "risk\thigh",
      "profile\tdeep",
      "selected_route\tcodex\topenai\tgpt-5.6-sol\thigh",
      "effective_route\tcodex\topenai\tgpt-5.6-sol\thigh",
      "route_applied_by\thost-api",
      "route_verified\ttrue",
      "launch_boundary\thost_api",
      "verification_gate\thigh",
      "evaluation_child_invocations\t0",
      "evaluation_human_interruptions\t0",
    ].join("\n"),
  };
}

describe("Codex native-goal dimension handoff", () => {
  test("recognizes only tab-separated ablation markers", () => {
    expect(goalDimensionStage("evaluation_dimension_stage\tworkflow\n")).toBe(
      "workflow",
    );
    expect(goalDimensionStage("evaluation_dimension_stage\\tworkflow\n")).toBe(
      "workflow-risk",
    );
  });

  test("builds incremental one-response classifier prompts", () => {
    const workflowOnly = buildPreparedGoalPrompt(
      "Implement the bounded stream change.",
      prepared,
      "workflow",
    );
    expect(workflowOnly).toContain("Do not call repository or shell tools");
    expect(workflowOnly).toContain("darrow-native-goal-handoff-v3");
    expect(workflowOnly).toContain("Select the workflow");
    expect(workflowOnly).toContain("set risk to routine");

    const withRisk = buildPreparedGoalPrompt(
      "Implement the bounded stream change.",
      prepared,
      "workflow-risk",
    );
    expect(withRisk).toContain("Select the workflow and proportional risk");
    expect(withRisk).toContain("verification_gate");
    expect(withRisk).not.toContain("technical reference");
  });

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

  test("accepts workflow, risk, and their concrete policy route", () => {
    const handoff = JSON.stringify(handoffValue());
    expect(
      parseCodexGoalHandoff(handoff, catalog, dimensions).selectedRoute,
    ).toEqual({
      harness: "codex",
      provider: "openai",
      model: "gpt-5.6-sol",
      effort: "high",
    });

    expect(() =>
      parseCodexGoalHandoff(
        handoff.replace('"high"', '"routine"'),
        catalog,
        dimensions,
      ),
    ).toThrow("goal contract does not preserve handoff");
    expect(() =>
      parseCodexGoalHandoff(
        handoff.replace('"change-feature"', '"unknown-workflow"'),
        catalog,
        dimensions,
      ),
    ).toThrow("unknown workflow");
    expect(() =>
      parseCodexGoalHandoff(
        handoff.replace('"deep"', '"standard"'),
        catalog,
        dimensions,
      ),
    ).toThrow("does not match high risk");
  });
});
