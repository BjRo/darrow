import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildGoalExecutionPrompt,
  buildPreparedGoalPrompt,
  extractIntentRoutingGuidance,
  goalDimensionStage,
  isFinalAgentMessage,
  parseCodexGoalHandoff,
  parsePreparedGoalDimensions,
} from "./codex-goal";

const catalog = [
  { model: "gpt-5.6-luna", efforts: ["high", "xhigh"] },
  { model: "gpt-5.6-terra", efforts: ["low", "medium", "high"] },
  { model: "gpt-5.6-sol", efforts: ["medium", "high"] },
];

const prepared = [
  "format\tdarrow-native-goal-prepared-v1",
  "route\troutine\tcodex\topenai\tgpt-5.6-luna\thigh",
  "route\troutine-plus\tcodex\topenai\tgpt-5.6-luna\txhigh",
  "route\tscaled\tcodex\topenai\tgpt-5.6-terra\tmedium",
  "route\trepo-wide\tcodex\topenai\tgpt-5.6-terra\thigh",
  "route\tjudgment\tcodex\topenai\tgpt-5.6-sol\thigh",
  "workflow\tchange-feature\t/plugin/references/workflows/change-feature.md",
  "workflow\tmechanical\t/plugin/references/workflows/mechanical.md",
].join("\n");
const dimensions = parsePreparedGoalDimensions(prepared);

function handoffValue() {
  return {
    format: "darrow-native-goal-handoff-v3" as const,
    workflow: "change-feature" as const,
    risk: "high" as "routine" | "elevated" | "high",
    profile: "judgment",
    routeSource: "policy" as const,
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
      "profile\tjudgment",
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
  test("uses one marked parent-skill section as intent-routing guidance", () => {
    const guidance = extractIntentRoutingGuidance(`before
<!-- intent-routing-begin -->
Canonical workflow and risk triggers.
<!-- intent-routing-end -->
after`);
    expect(guidance).toBe("Canonical workflow and risk triggers.");

    const prompt = buildPreparedGoalPrompt(
      "Implement the bounded stream change.",
      prepared,
      guidance,
      "workflow-risk",
    );
    expect(
      prompt.match(/Canonical workflow and risk triggers\./g),
    ).toHaveLength(1);
    expect(() => extractIntentRoutingGuidance("no marked guidance")).toThrow(
      "intent-routing guidance",
    );

    const parentSkill = readFileSync(
      "plugins/darrow-goal-loop/skills/pursue-goal/SKILL.md",
      "utf8",
    );
    const canonicalGuidance = extractIntentRoutingGuidance(parentSkill);
    for (const gate of [
      "| `routine` | focused acceptance or characterization evidence plus the scoped repository gate |",
      "| `elevated` | routine gates plus affected-caller or compatibility checks and one plausible counterexample |",
      "| `high` | elevated gates plus an adversarial boundary or state-transition check and broader final-tree review |",
    ])
      expect(canonicalGuidance).toContain(gate);
  });

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
      "Canonical workflow and risk triggers.",
      "workflow",
    );
    expect(workflowOnly).toContain("Do not call repository or shell tools");
    expect(workflowOnly).toContain("darrow-native-goal-handoff-v3");
    expect(workflowOnly).toContain("Select the workflow");
    expect(workflowOnly).toContain("set risk to routine");

    const withRisk = buildPreparedGoalPrompt(
      "Implement the bounded stream change.",
      prepared,
      "Canonical workflow and risk triggers.",
      "workflow-risk",
    );
    expect(withRisk).toContain("Select the workflow and proportional risk");
    expect(withRisk).toContain("verification_gate");
    expect(withRisk).not.toContain("technical reference");
  });

  test("uses the same canonical risk gates in native execution", () => {
    const guidance = [
      "Canonical selection triggers.",
      "| `high` | adversarial boundary and broader final-tree review |",
    ].join("\n");
    const prompt = buildGoalExecutionPrompt(
      handoffValue(),
      "# Change feature\n\nExecute the selected change.",
      guidance,
    );

    expect(prompt.match(/Canonical selection triggers\./g)).toHaveLength(1);
    expect(prompt).toContain(
      "Apply the selected high verification gate defined in the canonical guidance above.",
    );
    expect(prompt).toContain("# Change feature");
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
        handoff.replace('"risk":"high"', '"risk":"unknown"'),
        catalog,
        dimensions,
      ),
    ).toThrow("invalid shape");
  });

  test("accepts a routine coding route for clear high-risk work", () => {
    const value = handoffValue();
    value.profile = "routine";
    value.selectedRoute.model = "gpt-5.6-luna";
    value.selectedRoute.effort = "high";
    value.goalContract = value.goalContract
      .replace("profile\tjudgment", "profile\troutine")
      .replaceAll("gpt-5.6-sol\thigh", "gpt-5.6-luna\thigh");

    expect(
      parseCodexGoalHandoff(JSON.stringify(value), catalog, dimensions)
        .selectedRoute,
    ).toEqual({
      harness: "codex",
      provider: "openai",
      model: "gpt-5.6-luna",
      effort: "high",
    });
  });

  test("uses the canonical task-oriented route mapping as policy", () => {
    const routes = [
      ["scaled", "gpt-5.6-terra", "medium"],
      ["repo-wide", "gpt-5.6-terra", "high"],
      ["judgment", "gpt-5.6-sol", "high"],
    ] as const;

    for (const [profile, model, effort] of routes) {
      const value = handoffValue();
      value.risk = "routine";
      value.profile = profile;
      value.selectedRoute.model = model;
      value.selectedRoute.effort = effort;
      value.goalContract = value.goalContract
        .replace("risk\thigh", "risk\troutine")
        .replace("verification_gate\thigh", "verification_gate\troutine")
        .replace("profile\tjudgment", `profile\t${profile}`)
        .replaceAll("gpt-5.6-sol\thigh", `${model}\t${effort}`);

      expect(
        parseCodexGoalHandoff(JSON.stringify(value), catalog, dimensions)
          .selectedRoute,
      ).toEqual({ harness: "codex", provider: "openai", model, effort });
    }
  });

  test("rejects a selected route that does not match the prepared profile", () => {
    const value = handoffValue();
    value.profile = "routine";
    value.goalContract = value.goalContract.replace(
      "profile\tjudgment",
      "profile\troutine",
    );

    expect(() =>
      parseCodexGoalHandoff(JSON.stringify(value), catalog, dimensions),
    ).toThrow("does not match routine policy");
  });
});
