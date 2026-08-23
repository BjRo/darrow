import { describe, expect, test } from "bun:test";
import {
  exposesInternalGoalRecord,
  parseImplementationReadinessResult,
  parsePausedGoalReport,
  parseReadinessCompanionGoalReport,
  parseGoalReport,
  parseTerminalGoalReport,
  validGoalReportValues,
} from "./goal-report";

const report = [
  "format: darrow-native-goal-report-v1",
  "workflow: implement-feature",
  "risk: routine",
  "profile: routine",
  "harness: codex",
  "model: openai > gpt-5.6-luna",
  "effort: medium",
  "route_applied_by: native-subagent",
  "route_verified: true",
  "launch_boundary: native_subagent",
  "verification_gate: routine",
  "evaluation_child_invocations: 1",
  "evaluation_human_interruptions: 0",
  "enforcement: helper",
].join("\n");

describe("adaptive-goal completion reports", () => {
  test("parses one leading contiguous ordered report", () => {
    expect(parseGoalReport(`\n\n${report}\nDone.`)).toEqual({
      format: "darrow-native-goal-report-v1",
      workflow: "implement-feature",
      risk: "routine",
      profile: "routine",
      harness: "codex",
      model: "openai > gpt-5.6-luna",
      effort: "medium",
      route_applied_by: "native-subagent",
      route_verified: "true",
      launch_boundary: "native_subagent",
      verification_gate: "routine",
      evaluation_child_invocations: "1",
      evaluation_human_interruptions: "0",
      enforcement: "helper",
    });
    expect(parseGoalReport(`Done.\n\n${report}`)).toBeUndefined();
    expect(parseGoalReport(`\`\`\`text\n${report}\n\`\`\``)).toBeUndefined();
  });

  test("rejects duplicate reports and malformed report-local fields", () => {
    expect(parseGoalReport(`${report}\n\n${report}`)).toBeUndefined();
    expect(
      parseGoalReport(report.replace("risk: routine", "risk\troutine")),
    ).toBeUndefined();
  });

  test("parses an optional report only after a complete feedback question", () => {
    const pause = [
      "- phase: human-feedback-request",
      "Should negative ties preserve Math.round behavior?",
      report,
    ].join("\n");
    expect(parsePausedGoalReport(pause)?.workflow).toBe("implement-feature");
    expect(parseGoalReport(pause)).toBeUndefined();
    expect(
      parsePausedGoalReport(`- phase: human-feedback-request\n${report}`),
    ).toBeUndefined();
    expect(parsePausedGoalReport(`Question first\n${report}`)).toBeUndefined();
    expect(parsePausedGoalReport(`${pause}\n${report}`)).toBeUndefined();
  });

  test("parses a terminal report after a complete non-ready readiness result", () => {
    const readiness = [
      "## Implementation readiness",
      "",
      "**Verdict:** `needs-decision`",
      "",
      "### Basis",
      "",
      "- **Source:** authoritative request",
      "  - **Authority:** `authoritative`",
      "  - **Status:** `available`",
      "  - **Summary:** One material behavior remains undecided.",
      "",
      "### Quality bar",
      "",
      "None.",
      "",
      "### Findings",
      "",
      "- **Type:** `unresolved-decision`",
      "  - **Summary:** The request does not choose the behavior.",
      "  - **Evidence:**",
      "    - The authoritative request leaves the choice open.",
      "",
      "### Required next action",
      "",
      "- **Type:** `decision`",
      "- **Description:** Choose the missing behavior.",
    ].join("\n");
    const result = `${readiness}\n\n${report}\nNative goal settled as blocked.`;
    expect(parseReadinessCompanionGoalReport(result)?.workflow).toBe(
      "implement-feature",
    );
    expect(parseTerminalGoalReport(result)?.harness).toBe("codex");
    expect(parseGoalReport(result)).toBeUndefined();
    expect(parseImplementationReadinessResult(readiness)?.verdict).toBe(
      "needs-decision",
    );
    expect(
      parseReadinessCompanionGoalReport(
        `## Implementation readiness\n\nAssessment pending.\n\n${report}`,
      ),
    ).toBeUndefined();
    expect(
      parseReadinessCompanionGoalReport(`${result}\n\n${report}`),
    ).toBeUndefined();
    expect(
      parseReadinessCompanionGoalReport(
        `${readiness}\n\n\`\`\`text\n${report}\n\`\`\``,
      ),
    ).toBeUndefined();
    expect(
      parseReadinessCompanionGoalReport(
        `${readiness.replace("### Findings", "### Omitted findings")}\n\n${report}`,
      ),
    ).toBeUndefined();
    expect(
      parseReadinessCompanionGoalReport(
        `${readiness.replace("unresolved-decision", "invented-gap")}\n\n${report}`,
      ),
    ).toBeUndefined();
    expect(
      parseReadinessCompanionGoalReport(
        `${readiness.replace("`decision`", "`discovery`")}\n\n${report}`,
      ),
    ).toBeUndefined();
  });

  test("rejects values outside every closed report field", () => {
    const parsed = parseGoalReport(report);
    expect(validGoalReportValues(parsed)).toBe(true);
    for (const [current, replacement] of [
      ["profile: routine", "profile: invalid"],
      ["harness: codex", "harness: native-subagent"],
      ["effort: medium", "effort: extreme"],
      ["launch_boundary: native_subagent", "launch_boundary: invalid"],
      ["enforcement: helper", "enforcement: invented"],
    ]) {
      const invalid = parseGoalReport(report.replace(current!, replacement!));
      expect(invalid).toBeDefined();
      expect(validGoalReportValues(invalid)).toBe(false);
    }
  });

  test("rejects cross-field route and risk contradictions", () => {
    for (const [current, replacement] of [
      ["verification_gate: routine", "verification_gate: elevated"],
      ["launch_boundary: native_subagent", "launch_boundary: launch_required"],
      ["launch_boundary: native_subagent", "launch_boundary: host_api"],
      ["harness: codex", "harness: none"],
      ["route_applied_by: native-subagent", "route_applied_by: none"],
      ["route_verified: true", "route_verified: false"],
    ]) {
      expect(
        validGoalReportValues(
          parseGoalReport(report.replace(current!, replacement!)),
        ),
      ).toBe(false);
    }
  });

  test("requires the complete fixed tuple for a decision-gated report", () => {
    const decisionGated = report
      .replace("workflow: implement-feature", "workflow: decision-gated")
      .replace("risk: routine", "risk: high")
      .replace("profile: routine", "profile: none")
      .replace("harness: codex", "harness: none")
      .replace("model: openai > gpt-5.6-luna", "model: none > none")
      .replace("effort: medium", "effort: none")
      .replace("route_applied_by: native-subagent", "route_applied_by: none")
      .replace("route_verified: true", "route_verified: false")
      .replace(
        "launch_boundary: native_subagent",
        "launch_boundary: launch_required",
      )
      .replace(
        "verification_gate: routine",
        "verification_gate: not-applicable",
      )
      .replace(
        "evaluation_child_invocations: 1",
        "evaluation_child_invocations: 0",
      )
      .replace(
        "evaluation_human_interruptions: 0",
        "evaluation_human_interruptions: 1",
      );
    expect(validGoalReportValues(parseGoalReport(decisionGated))).toBe(true);

    for (const [current, replacement] of [
      ["risk: high", "risk: routine"],
      ["profile: none", "profile: routine"],
      ["harness: none", "harness: codex"],
      ["model: none > none", "model: openai > gpt-5.6-luna"],
      ["effort: none", "effort: medium"],
      ["route_applied_by: none", "route_applied_by: native-subagent"],
      ["route_verified: false", "route_verified: true"],
      ["launch_boundary: launch_required", "launch_boundary: native_subagent"],
      ["verification_gate: not-applicable", "verification_gate: high"],
      ["evaluation_child_invocations: 0", "evaluation_child_invocations: 1"],
      [
        "evaluation_human_interruptions: 1",
        "evaluation_human_interruptions: 0",
      ],
    ]) {
      expect(
        validGoalReportValues(
          parseGoalReport(decisionGated.replace(current!, replacement!)),
        ),
      ).toBe(false);
    }
  });

  test("ignores overlapping fields in a companion structured result", () => {
    const companion = [
      "format: independent-review-result-v1",
      "evaluation_child_invocations: 1",
      "evaluation_human_interruptions: 0",
    ].join("\n");
    expect(parseGoalReport(`${report}\n\n${companion}`)?.harness).toBe("codex");
    expect(exposesInternalGoalRecord(`${report}\n\n${companion}`)).toBe(false);
  });

  test("detects internal launch records behind Markdown presentation", () => {
    expect(
      exposesInternalGoalRecord(
        `${report}\n> format\tdarrow-native-goal-preflight-v4`,
      ),
    ).toBe(true);
    expect(
      exposesInternalGoalRecord(
        `${report}\n- format\tdarrow-native-goal-route-application-v1`,
      ),
    ).toBe(true);
  });

  test.each([
    "darrow-native-goal-prepared-v1",
    "darrow-native-goal-route-v2",
    "darrow-native-goal-route-application-v1",
    "darrow-native-goal-objective-v1",
    "darrow-native-goal-staging-release-v1",
    "darrow-native-goal-objective-release-v1",
    "darrow-goal-step-v1",
    "darrow-goal-step-ledger-v1",
    "darrow-claude-agent-route-v1",
    "darrow-claude-route-gate-v1",
    "darrow-claude-verify-route-v1",
  ])("detects current internal TSV marker %s", (marker) => {
    expect(exposesInternalGoalRecord(`${report}\nformat\t${marker}`)).toBe(
      true,
    );
  });
});
