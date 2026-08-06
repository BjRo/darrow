import { describe, expect, test } from "bun:test";
import { extractFactoryMetrics } from "./factory-metrics";

describe("factory outcome metrics", () => {
  test("counts child routes, interruptions, and failed quality oracles", () => {
    const result = [
      "format\tdarrow-factory-result-v1",
      "status\tneeds_human",
      "route\tplanner\tclaude\tanthropic\topus\thigh\tnone",
      "route\texecutor\tcodex\topenai\tsol\tmedium\tnone",
    ].join("\n");
    expect(
      extractFactoryMetrics(result, [
        {
          name: "hidden behavior",
          passed: false,
          detail: "boundary escaped",
          metric: "escaped_defect",
        },
        {
          name: "verifier noise",
          passed: false,
          detail: "unsupported finding",
          metric: "false_positive",
        },
      ]),
    ).toEqual({
      childInvocationCount: 2,
      humanInterruptions: 1,
      escapedDefects: 1,
      falsePositiveVerifierFindings: 1,
    });
  });

  test("does not attach factory metrics to unrelated skills", () => {
    expect(extractFactoryMetrics("ordinary final answer", [])).toBeUndefined();
  });

  test("accepts neutral comparison records from non-factory baselines", () => {
    expect(
      extractFactoryMetrics(
        [
          "evaluation_child_invocations\t3",
          "evaluation_human_interruptions\t1",
        ].join("\n"),
        [],
      ),
    ).toEqual({
      childInvocationCount: 3,
      humanInterruptions: 1,
      escapedDefects: 0,
      falsePositiveVerifierFindings: 0,
    });
  });
});
