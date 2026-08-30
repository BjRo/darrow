import { describe, expect, test } from "bun:test";
import {
  extractOrchestrationMetrics,
  hasUnreconciledOrchestrationUsage,
  observeCodexGoalRouteApplication,
  observeCodexTicketPipelineRoutes,
  reconcileObservedGoalRouteApplication,
  reconcileObservedTicketPipelineRoutes,
} from "./orchestration-metrics";

const CODEX_ROUTE = {
  harness: "codex" as const,
  model: "gpt-5.6-terra",
  effort: "low",
};

function reconcileGoalRoute(result: string, raw: string) {
  return reconcileObservedGoalRouteApplication(result, raw, CODEX_ROUTE)!;
}

describe("orchestration outcome metrics", () => {
  test("requires every zero-child stop to have no observed spawn attempt", () => {
    const stopped = [
      "format: darrow-native-goal-report-v1",
      "workflow: change-feature",
      "risk: routine",
      "profile: routine",
      "harness: none",
      "model: none > none",
      "effort: none",
      "route_applied_by: none",
      "route_verified: false",
      "launch_boundary: launch_required",
      "verification_gate: not-applicable",
      "evaluation_child_invocations: 0",
      "evaluation_human_interruptions: 1",
    ].join("\n");
    const spawn = JSON.stringify({
      type: "item.started",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        status: "in_progress",
        prompt: "unmarked generic helper",
      },
    });
    expect(reconcileGoalRoute(stopped, "").passed).toBe(true);
    expect(reconcileGoalRoute(stopped, spawn).passed).toBe(false);
  });

  test("accepts one activated child whose native goal persistence is unavailable", () => {
    const agentRef = "/root/adaptive_goal_runner";
    const attestation = {
      model: "gpt-5.6-terra",
      effort: "low",
      forkTurns: "none",
      requestSha256: "0".repeat(64),
      objectiveSha256: "1".repeat(64),
      contractSha256: "2".repeat(64),
      baselineSha256: "3".repeat(64),
      fixtureStateSha256: "4".repeat(64),
      objectiveMode: "inline",
    };
    const collab = (tool: string, prompt?: string) =>
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool,
          status: "completed",
          agent_ref: agentRef,
          receiver_thread_ids: [agentRef],
          prompt,
        },
      });
    const raw = [
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "in_progress",
          sender_thread_id: "parent-thread",
          prompt: "- phase: adaptive-goal-runner\nexact goal contract",
          goal_spawn_attestation: attestation,
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "completed",
          sender_thread_id: "parent-thread",
          agent_ref: agentRef,
          receiver_thread_ids: [agentRef],
          goal_spawn_attestation: attestation,
        },
      }),
      JSON.stringify({
        type: "darrow.goal_activation",
        status: "completed",
        agent_ref: agentRef,
      }),
      collab("send_message", "- phase: goal-owner-activated"),
      JSON.stringify({
        type: "darrow.goal_persistence",
        status: "unavailable",
        agent_ref: agentRef,
      }),
      collab("wait_agent"),
      JSON.stringify({
        type: "darrow.goal_report",
        status: "launch-required",
      }),
    ].join("\n");
    const stopped = [
      "format: darrow-native-goal-report-v1",
      "workflow: change-feature",
      "risk: routine",
      "profile: routine",
      "harness: none",
      "model: none > none",
      "effort: none",
      "route_applied_by: none",
      "route_verified: false",
      "launch_boundary: launch_required",
      "verification_gate: routine",
      "evaluation_child_invocations: 1",
      "evaluation_human_interruptions: 0",
      "enforcement: helper",
      "Native goal persistence: unavailable.",
      "Native goal requires host launch.",
    ].join("\n");
    expect(reconcileGoalRoute(stopped, raw).passed).toBe(true);
    expect(
      reconcileGoalRoute(stopped, raw.replace("wait_agent", "send_message"))
        .passed,
    ).toBe(false);
  });

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
      "- required skill: $darrow-ticket-pipeline:qa-ticket",
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
    expect(
      observeCodexTicketPipelineRoutes(
        raw.replace("darrow-ticket-pipeline:", "foreign-plugin:"),
      ),
    ).toEqual([]);
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
    const unmarkedSpawn = JSON.stringify({
      type: "item.started",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        status: "in_progress",
        prompt: "generic helper",
      },
    });
    expect(
      reconcileObservedGoalRouteApplication(sameThread, unmarkedSpawn, {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "low",
      })?.passed,
    ).toBe(false);
    expect(
      reconcileObservedGoalRouteApplication(sameThread, "", {
        harness: "codex",
        model: "gpt-5.6-terra",
        effort: "medium",
      })?.passed,
    ).toBe(false);

    const hostApi = [
      "format: darrow-native-goal-report-v1",
      "workflow: change-feature",
      "risk: elevated",
      "profile: judgment",
      "harness: codex",
      "model: openai > gpt-5.6-sol",
      "effort: medium",
      "route_applied_by: host-api",
      "route_verified: true",
      "launch_boundary: host_api",
      "verification_gate: elevated",
      "evaluation_child_invocations: 0",
      "evaluation_human_interruptions: 0",
      "enforcement: helper",
    ].join("\n");
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
      profile: "judgment",
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

  test("records one guard-accepted adaptive goal owner without a ledger report", () => {
    const event = {
      type: "darrow.goal_owner_accepted",
      agent_ref: "/root/adaptive_goal_fixture",
      workflow: "implement-feature",
      risk: "routine",
      profile: "routine",
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
      applied_by: "native-subagent",
      launch_boundary: "native_subagent",
      child_invocations: 1,
    };
    const raw = JSON.stringify(event);

    expect(observeCodexGoalRouteApplication("", raw)).toEqual({
      profile: "routine",
      workflow: "implement-feature",
      risk: "routine",
      selected: event.selected,
      effective: event.effective,
      appliedBy: "native-subagent",
      launchBoundary: "native_subagent",
      childInvocationCount: 1,
      childInputTokens: 0,
      childOutputTokens: 0,
    });
    expect(reconcileGoalRoute("", raw).passed).toBe(true);
    expect(reconcileGoalRoute("", `${raw}\n${raw}`).passed).toBe(false);
    expect(
      reconcileGoalRoute("", JSON.stringify({ ...event, child_invocations: 2 }))
        .passed,
    ).toBe(false);
    expect(
      reconcileGoalRoute(
        "",
        JSON.stringify({
          ...event,
          effective: { ...event.effective, model: "gpt-5.6-terra" },
        }),
      ).passed,
    ).toBe(false);
  });

  test("records one first-class native goal runner", () => {
    const result = [
      "format: darrow-native-goal-report-v1",
      "workflow: fix-bug",
      "risk: routine",
      "profile: judgment",
      "harness: codex",
      "model: openai > gpt-5.6-sol",
      "effort: high",
      "route_applied_by: native-subagent",
      "route_verified: true",
      "launch_boundary: native_subagent",
      "verification_gate: routine",
      "evaluation_child_invocations: 1",
      "evaluation_human_interruptions: 0",
      "enforcement: helper",
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
    const goalSpawnAttestation = {
      model: "gpt-5.6-sol",
      effort: "high",
      forkTurns: "none",
      requestSha256: "0".repeat(64),
      objectiveSha256: "1".repeat(64),
      contractSha256: "2".repeat(64),
      baselineSha256: "3".repeat(64),
      fixtureStateSha256: "4".repeat(64),
      objectiveMode: "inline",
    };
    const spawn = [
      JSON.stringify({
        type: "item.started",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "in_progress",
          sender_thread_id: "parent-thread",
          receiver_thread_ids: [],
          prompt: "- phase: adaptive-goal-runner\nexact goal contract",
          goal_spawn_attestation: goalSpawnAttestation,
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          status: "completed",
          sender_thread_id: "parent-thread",
          receiver_thread_ids: ["adaptive-goal-runner-thread"],
          goal_spawn_attestation: goalSpawnAttestation,
        },
      }),
    ].join("\n");
    const close = JSON.stringify({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "close_agent",
        status: "completed",
        receiver_thread_ids: ["adaptive-goal-runner-thread"],
      },
    });

    expect(reconcileGoalRoute(result, spawn).passed).toBe(true);
    expect(
      reconcileGoalRoute(
        result,
        spawn.replaceAll('"model":"gpt-5.6-sol"', '"model":"gpt-5.5"'),
      ).passed,
    ).toBe(false);
    expect(
      reconcileGoalRoute(
        result,
        spawn.replaceAll(
          `,"goal_spawn_attestation":${JSON.stringify(goalSpawnAttestation)}`,
          "",
        ),
      ).passed,
    ).toBe(false);
    expect(
      reconcileGoalRoute(
        result
          .split("\n")
          .map((line) => `${line}  `)
          .join("\n"),
        spawn,
      ).passed,
    ).toBe(true);
    expect(reconcileGoalRoute(result, spawn.split("\n")[1]!).passed).toBe(
      false,
    );
    expect(
      reconcileGoalRoute(
        result,
        spawn.replace(
          "- phase: adaptive-goal-runner\\nexact goal contract",
          "unrelated helper",
        ),
      ).passed,
    ).toBe(false);
    expect(
      reconcileGoalRoute(
        result,
        spawn.replace(
          "- phase: adaptive-goal-runner\\nexact goal contract",
          "unrelated helper\\n- phase: adaptive-goal-runner",
        ),
      ).passed,
    ).toBe(false);
    expect(reconcileGoalRoute(result, spawn).detail).toContain(
      "route-telemetry=boundary-only",
    );
    expect(reconcileGoalRoute(result, spawn).detail).toContain(
      "cleanup=not-closed",
    );
    expect(reconcileGoalRoute(result, [close, spawn].join("\n")).passed).toBe(
      true,
    );
    expect(reconcileGoalRoute(result, [spawn, close].join("\n")).passed).toBe(
      true,
    );
    expect(
      reconcileGoalRoute(result, [spawn, close].join("\n")).detail,
    ).toContain("cleanup=closed");

    const descendantSpawn = spawn
      .replace(
        "- phase: adaptive-goal-runner\\nexact goal contract",
        "bounded native task",
      )
      .replaceAll("parent-thread", "adaptive-goal-runner-thread")
      .replace('adaptive-goal-runner-thread"],', 'native-descendant-thread"],');
    const descendantClose = close.replace(
      "adaptive-goal-runner-thread",
      "native-descendant-thread",
    );
    expect(
      reconcileGoalRoute(result, [spawn, descendantSpawn, close].join("\n"))
        .passed,
    ).toBe(true);
    expect(
      reconcileGoalRoute(
        result,
        [spawn, descendantSpawn, descendantClose, close].join("\n"),
      ).passed,
    ).toBe(true);
    expect(
      reconcileGoalRoute(
        result,
        [
          spawn,
          descendantSpawn.replaceAll(
            '"sender_thread_id":"adaptive-goal-runner-thread"',
            '"sender_thread_id":"parent-thread"',
          ),
          close,
        ].join("\n"),
      ).passed,
    ).toBe(false);
    expect(
      reconcileGoalRoute(result, [spawn, spawn, close].join("\n")).passed,
    ).toBe(false);
    expect(
      reconcileGoalRoute(
        result,
        [
          spawn,
          JSON.stringify({
            type: "darrow.parent_tool_after_goal",
            operation: "command_execution",
          }),
          close,
        ].join("\n"),
      ).passed,
    ).toBe(false);
    const fileBackedSpawn = spawn.replaceAll(
      '"objectiveMode":"inline"',
      '"objectiveMode":"file-backed"',
    );
    const release = JSON.stringify({
      type: "darrow.objective_release",
      status: "completed",
      contract_sha256: goalSpawnAttestation.contractSha256,
    });
    expect(reconcileGoalRoute(result, fileBackedSpawn).passed).toBe(false);
    expect(
      reconcileGoalRoute(result, [fileBackedSpawn, release].join("\n")).passed,
    ).toBe(true);
  });
});
