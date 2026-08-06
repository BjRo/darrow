import { describe, expect, test } from "bun:test";
import {
  extractFactoryMetrics,
  hasForeignFactoryRoute,
  observeCodexDeliveryRoutes,
  reconcileObservedDeliveryRoutes,
} from "./factory-metrics";

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

  test("detects foreign harnesses in both factory route formats", () => {
    expect(
      hasForeignFactoryRoute(
        "route\tplanner\tclaude\tmodel\thigh\tnone",
        "codex",
      ),
    ).toBe(true);
    expect(
      hasForeignFactoryRoute(
        "route\tqa\t2\tclaude\tmodel\thigh\tqa-2",
        "codex",
      ),
    ).toBe(true);
    expect(
      hasForeignFactoryRoute("route\tqa\t2\tcodex\tmodel\thigh\tqa-2", "codex"),
    ).toBe(false);
  });

  test("reconciles delivery routes with completed Codex child spawns", () => {
    const prompt = [
      "- phase: qa",
      "- iteration: 2",
      "- stable_child_id: qa-2-run",
      "- required skill: $qa-ticket",
    ].join("\n");
    const raw = JSON.stringify({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        status: "completed",
        receiver_thread_ids: ["thread-qa-2"],
        prompt,
      },
    });
    const result = [
      "format\tdarrow-delivery-result-v1",
      "route\tqa\t2\tcodex\tgpt-5.5\tmedium\tqa-2-run",
      "evaluation_child_invocations\t1",
    ].join("\n");
    expect(observeCodexDeliveryRoutes(raw)).toEqual([
      {
        phase: "qa",
        iteration: 2,
        childId: "qa-2-run",
        skill: "qa-ticket",
        threadId: "thread-qa-2",
      },
    ]);
    expect(reconcileObservedDeliveryRoutes(result, raw)?.passed).toBe(true);
    expect(
      reconcileObservedDeliveryRoutes(
        result.replace(
          "evaluation_child_invocations\t1",
          "evaluation_child_invocations\t2",
        ),
        raw,
      )?.passed,
    ).toBe(false);
    expect(
      observeCodexDeliveryRoutes('{"type":"result","subtype":"success"}'),
    ).toBeUndefined();
    const duplicateDeclared = [
      "format\tdarrow-delivery-result-v1",
      "route\tqa\t2\tcodex\tgpt-5.5\tmedium\tqa-2-run",
      "route\tqa\t2\tcodex\tgpt-5.5\tmedium\tqa-2-run",
      "evaluation_child_invocations\t2",
    ].join("\n");
    expect(
      reconcileObservedDeliveryRoutes(duplicateDeclared, raw)?.passed,
    ).toBe(false);
    const secondPrompt = prompt.replace("qa-2-run", "qa-2-duplicate");
    const duplicateAttemptRaw = [
      raw,
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "completed",
          receiver_thread_ids: ["thread-qa-duplicate"],
          prompt: secondPrompt,
        },
      }),
    ].join("\n");
    expect(
      reconcileObservedDeliveryRoutes(
        [
          result.replace(
            "evaluation_child_invocations\t1",
            "evaluation_child_invocations\t2",
          ),
          "route\tqa\t2\tcodex\tgpt-5.5\tmedium\tqa-2-duplicate",
        ].join("\n"),
        duplicateAttemptRaw,
      )?.passed,
    ).toBe(false);
  });
});
