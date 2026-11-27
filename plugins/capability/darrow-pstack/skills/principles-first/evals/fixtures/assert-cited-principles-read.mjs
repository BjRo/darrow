// Case-local oracle: every route ID the root agent cites names a custom
// principle file that a native tool call actually opened.
// Usage: node assert-cited-principles-read.mjs <id>=<file> [<id>=<file> ...]
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

const routes = process.argv.slice(2).map((pair) => {
  const [id, file] = pair.split("=");
  assert(id && file, `invalid route argument: ${pair}`);
  return { id, file };
});
assert(routes.length, "missing route arguments");

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
const inputs = [];
const rootText = [];
const names = new Set();
for (const file of index.files) {
  assert(!names.has(file.path), "duplicate transcript path");
  names.add(file.path);
  const path = resolve(root, file.path);
  assert(path.startsWith(root + sep), "transcript path escapes view");
  const data = readFileSync(path);
  assert.equal(createHash("sha256").update(data).digest("hex"), file.sha256);
  if (!path.endsWith(".jsonl")) continue;
  let codexRoot = false;
  for (const line of data.toString("utf8").split("\n").filter(Boolean)) {
    const row = JSON.parse(line);
    const payload = row.payload;
    if (row.type === "session_meta" && payload?.id === index.rootSessionId)
      codexRoot = true;
    if (["function_call", "custom_tool_call"].includes(payload?.type))
      inputs.push(JSON.stringify(payload.arguments ?? payload.input));
    if (
      codexRoot &&
      payload?.type === "message" &&
      payload.role === "assistant"
    )
      for (const part of payload.content ?? [])
        if (typeof part.text === "string") rootText.push(part.text);
    if (codexRoot && payload?.type === "agent_message")
      rootText.push(String(payload.message ?? ""));
    if (row.type !== "assistant") continue;
    const claudeRoot =
      row.sessionId === index.rootSessionId && row.isSidechain !== true;
    for (const block of row.message?.content ?? []) {
      if (block.type === "tool_use") inputs.push(JSON.stringify(block.input));
      if (claudeRoot && block.type === "text") rootText.push(block.text);
    }
  }
}
assert(inputs.length, "missing candidate native tool calls");
const text = rootText.join("\n");
assert(text.trim(), "missing root assistant text");

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cited = routes.filter(({ id }) =>
  new RegExp(`(^|[^A-Za-z0-9-])${escape(id)}($|[^A-Za-z0-9-])`).test(text),
);
assert(cited.length, "no applied principle was cited by route ID");
for (const { id, file } of cited)
  assert(
    inputs.some((input) => input.includes(`custom-principles/${file}`)),
    `cited ${id} without opening custom-principles/${file}`,
  );
