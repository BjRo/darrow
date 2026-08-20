import { describe, expect, test } from "bun:test";
import {
  exposesInternalGoalRecord,
  parseGoalReport,
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
].join("\n");

describe("adaptive-goal completion reports", () => {
  test("parses one contiguous ordered report inside ordinary prose or a fence", () => {
    expect(parseGoalReport(`Done.\n\n\`\`\`text\n${report}\n\`\`\``)).toEqual({
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
    });
  });

  test("rejects duplicate reports and malformed report-local fields", () => {
    expect(parseGoalReport(`${report}\n\n${report}`)).toBeUndefined();
    expect(
      parseGoalReport(report.replace("risk: routine", "risk\troutine")),
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
    ]) {
      const invalid = parseGoalReport(report.replace(current!, replacement!));
      expect(invalid).toBeDefined();
      expect(validGoalReportValues(invalid)).toBe(false);
    }
  });

  test("ignores overlapping fields in a companion structured result", () => {
    const companion = [
      "format: independent-review-result-v1",
      "evaluation_child_invocations: capability-owned",
    ].join("\n");
    expect(parseGoalReport(`${companion}\n\n${report}`)?.harness).toBe("codex");
    expect(exposesInternalGoalRecord(`${companion}\n\n${report}`)).toBe(false);
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
});
