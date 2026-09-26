import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildClaudeReviewProof } from "./claude-review-proof";

const route = ["claude", "anthropic", "claude-opus-5", "xhigh"];

type FixtureOptions = {
  splitTurns?: boolean;
  canonicalMarker?: boolean;
  nonNativeResult?: boolean;
  resultBeforeCall?: boolean;
  interleavedResults?: boolean;
  extraAgentCall?: boolean;
};

const defaultFixtureOptions = {
  splitTurns: false,
  canonicalMarker: true,
  nonNativeResult: false,
  resultBeforeCall: false,
  interleavedResults: false,
  extraAgentCall: false,
};

function orderParentEvents(
  calls: Record<string, unknown>[],
  results: Record<string, unknown>[],
  options: typeof defaultFixtureOptions,
) {
  if (options.resultBeforeCall)
    return [results[0]!, ...calls, ...results.slice(1)];
  if (options.interleavedResults)
    return calls.flatMap((call, index) => [call, results[index]!]);
  return [...calls, ...results];
}

async function fixture(root: string, overrides: FixtureOptions = {}) {
  const options = { ...defaultFixtureOptions, ...overrides };
  const artifacts = join(root, "artifacts");
  await mkdir(artifacts);
  await writeFile(
    join(artifacts, "reviewer-route.json"),
    JSON.stringify([["selected_route", ...route]]),
  );
  const calls: Record<string, unknown>[] = [];
  const results: Record<string, unknown>[] = [];
  for (const [index, axis] of ["standards", "spec"].entries()) {
    const id = `child${index}`;
    const tool = `tool${index}`;
    const transcript = join(root, `agent-${id}.jsonl`);
    await writeFile(
      transcript,
      `${JSON.stringify({ type: "assistant", agentId: id, effort: "xhigh", message: { model: "claude-opus-5", role: "assistant" } })}\n`,
    );
    await writeFile(
      join(artifacts, `${axis}-observed-route.json`),
      JSON.stringify([
        ["agent_id", id],
        ["transcript", transcript],
        ["provider_evidence", "current-host-environment-default"],
        ["observed_route", ...route],
      ]),
    );
    await writeFile(
      join(artifacts, `${axis}-route.json`),
      JSON.stringify([
        ["selected_route", ...route],
        ["observed_route", ...route],
        ["provider_evidence", "current-host-environment-default"],
        ["route_bound", "true"],
        ["axis", axis],
        ["agent_id", id],
      ]),
    );
    const call = {
      type: "assistant",
      message: {
        id: options.splitTurns ? `message${index}` : "message0",
        content: [
          {
            type: "tool_use",
            id: tool,
            name: "Agent",
            input: {
              subagent_type: "darrow-review:review-reader-claude-opus-5-xhigh",
              run_in_background: false,
              prompt: `${options.canonicalMarker ? "- " : ""}review_axis: ${axis}\ncheck`,
            },
          },
        ],
      },
    };
    const result = {
      type: "user",
      message: {
        content: [
          {
            type: options.nonNativeResult ? "text" : "tool_result",
            tool_use_id: tool,
          },
        ],
      },
      toolUseResult: {
        status: "completed",
        agentId: id,
        agentType: "darrow-review:review-reader-claude-opus-5-xhigh",
        resolvedModel: "claude-opus-5",
      },
    };
    calls.push(call);
    results.push(result);
  }
  if (options.extraAgentCall) {
    const content = (calls[0]!.message as { content: unknown[] }).content;
    content.push({
      type: "tool_use",
      id: "tool-extra",
      name: "Agent",
      input: {
        subagent_type: "general-purpose",
        run_in_background: true,
        prompt: "extra unbound reader",
      },
    });
  }
  const parent = orderParentEvents(calls, results, options);
  const parentPath = join(root, "parent.jsonl");
  await writeFile(
    parentPath,
    `${parent.map((item) => JSON.stringify(item)).join("\n")}\n`,
  );
  return { parent: parentPath, artifactDir: artifacts };
}

describe("Claude review proof", () => {
  test("joins parallel exact-tuple calls to host children and observed transcripts", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-proof-"));
    try {
      const proof = await buildClaudeReviewProof(await fixture(root));
      expect(proof.outcome).toBe("pass");
      expect(proof.launches.map((launch) => launch.agentId)).toEqual([
        "child0",
        "child1",
      ]);
      expect(proof.checks.sameAssistantTurn).toBe(true);
      expect(proof.checks.exactRetainedLaunchBatch).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects Agent calls split across assistant turns", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-proof-"));
    try {
      await expect(
        buildClaudeReviewProof(await fixture(root, { splitTurns: true })),
      ).rejects.toThrow("Claude Agent calls were not in one assistant turn");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a noncanonical review-axis prompt marker", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-proof-"));
    try {
      await expect(
        buildClaudeReviewProof(await fixture(root, { canonicalMarker: false })),
      ).rejects.toThrow("expected one standards Agent call, found 0");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a copied tool-use id outside a native tool-result block", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-proof-"));
    try {
      await expect(
        buildClaudeReviewProof(await fixture(root, { nonNativeResult: true })),
      ).rejects.toThrow("expected one standards Agent result, found 0");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a native tool result that precedes its Agent call", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-proof-"));
    try {
      await expect(
        buildClaudeReviewProof(await fixture(root, { resultBeforeCall: true })),
      ).rejects.toThrow("standards Agent result precedes its call");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects a child result interleaved before all parallel calls", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-proof-"));
    try {
      await expect(
        buildClaudeReviewProof(
          await fixture(root, { interleavedResults: true }),
        ),
      ).rejects.toThrow(
        "Claude Agent results began before all calls were issued",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects an additional retained Agent call in the launch batch", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-proof-"));
    try {
      await expect(
        buildClaudeReviewProof(await fixture(root, { extraAgentCall: true })),
      ).rejects.toThrow(
        "Claude launch batch contains 3 Agent calls; expected exactly two bound readers",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
