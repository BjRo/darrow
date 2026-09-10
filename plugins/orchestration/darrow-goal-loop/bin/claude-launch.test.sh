#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
resolver="$script_dir/claude-agent-route"
skill="$plugin_dir/skills/adaptive-delivery/SKILL.md"
guide="$plugin_dir/skills/adaptive-delivery/references/claude-launch.md"

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
contains "$out" $'subagent_type\tdarrow-goal-loop:adaptive-delivery-sonnet-5-low'
out=$(bash "$resolver" --provider anthropic --model claude-sonnet-5 --effort medium)
contains "$out" $'subagent_type\tdarrow-goal-loop:adaptive-delivery-sonnet-5-medium'
out=$(bash "$resolver" --provider anthropic --model claude-opus-5 --effort high)
contains "$out" $'subagent_type\tdarrow-goal-loop:adaptive-delivery-opus-5-high'

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

grep -F -- '- phase: adaptive-delivery-owner' "$skill" >/dev/null ||
  fail "skill omitted the owner marker"
grep -F -- 'Invoke the resolved Agent exactly once' "$guide" >/dev/null ||
  fail "Claude guide omitted the one-Agent boundary"
grep -F -- 'use Claude' "$guide" >/dev/null ||
  fail "Claude guide omitted same-owner feedback transport"
if grep -F -- 'claude-owner-route' "$skill" "$guide" \
  "$plugin_dir"/agents/adaptive-delivery-*.md >/dev/null; then
  fail "Claude launch surface retained parent-side route observation"
fi

if grep -E 'goal-loop step|Protocol ledger|claude-route-gate|materialize-objective|darrow-native-goal-report|- phase: human-feedback-(request|response)' \
  "$skill" "$guide" "$plugin_dir"/agents/adaptive-delivery-*.md >/dev/null; then
  fail "Claude launch surface retained removed lifecycle protocol"
fi

printf 'ok - Claude separate-owner launch contract\n'
