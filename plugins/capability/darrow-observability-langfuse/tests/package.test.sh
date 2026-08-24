#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
repo_dir=$(CDPATH='' cd -- "$plugin_dir/../../.." && pwd)
claude_manifest="$plugin_dir/.claude-plugin/plugin.json"
codex_manifest="$plugin_dir/.codex-plugin/plugin.json"
hook_manifest="$plugin_dir/hooks/hooks.json"
hook_launcher="$plugin_dir/hooks/stop.sh"
marketplace="$repo_dir/.claude-plugin/marketplace.json"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

for required in "$claude_manifest" "$codex_manifest" "$hook_manifest" "$hook_launcher"; do
  test -r "$required" || fail "missing packaged file: $required"
done

node --input-type=module - "$claude_manifest" "$codex_manifest" "$hook_manifest" "$marketplace" <<'NODE'
import fs from "node:fs";

const [claudePath, codexPath, hookPath, marketplacePath] = process.argv.slice(2);
const claude = JSON.parse(fs.readFileSync(claudePath, "utf8"));
const codex = JSON.parse(fs.readFileSync(codexPath, "utf8"));
const hooks = JSON.parse(fs.readFileSync(hookPath, "utf8"));
const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));

const expectedName = "darrow-observability-langfuse";
if (claude.name !== expectedName || codex.name !== expectedName) {
  throw new Error("manifest names do not match the plugin boundary");
}
if (!/^\d+\.\d+\.\d+$/.test(claude.version) || claude.version !== codex.version) {
  throw new Error("manifest versions are not matching semantic versions");
}
if (codex.skills !== "./skills/") {
  throw new Error("Codex manifest does not point at ./skills/");
}
if (codex.hooks !== "./hooks/hooks.json") {
  throw new Error("Codex manifest does not register the packaged hooks file");
}

const stop = hooks?.hooks?.Stop;
const command = stop?.[0]?.hooks?.[0]?.command;
if (stop?.[0]?.hooks?.[0]?.type !== "command" || typeof command !== "string") {
  throw new Error("Stop command hook is not registered");
}
if (!command.includes("${CODEX_PLUGIN_ROOT}") || !command.includes("hooks/stop.sh")) {
  throw new Error("Stop hook does not resolve its packaged launcher through CODEX_PLUGIN_ROOT");
}

const entry = marketplace.plugins.find((plugin) => plugin.name === expectedName);
if (!entry) throw new Error("marketplace entry is missing");
if (entry.source !== "./plugins/capability/darrow-observability-langfuse") {
  throw new Error("marketplace entry has the wrong source");
}
NODE

printf 'observability plugin package tests passed\n'
