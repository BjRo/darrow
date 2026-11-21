// Case-local oracle: no custom reference matches in deleted-and-unmatched.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

const view = process.env.SEVRO_CANDIDATE_TRANSCRIPTS;
assert(view, "missing public candidate transcript view");
const index = JSON.parse(readFileSync(resolve(view, "index.json"), "utf8"));
assert(
  ["sevro.native-transcripts.v1", "sevro.native-transcripts.v2"].includes(
    index.format,
  ),
);
assert(["codex", "claude"].includes(index.host));
assert.equal(index.role, "candidate");
assert.equal(index.completeness, "complete");
assert.deepEqual(index.issues, []);
assert(index.rootSessionId && index.files.length, "missing candidate sessions");
const root = resolve(view, index.host);
let calls = 0;
let rootSeen = false;
const names = new Set();
for (const file of index.files) {
  assert(!names.has(file.path), "duplicate transcript path");
  names.add(file.path);
  const path = resolve(root, file.path);
  assert(path.startsWith(root + sep), "transcript path escapes view");
  const data = readFileSync(path);
  assert.equal(createHash("sha256").update(data).digest("hex"), file.sha256);
  if (!path.endsWith(".jsonl")) continue;
  for (const line of data.toString("utf8").split("\n").filter(Boolean)) {
    const row = JSON.parse(line);
    const inputs = [];
    const payload = row.payload;
    if (
      row.sessionId === index.rootSessionId ||
      (row.type === "session_meta" && payload?.id === index.rootSessionId)
    )
      rootSeen = true;
    if (["function_call", "custom_tool_call"].includes(payload?.type)) {
      inputs.push(payload.arguments ?? payload.input);
    }
    if (row.type === "assistant") {
      for (const block of row.message?.content ?? []) {
        if (block.type === "tool_use") inputs.push(block.input);
      }
    }
    for (const input of inputs) {
      calls++;
      assert(
        !JSON.stringify(input).includes("custom-principles"),
        "unmatched or unlisted custom path was explored: " +
          JSON.stringify(input),
      );
    }
  }
}
assert(rootSeen, "missing root candidate session");
assert(calls > 0, "missing candidate native tool calls");
console.log(
  "No custom-directory discovery or custom-body access in this no-match case.",
);
