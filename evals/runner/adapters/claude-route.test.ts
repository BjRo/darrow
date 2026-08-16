import { expect, test } from "bun:test";
import {
  claudeAgentRouteEvidence,
  claudeTranscriptProjectKeys,
} from "./claude-route";

function agentToolEvent(
  subagentType = "darrow-goal-loop:adaptive-goal-sonnet-5-low",
) {
  return JSON.stringify({
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          name: "Agent",
          id: "tool-route",
          input: {
            subagent_type: subagentType,
          },
        },
      ],
    },
  });
}

function agentResultEvent(agentId: string) {
  return JSON.stringify({
    type: "user",
    message: {
      content: [{ type: "tool_result", tool_use_id: "tool-route" }],
    },
    toolUseResult: { agentId },
  });
}

function childTurn(agentId: string, model: string) {
  return JSON.stringify({
    type: "assistant",
    agentId,
    effort: "low",
    message: { model, content: [] },
  });
}

test("derives Claude transcript aliases for logical macOS temp paths", () => {
  expect(
    claudeTranscriptProjectKeys(
      "/var/folders/_b/eval_repo",
      "/private/var/folders/_b/eval_repo",
    ),
  ).toEqual({
    observed: "-private-var-folders--b-eval-repo",
    compatibility: [
      "-var-folders-_b-eval_repo",
      "-private-var-folders-_b-eval_repo",
    ],
  });
});

test("observes one exact adaptive Agent identity and its effective route", () => {
  const main = [agentToolEvent(), agentResultEvent("agentgood")].join("\n");
  expect(
    claudeAgentRouteEvidence(main, {
      agentgood: childTurn("agentgood", "claude-sonnet-5"),
      agentgood2: childTurn("agentgood2", "claude-opus-5"),
    }),
  ).toEqual({
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
  expect(
    claudeAgentRouteEvidence(main, {
      agentgood2: childTurn("agentgood2", "claude-opus-5"),
    }),
  ).toBeUndefined();
  expect(
    claudeAgentRouteEvidence(agentToolEvent(), {
      agentgood: childTurn("agentgood", "claude-sonnet-5"),
    }),
  ).toBeUndefined();
});
