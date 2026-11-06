import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  claudeAssessmentReaders,
  type AssessmentReaders,
} from "../sevro-extension/assessment-readers";

type Row = Record<string, unknown>;
const selected: AssessmentReaders = {
  placement: "inline",
  axes: ["standards", "spec"],
  model: "gpt-6.1-sol",
  effort: "xhigh",
  claude: {
    agent: "darrow-review:review-reader-claude-opus-5-5-xhigh",
    model: "claude-opus-5-5",
    effort: "xhigh",
  },
};
function proof(expected: AssessmentReaders = selected) {
  const tools = expected.axes.map((axis) => ({
    name: "Agent",
    actor: "parent",
    toolUseId: axis,
    parentToolUseId: null,
    runInBackground: false,
    model: null,
    subagentType: expected.claude!.agent,
  }));
  const events: Row[] = tools.map((tool) => ({
    type: "assistant",
    message: {
      id: "one-batch",
      content: [
        {
          type: "tool_use",
          id: tool.toolUseId,
          name: "Agent",
          input: {
            subagent_type: tool.subagentType,
            run_in_background: false,
            prompt: "- review_axis: " + tool.toolUseId,
          },
        },
      ],
    },
  }));
  events.push(
    ...tools.map((tool) => ({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: tool.toolUseId,
            content: "complete reader judgment",
          },
        ],
      },
    })),
    { type: "result", subtype: "success", is_error: false },
  );
  const files = expected.axes.flatMap((axis) => {
    const child = "project/session/subagents/agent-" + axis;
    return [
      {
        path: child + ".meta.json",
        text: JSON.stringify({
          toolUseId: axis,
          agentType: expected.claude!.agent,
          requestShape: "foreground",
          finished: true,
        }),
      },
      {
        path: child + ".jsonl",
        text: JSON.stringify({
          type: "assistant",
          agentId: axis,
          sessionId: "session",
          effort: "xhigh",
          message: {
            model: "claude-opus-5-5",
            content: [{ type: "text", text: "complete reader judgment" }],
          },
        }),
      },
    ];
  });
  return { tools, events, files };
}
function bundle(files: { path: string; text: string }[]) {
  return JSON.stringify({
    format: "sevro.native-transcripts.v2",
    host: "claude",
    role: "candidate",
    rootSessionId: "session",
    completeness: "complete",
    issues: [],
    files: files.map((file) => ({
      path: file.path,
      sha256: createHash("sha256").update(file.text).digest("hex"),
      gzipBase64: gzipSync(file.text).toString("base64"),
    })),
  });
}
function text(events: Row[]) {
  return events.map((event) => JSON.stringify(event)).join("\n");
}
test("Claude native proof accepts distinct stream fragments of one launch message and observed routes", () => {
  const p = proof();
  expect(
    claudeAssessmentReaders(selected, p.tools, text(p.events), bundle(p.files)),
  ).toBe("passed");
  expect(claudeAssessmentReaders(selected, p.tools, text(p.events))).toBe(
    "unavailable",
  );
  expect(
    claudeAssessmentReaders(
      selected,
      p.tools,
      text(p.events),
      bundle(p.files.slice(1)),
    ),
  ).toBe("unavailable");
  const wrong = p.files.map((file) =>
    file.path.endsWith(".jsonl")
      ? {
          ...file,
          text: file.text.replace("claude-opus-5-5", "claude-sonnet-5-5"),
        }
      : file,
  );
  expect(
    claudeAssessmentReaders(selected, p.tools, text(p.events), bundle(wrong)),
  ).toBe("failed");
  const missing = p.files.map((file) =>
    file.path.endsWith(".jsonl")
      ? { ...file, text: file.text.replace('"effort":"xhigh",', "") }
      : file,
  );
  expect(
    claudeAssessmentReaders(selected, p.tools, text(p.events), bundle(missing)),
  ).toBe("unavailable");
  const conflicting = p.files.map((file) =>
    file.path.endsWith(".jsonl")
      ? {
          ...file,
          text: file.text + "\n" + file.text.replace("xhigh", "medium"),
        }
      : file,
  );
  expect(
    claudeAssessmentReaders(
      selected,
      p.tools,
      text(p.events),
      bundle(conflicting),
    ),
  ).toBe("failed");
});
test("replacement provider uses its own available native Agent without a Review dependency", () => {
  const expected: AssessmentReaders = {
      ...selected,
      claude: { agent: "general-purpose" },
    },
    p = proof(expected);
  expect(
    claudeAssessmentReaders(expected, p.tools, text(p.events), bundle(p.files)),
  ).toBe("passed");
  expect(
    claudeAssessmentReaders(selected, p.tools, text(p.events), bundle(p.files)),
  ).toBe("failed");
  const use = (p.events[0]!.message as Row).content as Row[];
  (use[0]!.input as Row).resume = "old-reader";
  expect(
    claudeAssessmentReaders(expected, p.tools, text(p.events), bundle(p.files)),
  ).toBe("failed");
});
test("Claude reader proof rejects incomplete results, separate launch turns and damaged native bytes", () => {
  const p = proof();
  expect(
    claudeAssessmentReaders(
      selected,
      p.tools,
      text(p.events.slice(0, 2)),
      bundle(p.files),
    ),
  ).toBe("unavailable");
  expect(
    claudeAssessmentReaders(
      selected,
      p.tools,
      text(p.events.filter((_, index) => index !== 2)),
      bundle(p.files),
    ),
  ).toBe("unavailable");
  (p.events[1]!.message as Row).id = "later-turn";
  expect(
    claudeAssessmentReaders(selected, p.tools, text(p.events), bundle(p.files)),
  ).toBe("failed");
  const damaged = JSON.parse(bundle(p.files));
  damaged.files[0].sha256 = "0".repeat(64);
  expect(
    claudeAssessmentReaders(
      selected,
      p.tools,
      text(p.events),
      JSON.stringify(damaged),
    ),
  ).toBe("unavailable");
});
