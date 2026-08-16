import { describe, expect, test } from "bun:test";
import {
  extractOrchestrationMetrics,
  hasUnreconciledOrchestrationUsage,
  observeCodexGoalRouteApplication,
  observeCodexTicketPipelineRoutes,
  reconcileObservedGoalRouteApplication,
  reconcileObservedTicketPipelineRoutes,
} from "./orchestration-metrics";

describe("orchestration outcome metrics", () => {
  test("counts child routes, interruptions, and failed quality oracles", () => {
    const result = [
      "format\tdarrow-goal-loop-result-v1",
      "status\tneeds_human",
      "route\tplanner\tclaude\tanthropic\topus\thigh\tnone",
      "route\texecutor\tcodex\topenai\tsol\tmedium\tnone",
    ].join("\n");
    expect(
      extractOrchestrationMetrics(result, [
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

  test("does not attach orchestration metrics to unrelated skills", () => {
    expect(
      extractOrchestrationMetrics("ordinary final answer", []),
    ).toBeUndefined();
  });

  test("accepts neutral comparison records from non-orchestrated baselines", () => {
    expect(
      extractOrchestrationMetrics(
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

  test("detects foreign harnesses in both orchestration route formats", () => {
    expect(
      hasUnreconciledOrchestrationUsage(
        "route\tplanner\tclaude\tmodel\thigh\tnone",
        "codex",
      ),
    ).toBe(true);
    expect(
      hasUnreconciledOrchestrationUsage(
        "route\tqa\t2\tclaude\tmodel\thigh\tqa-2",
        "codex",
      ),
    ).toBe(true);
    expect(
      hasUnreconciledOrchestrationUsage(
        "route\tqa\t2\tcodex\tmodel\thigh\tqa-2",
        "codex",
      ),
    ).toBe(false);
    expect(
      hasUnreconciledOrchestrationUsage(
        "launch_boundary\tnested_session",
        "claude",
      ),
    ).toBe(true);
  });

  test("reconciles ticket-pipeline routes with completed Codex child spawns", () => {
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
      "format\tdarrow-ticket-pipeline-result-v1",
      "route\tqa\t2\tcodex\tgpt-5.5\tmedium\tqa-2-run",
      "evaluation_child_invocations\t1",
    ].join("\n");
    expect(observeCodexTicketPipelineRoutes(raw)).toEqual([
      {
        phase: "qa",
        iteration: 2,
        childId: "qa-2-run",
        skill: "qa-ticket",
        threadId: "thread-qa-2",
      },
    ]);
    expect(reconcileObservedTicketPipelineRoutes(result, raw)?.passed).toBe(
      true,
    );
    expect(
      reconcileObservedTicketPipelineRoutes(
        result.replace(
          "evaluation_child_invocations\t1",
          "evaluation_child_invocations\t2",
        ),
        raw,
      )?.passed,
    ).toBe(false);
    expect(
      observeCodexTicketPipelineRoutes('{"type":"result","subtype":"success"}'),
    ).toBeUndefined();
    const duplicateDeclared = [
      "format\tdarrow-ticket-pipeline-result-v1",
      "route\tqa\t2\tcodex\tgpt-5.5\tmedium\tqa-2-run",
      "route\tqa\t2\tcodex\tgpt-5.5\tmedium\tqa-2-run",
      "evaluation_child_invocations\t2",
    ].join("\n");
    expect(
      reconcileObservedTicketPipelineRoutes(duplicateDeclared, raw)?.passed,
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
      reconcileObservedTicketPipelineRoutes(
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

  test("reconciles goal-loop selected routes with the route actually applied", () => {
    const result = [
      "format\tdarrow-native-goal-preflight-v2",
      "profile\tstandard",
      "selected_route\tcodex\topenai\tgpt-5.6-sol\tmedium",
      "effective_route\tcodex\topenai\tgpt-5.6-sol\tmedium",
      "route_applied_by\tnested-session",
      "route_verified\ttrue",
      "launch_boundary\tnested_session",
      "evaluation_child_invocations\t1",
      "evaluation_human_interruptions\t0",
    ].join("\n");
    const nestedOutput = [
      JSON.stringify({ type: "thread.started", thread_id: "nested-thread" }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
      "format\tdarrow-native-goal-route-application-v1",
      "selected_route\tcodex\topenai\tgpt-5.6-sol\tmedium",
      "effective_route\tcodex\topenai\tgpt-5.6-sol\tmedium",
      "route_applied_by\tnested-session",
      "route_verified\ttrue",
    ].join("\n");
    const raw = JSON.stringify({
      type: "item.completed",
      item: {
        type: "command_execution",
        status: "completed",
        exit_code: 0,
        aggregated_output: nestedOutput,
      },
    });

    expect(observeCodexGoalRouteApplication(result, raw)).toEqual({
      profile: "standard",
      selected: {
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        effort: "medium",
      },
      effective: {
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        effort: "medium",
      },
      appliedBy: "nested-session",
      launchBoundary: "nested_session",
      childInvocationCount: 1,
      childInputTokens: 100,
      childOutputTokens: 20,
    });
    expect(
      reconcileObservedGoalRouteApplication(result, raw, {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.passed,
    ).toBe(true);
    expect(
      reconcileObservedGoalRouteApplication(result, raw, {
        harness: "codex",
        model: "gpt-5.6-sol",
        effort: "medium",
      })?.passed,
    ).toBe(false);

    const sameThread = result
      .replaceAll("gpt-5.6-sol\tmedium", "gpt-5.6-terra\tlow")
      .replaceAll("nested-session", "current-thread")
      .replace("nested_session", "same_thread")
      .replace(
        "evaluation_child_invocations\t1",
        "evaluation_child_invocations\t0",
      );
    expect(
      reconcileObservedGoalRouteApplication(sameThread, "", {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.passed,
    ).toBe(true);
    expect(
      reconcileObservedGoalRouteApplication(sameThread, "", {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "medium",
      })?.passed,
    ).toBe(false);

    const hostApi = result
      .replace(
        "darrow-native-goal-preflight-v2",
        "darrow-native-goal-preflight-v4",
      )
      .replace(
        "profile\tstandard",
        [
          "workflow\tchange-feature",
          "risk\televated",
          "profile\tstandard",
        ].join("\n"),
      )
      .replaceAll("nested-session", "host-api")
      .replace("nested_session", "host_api")
      .replace(
        "evaluation_child_invocations\t1",
        "verification_gate\televated\nevaluation_child_invocations\t0",
      );
    const hostRaw = [
      JSON.stringify({
        type: "darrow.route_applied",
        accepted: true,
        threadId: "thread-1",
        turnId: "turn-2",
        selected: {
          harness: "codex",
          provider: "openai",
          model: "gpt-5.6-sol",
          effort: "medium",
        },
        effective: {
          harness: "codex",
          provider: "openai",
          model: "gpt-5.6-sol",
          effort: "medium",
        },
        appliedBy: "host-api",
      }),
      JSON.stringify({
        type: "darrow.dimensions_applied",
        accepted: true,
        threadId: "thread-1",
        turnId: "turn-2",
        stage: "workflow-risk",
        workflow: "change-feature",
        risk: "elevated",
      }),
      JSON.stringify({
        type: "darrow.workflow_loaded",
        accepted: true,
        threadId: "thread-1",
        turnId: "turn-2",
        workflow: "change-feature",
        file: "/plugin/references/workflows/change-feature.md",
        sha256: "a".repeat(64),
      }),
    ].join("\n");
    expect(observeCodexGoalRouteApplication(hostApi, hostRaw)).toEqual({
      profile: "standard",
      selected: {
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        effort: "medium",
      },
      effective: {
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        effort: "medium",
      },
      appliedBy: "host-api",
      launchBoundary: "host_api",
      childInvocationCount: 0,
      childInputTokens: 0,
      childOutputTokens: 0,
      workflow: "change-feature",
      risk: "elevated",
      workflowFile: "/plugin/references/workflows/change-feature.md",
      workflowSha256: "a".repeat(64),
      dimensionStage: "workflow-risk",
      verificationGate: "elevated",
    });
    expect(
      reconcileObservedGoalRouteApplication(hostApi, hostRaw, {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.passed,
    ).toBe(true);
    expect(
      reconcileObservedGoalRouteApplication(
        hostApi,
        hostRaw.replaceAll('"accepted":true', '"accepted":false'),
        { harness: "codex", model: "gpt-5.6-terra", effort: "low" },
      )?.passed,
    ).toBe(false);
    expect(
      reconcileObservedGoalRouteApplication(
        hostApi,
        hostRaw.replace(
          '"turnId":"turn-2","workflow"',
          '"turnId":"turn-3","workflow"',
        ),
        { harness: "codex", model: "gpt-5.6-terra", effort: "low" },
      )?.passed,
    ).toBe(false);
    expect(
      reconcileObservedGoalRouteApplication(hostApi, hostRaw.split("\n")[0]!, {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.passed,
    ).toBe(false);
  });

  test("reconciles a Claude v4 record with one host-observed native Agent route", () => {
    const result = [
      "format\tdarrow-native-goal-preflight-v4",
      "workflow\tmechanical",
      "risk\troutine",
      "profile\troutine",
      "selected_route\tclaude\tanthropic\tclaude-sonnet-5\tlow",
      "effective_route\tclaude\tanthropic\tclaude-sonnet-5\tlow",
      "route_applied_by\tnative-subagent",
      "route_verified\ttrue",
      "launch_boundary\tnative_subagent",
      "verification_gate\troutine",
      "evaluation_child_invocations\t1",
      "evaluation_human_interruptions\t0",
    ].join("\n");
    const raw = JSON.stringify({
      type: "darrow.claude_agent_route",
      status: "completed",
      agentId: "agentgood",
      selected: {
        harness: "claude",
        provider: "anthropic",
        model: "claude-sonnet-5",
        effort: "low",
      },
      effective: {
        harness: "claude",
        provider: "anthropic",
        model: "claude-sonnet-5",
        effort: "low",
      },
      appliedBy: "native-subagent",
      launchBoundary: "native_subagent",
    });
    expect(observeCodexGoalRouteApplication(result, raw)).toEqual(
      expect.objectContaining({
        childInvocationCount: 1,
        launchBoundary: "native_subagent",
      }),
    );
    expect(
      reconcileObservedGoalRouteApplication(result, raw, {
        harness: "claude",
        model: "claude-sonnet-5",
        effort: "medium",
      })?.passed,
    ).toBe(true);
    expect(
      reconcileObservedGoalRouteApplication(
        result,
        raw.replaceAll("claude-sonnet-5", "claude-opus-5"),
        {
          harness: "claude",
          model: "claude-sonnet-5",
          effort: "medium",
        },
      )?.passed,
    ).toBe(false);
  });

  test("records one first-class native goal runner", () => {
    const result = [
      "format\tdarrow-native-goal-preflight-v2",
      "profile\tjudgment",
      "selected_route\tcodex\topenai\tgpt-5.6-sol\thigh",
      "effective_route\tcodex\topenai\tgpt-5.6-sol\thigh",
      "route_applied_by\tnative-subagent",
      "route_verified\ttrue",
      "launch_boundary\tnative_subagent",
      "evaluation_child_invocations\t1",
      "evaluation_human_interruptions\t0",
    ].join("\n");

    expect(observeCodexGoalRouteApplication(result, "")).toEqual({
      profile: "judgment",
      selected: {
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        effort: "high",
      },
      effective: {
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        effort: "high",
      },
      appliedBy: "native-subagent",
      launchBoundary: "native_subagent",
      childInvocationCount: 1,
      childInputTokens: 0,
      childOutputTokens: 0,
    });
    const spawn = JSON.stringify({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        status: "completed",
        receiver_thread_ids: ["adaptive-goal-runner-thread"],
      },
    });
    const close = JSON.stringify({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "close_agent",
        status: "completed",
        receiver_thread_ids: ["adaptive-goal-runner-thread"],
      },
    });

    expect(
      reconcileObservedGoalRouteApplication(result, spawn, {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.passed,
    ).toBe(true);
    expect(
      reconcileObservedGoalRouteApplication(result, spawn, {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.detail,
    ).toContain("cleanup=not-closed");
    expect(
      reconcileObservedGoalRouteApplication(result, [close, spawn].join("\n"), {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.passed,
    ).toBe(true);
    expect(
      reconcileObservedGoalRouteApplication(result, [spawn, close].join("\n"), {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.passed,
    ).toBe(true);
    expect(
      reconcileObservedGoalRouteApplication(result, [spawn, close].join("\n"), {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.detail,
    ).toContain("cleanup=closed");

    const descendantSpawn = spawn.replace(
      "adaptive-goal-runner-thread",
      "native-descendant-thread",
    );
    const descendantClose = close.replace(
      "adaptive-goal-runner-thread",
      "native-descendant-thread",
    );
    expect(
      reconcileObservedGoalRouteApplication(
        result,
        [spawn, descendantSpawn, close].join("\n"),
        {
          harness: "codex",
          model: "gpt-5.6-terra",
          effort: "low",
        },
      )?.passed,
    ).toBe(true);
    expect(
      reconcileObservedGoalRouteApplication(
        result,
        [spawn, descendantSpawn, descendantClose, close].join("\n"),
        {
          harness: "codex",
          model: "gpt-5.6-terra",
          effort: "low",
        },
      )?.passed,
    ).toBe(true);
  });
});
