import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  recoverBundle,
  standardApiCost,
  summarizeTranscript,
  type Tokens,
} from "../experiments/orchestration/recover-value-usage";

const first: Tokens = {
  input_tokens: 100,
  cached_input_tokens: 80,
  cache_write_input_tokens: 0,
  output_tokens: 20,
  reasoning_output_tokens: 5,
  total_tokens: 120,
};
const final: Tokens = {
  input_tokens: 300,
  cached_input_tokens: 260,
  cache_write_input_tokens: 0,
  output_tokens: 40,
  reasoning_output_tokens: 10,
  total_tokens: 340,
};
function transcript(id: string, model = "gpt-6.1-sol", completed = true) {
  const usage = (tokens: Tokens, last = first) => ({
    type: "event_msg",
    payload: {
      type: "token_count",
      info: { total_token_usage: tokens, last_token_usage: last },
    },
  });
  return (
    [
      {
        type: "session_meta",
        payload: {
          id,
          source:
            id === "root"
              ? undefined
              : {
                  subagent: {
                    thread_spawn: {
                      parent_thread_id: "root",
                      depth: 1,
                      agent_path: "/root/test",
                    },
                  },
                },
        },
      },
      { type: "turn_context", payload: { model } },
      usage(first),
      usage(first),
      usage(final, {
        ...first,
        input_tokens: 200,
        cached_input_tokens: 180,
        total_tokens: 220,
      }),
      usage(final, {
        ...first,
        input_tokens: 200,
        cached_input_tokens: 180,
        total_tokens: 220,
      }),
      {
        type: "event_msg",
        payload: { type: completed ? "task_complete" : "turn_aborted" },
      },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n") + "\n"
  );
}
function file(text: string) {
  return {
    path: "session.jsonl",
    sha256: createHash("sha256").update(text).digest("hex"),
    gzipBase64: gzipSync(text).toString("base64"),
  };
}
function bundle(completeness = "complete", issues: string[] = []) {
  return {
    rootSessionId: "root",
    completeness,
    issues,
    files: [file(transcript("root")), file(transcript("child", "gpt-6-luna"))],
  };
}

test("cumulative snapshots are counted once; cached and reasoning tokens stay subsets", () => {
  const result = summarizeTranscript(transcript("root"));
  expect(result.usage).toEqual(final);
  expect(result.completed).toBeTrue();
  expect(result.maxPromptInput).toBe(200);
  expect(result.requestCount).toBe(2);
  expect(standardApiCost(result.model, result.usage!, 100)).toBeCloseTo(
    0.000506,
    10,
  );
});

test("distinct parent and child sessions use their own models; duplicate files do not add usage", () => {
  const capture = bundle();
  capture.files.push(capture.files[0]!);
  const result = recoverBundle(capture);
  expect(result.completeness).toBe("complete");
  expect(result.sessions).toHaveLength(2);
  expect(result.observedTokens?.total_tokens).toBe(680);
  expect(result.standardApiEquivalentUsd).toBeCloseTo(0.0005326, 10);
});

test("partial captures and unfinished sessions remain lower bounds", () => {
  expect(recoverBundle(bundle("partial", ["byte_limit"])).completeness).toBe(
    "lower_bound",
  );
  const capture = bundle();
  capture.files[0] = file(transcript("root", "gpt-6.1-sol", false));
  expect(recoverBundle(capture).completeness).toBe("lower_bound");
  const noUsage = transcript("root")
    .split("\n")
    .filter((line) => !line.includes("token_count"))
    .join("\n");
  const missing = recoverBundle({ ...bundle(), files: [file(noUsage)] });
  expect(missing.observedTokens).toBeNull();
  expect(missing.standardApiEquivalentUsd).toBeNull();
});

test("per-request counters must explain cumulative increments for context pricing", () => {
  const lines = transcript("root").trim().split("\n");
  const event = JSON.parse(lines[4]!);
  event.payload.info.last_token_usage = first;
  lines[4] = JSON.stringify(event);
  expect(() => summarizeTranscript(lines.join("\n"))).toThrow(
    "per-request usage",
  );
});

test("unverifiable captures and incompatible pricing inputs fail explicitly", () => {
  const regressed = transcript("root").trim().split("\n");
  regressed.splice(
    regressed.length - 1,
    0,
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "token_count",
        info: { total_token_usage: first, last_token_usage: first },
      },
    }),
  );
  expect(() => summarizeTranscript(regressed.join("\n"))).toThrow("regressed");
  const corrupt = bundle();
  corrupt.files[0]!.sha256 = "invalid";
  expect(() => recoverBundle(corrupt)).toThrow("hash mismatch");
  const conflict = bundle();
  conflict.files.push(file(transcript("root", "gpt-6-luna")));
  expect(() => recoverBundle(conflict)).toThrow("Conflicting copies");
  expect(() =>
    summarizeTranscript(
      transcript("root").replace('"input_tokens":300', '"input_tokens":30'),
    ),
  ).toThrow("Invalid");
  expect(() =>
    summarizeTranscript(
      transcript("root").replaceAll('"cache_write_input_tokens":0,', ""),
    ),
  ).toThrow("Invalid");
  expect(() => standardApiCost("unknown", final, 100)).toThrow(
    "Pricing requires",
  );
  expect(() => standardApiCost("gpt-6.1-sol", final, 272001)).toThrow(
    "Pricing requires",
  );
  expect(() =>
    standardApiCost(
      "gpt-6.1-sol",
      { ...final, cache_write_input_tokens: 1 },
      100,
    ),
  ).toThrow("Pricing requires");
});
