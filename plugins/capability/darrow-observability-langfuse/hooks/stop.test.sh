#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
repo_dir=$(CDPATH='' cd -- "$plugin_dir/../../.." && pwd)
rollout="$plugin_dir/tests/fixtures/main-rollout.jsonl"
output=$(mktemp "${TMPDIR:-/tmp}/darrow-langfuse-hook.XXXXXX")
trap 'rm -f "$output"' EXIT HUP INT TERM

payload=$(printf '{"session_id":"session-main","turn_id":"turn-1","cwd":"%s","transcript_path":"%s","hook_event_name":"Stop"}' "$repo_dir" "$rollout")

printf '%s\n' "$payload" |
  CODEX_PLUGIN_ROOT="$plugin_dir" \
  DARROW_LANGFUSE_ENABLED=true \
  DARROW_LANGFUSE_CAPTURE_CONTENT=true \
  DARROW_LANGFUSE_DRY_RUN=true \
  DARROW_LANGFUSE_STRICT=true \
  DARROW_LANGFUSE_WORK_ITEM_ID=EXT-7 \
  bash "$script_dir/stop.sh" >"$output"

node --input-type=module - "$output" <<'NODE'
import fs from "node:fs";

const result = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (result.status !== "dry-run" || result.traces.length !== 1) {
  throw new Error("Stop hook did not reconstruct exactly one dry-run trace");
}
const trace = result.traces[0];
if (
  trace.name !== "Codex Turn" ||
  trace.session_id !== "session-main:attribution:0" ||
  trace.metadata["codex.thread_id"] !== "session-main"
) {
  throw new Error("turn trace identity is incorrect");
}
if (trace.metadata["darrow.work_item_id"] !== "EXT-7") {
  throw new Error("explicit work-item configuration did not win");
}
if (
  trace.metadata["darrow.attribution_source"] !== "configuration" ||
  trace.metadata["darrow.attribution_epoch"] !== trace.session_id
) {
  throw new Error("attribution epoch metadata is incorrect");
}
if (trace.input !== "Inspect the repository" || !trace.output.includes("README.md")) {
  throw new Error("turn content was not reconstructed");
}
const generation = trace.observations.find((item) => item.type === "generation");
if (!generation || generation.model !== "gpt-5.6-sol") {
  throw new Error("model generation is missing");
}
if (generation.usage_details.total_tokens !== 120) {
  throw new Error("generation token usage is missing");
}
const tool = generation.children.find((item) => item.type === "tool");
if (!tool || tool.name !== "rg --files" || tool.output !== "README.md\npackage.json") {
  throw new Error("tool activity was not reconstructed");
}
const subagent = trace.observations.find(
  (item) => item.type === "agent" && item.name === "Codex Subagent Turn",
);
if (!subagent || subagent.session_id !== "child-1") {
  throw new Error("spawned subagent turn was not nested under the parent trace");
}
if (!subagent.children.some((item) => item.type === "generation" && item.model === "gpt-5.6-luna")) {
  throw new Error("subagent model activity is missing");
}
NODE

printf 'observability Stop hook reconstruction test passed\n'
