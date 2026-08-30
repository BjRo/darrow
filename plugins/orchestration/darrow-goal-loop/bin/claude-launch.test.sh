#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
resolver="$script_dir/claude-agent-route"
observer="$script_dir/claude-owner-route"
skill="$plugin_dir/skills/adaptive-goal/SKILL.md"
guide="$plugin_dir/skills/adaptive-goal/references/claude-launch.md"

fail() {
  printf 'not ok - %s\n' "$*" >&2
  exit 1
}

contains() {
  case "$1" in
    *"$2"*) ;;
    *) fail "expected output to contain: $2" ;;
  esac
}

out=$(bash "$resolver" --provider anthropic --model claude-sonnet-5 --effort low)
contains "$out" $'subagent_type\tdarrow-goal-loop:adaptive-goal-sonnet-5-low'
out=$(bash "$resolver" --provider anthropic --model claude-sonnet-5 --effort medium)
contains "$out" $'subagent_type\tdarrow-goal-loop:adaptive-goal-sonnet-5-medium'
out=$(bash "$resolver" --provider anthropic --model claude-opus-5 --effort high)
contains "$out" $'subagent_type\tdarrow-goal-loop:adaptive-goal-opus-5-high'

if bash "$resolver" --provider anthropic --model claude-opus-5 --effort low \
  >/dev/null 2>&1; then
  fail "unsupported Claude route resolved"
fi
if CLAUDE_CODE_EFFORT_LEVEL=high bash "$resolver" --provider anthropic \
  --model claude-sonnet-5 --effort low >/dev/null 2>&1; then
  fail "conflicting Claude effort override was accepted"
fi
if CLAUDE_CODE_USE_VERTEX=1 bash "$resolver" --provider anthropic \
  --model claude-sonnet-5 --effort low >/dev/null 2>&1; then
  fail "non-Anthropic provider selector was accepted"
fi

tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/darrow-claude-owner-route.XXXXXX")
trap 'rm -rf "$tmp_root"' EXIT HUP INT TERM
repo="$tmp_root/repo.with_under_score"
projects="$tmp_root/projects"
mkdir -p "$repo" "$projects"
repo=$(CDPATH='' cd -- "$repo" && pwd -P)
project_key=$(printf '%s' "$repo" | sed 's/[^A-Za-z0-9]/-/g')
session_dir="$projects/$project_key/session/subagents"
mkdir -p "$session_dir"
transcript="$session_dir/agent-ownerone.jsonl"
printf '%s\n' \
  '{"type":"assistant","agentId":"ownerone","effort":"low","message":{"role":"assistant","model":"claude-sonnet-5"}}' \
  >"$transcript"
out=$(bash "$observer" --repo "$repo" --agent-id ownerone \
  --selected-model claude-sonnet-5 --selected-effort low \
  --projects-dir "$projects")
contains "$out" $'observed_route\tclaude\tanthropic\tclaude-sonnet-5\tlow'
contains "$out" $'confirmation\tconfirmed'
if bash "$observer" --repo "$repo" --agent-id ownerone \
  --selected-model claude-opus-5 --selected-effort high \
  --projects-dir "$projects" >/dev/null 2>&1; then
  fail "substituted Claude owner route was accepted"
fi

grep -F -- '- phase: adaptive-goal-owner' "$skill" >/dev/null ||
  fail "skill omitted the owner marker"
grep -F -- 'Invoke the resolved Agent exactly once' "$guide" >/dev/null ||
  fail "Claude guide omitted the one-Agent boundary"
grep -F -- 'claude-owner-route' "$guide" >/dev/null ||
  fail "Claude guide omitted effective-route verification"
grep -F -- 'use Claude' "$guide" >/dev/null ||
  fail "Claude guide omitted same-owner feedback transport"

if grep -E 'goal-loop step|Protocol ledger|claude-route-gate|materialize-objective|darrow-native-goal-report' \
  "$skill" "$guide" "$plugin_dir"/agents/adaptive-goal-*.md >/dev/null; then
  fail "Claude launch surface retained removed lifecycle protocol"
fi

printf 'ok - Claude separate-owner launch contract\n'
