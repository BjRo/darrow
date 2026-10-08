import { expect, test } from "bun:test";
import { fixtureExtensionRequest } from "./fixture-command";

type Route = { model: string; effort: string };
type Fields = Record<string, unknown>;
const expected = { model: "gpt-5.6-terra", effort: "medium" };
const checkId = "darrow.evals.benchmark.effective-owner-route";

function nativeReceipt(route: Route = expected, changes: Fields = {}) {
  return {
    id: "sevro.codex.native-calls",
    source: "sevro.host.codex",
    completeness: "complete",
    data: {
      method: "native_session",
      calls: [
        {
          ordinal: 1,
          namespace: "collaboration",
          name: "spawn_agent",
          evidence: "invocation_attempt",
        },
      ],
      toolCalls: [
        { ordinal: 1, namespace: "collaboration", name: "spawn_agent" },
      ],
      acceptedSpawns: [
        {
          requestedOrdinal: 1,
          startedOrdinal: 2,
          acceptedOrdinal: 3,
          agentRef: "/root/owner",
          threadId: "child-thread",
          forkTurns: "none",
          model: route.model,
          reasoningEffort: route.effort,
          role: "unverified",
          ...changes,
        },
      ],
      submittedExecCalls: 0,
    },
  };
}

async function routeCheck(observations: unknown[], route: Route = expected) {
  const result = await fixtureExtensionRequest<{
    checks: {
      id: string;
      status: string;
      detail: string;
      evidenceRefs: string[];
    }[];
  }>("evaluate", {
    configuration: { effectiveOwnerRoute: route },
    extensionData: { "darrow.case": { benchmarkOwnerRoute: route } },
    observations,
  });
  expect(result.checks).toHaveLength(1);
  expect(result.checks[0]!.id).toBe(checkId);
  return result.checks[0]!;
}

test("native acceptance proves only the effective route through the public protocol", async () => {
  for (const route of [expected, { model: "gpt-5.6-luna", effort: "high" }]) {
    const observation = nativeReceipt(route);
    const checked = await routeCheck([observation], route);
    expect(checked).toEqual({
      id: checkId,
      status: "passed",
      detail: `Expected one accepted owner at ${route.model}/${route.effort} with forkTurns none; contract selection remains unverified`,
      evidenceRefs: ["sevro.codex.native-calls"],
    });
    expect(
      await routeCheck(
        [
          nativeReceipt(route, {
            role: "verified",
            profile: "invented",
            workflow: "invented",
            risk: "invented",
          }),
        ],
        route,
      ),
    ).toEqual(checked);
    for (const change of [
      {
        model: route.model === expected.model ? "gpt-5.6-luna" : expected.model,
      },
      {
        reasoningEffort:
          route.effort === expected.effort ? "high" : expected.effort,
      },
    ])
      expect(
        (await routeCheck([nativeReceipt(route, change)], route)).status,
      ).toBe("failed");
  }
});

function twoAcceptedOwners() {
  const receipt = nativeReceipt();
  receipt.data.calls.push({ ...receipt.data.calls[0]!, ordinal: 4 });
  receipt.data.toolCalls.push({ ...receipt.data.toolCalls[0]!, ordinal: 4 });
  receipt.data.acceptedSpawns.push({
    ...receipt.data.acceptedSpawns[0]!,
    requestedOrdinal: 4,
    startedOrdinal: 5,
    acceptedOrdinal: 6,
    agentRef: "/root/other",
    threadId: "other-thread",
  });
  return receipt;
}

test("missing, duplicate, malformed and inherited routes never pass", async () => {
  const observation = nativeReceipt();
  const rejected: [string, unknown[], string][] = [
    ["missing receipt", [], "unavailable"],
    ["duplicate receipt", [observation, observation], "unavailable"],
    [
      "partial native session",
      [{ ...observation, completeness: "partial" }],
      "unavailable",
    ],
    [
      "foreign source",
      [{ ...observation, source: "sevro.host.claude" }],
      "unavailable",
    ],
    ["malformed data", [{ ...observation, data: "malformed" }], "unavailable"],
    ["null data", [{ ...observation, data: null }], "unavailable"],
    ["array data", [{ ...observation, data: [] }], "unavailable"],
    [
      "legacy annotation is not native evidence",
      [
        {
          ...observation,
          data: {
            type: "darrow.codex_native_single_agent_accepted",
            agent_ref: "/root/owner",
            model: expected.model,
            reasoning_effort: expected.effort,
            fork_turns: "none",
            role: "unverified",
          },
        },
      ],
      "unavailable",
    ],
    [
      "missing fork",
      [nativeReceipt(expected, { forkTurns: undefined })],
      "unavailable",
    ],
    [
      "invalid fork",
      [nativeReceipt(expected, { forkTurns: "invalid" })],
      "unavailable",
    ],
    [
      "missing model",
      [nativeReceipt(expected, { model: undefined })],
      "unavailable",
    ],
    [
      "invalid model",
      [nativeReceipt(expected, { model: "bad model" })],
      "unavailable",
    ],
    [
      "missing effort",
      [nativeReceipt(expected, { reasoningEffort: null })],
      "unavailable",
    ],
    [
      "invalid effort",
      [nativeReceipt(expected, { reasoningEffort: "invalid" })],
      "unavailable",
    ],
    [
      "missing host start",
      [nativeReceipt(expected, { startedOrdinal: undefined })],
      "unavailable",
    ],
    [
      "acceptance before host start",
      [nativeReceipt(expected, { acceptedOrdinal: 1 })],
      "unavailable",
    ],
    [
      "unmatched launch",
      [nativeReceipt(expected, { requestedOrdinal: 4 })],
      "unavailable",
    ],
    [
      "direct/native call disagreement",
      [{ ...observation, data: { ...observation.data, calls: [] } }],
      "unavailable",
    ],
    [
      "no accepted child",
      [
        {
          ...observation,
          data: {
            ...observation.data,
            calls: [],
            toolCalls: [],
            acceptedSpawns: [],
          },
        },
      ],
      "failed",
    ],
    [
      "unaccepted launch",
      [{ ...observation, data: { ...observation.data, acceptedSpawns: [] } }],
      "failed",
    ],
    ["two accepted children", [twoAcceptedOwners()], "failed"],
    [
      "all-context inheritance",
      [nativeReceipt(expected, { forkTurns: "all" })],
      "failed",
    ],
    [
      "bounded-context inheritance",
      [nativeReceipt(expected, { forkTurns: "1" })],
      "failed",
    ],
  ];
  for (const [name, observations, status] of rejected) {
    const checked = await routeCheck(observations);
    expect(checked.status, name).toBe(status);
    expect(checked.detail, name).toContain(
      "contract selection remains unverified",
    );
  }
});
