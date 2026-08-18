#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
review_route="$script_dir/review-route"
claude_verify="$script_dir/review-claude-verify"

fail() {
  printf 'not ok - %s\n' "$*" >&2
  exit 1
}

contains() {
  haystack=$1
  needle=$2
  case "$haystack" in
    *"$needle"*) ;;
    *) fail "expected output to contain: $needle" ;;
  esac
}

tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/darrow-review-route-test.XXXXXX")
tmp_root=$(CDPATH='' cd -- "$tmp_root" && pwd -P)
trap 'rm -rf "$tmp_root"' EXIT HUP INT TERM

repo="$tmp_root/repo"
mkdir -p "$repo"
git -C "$repo" init -q

out=$(bash "$review_route" resolve --repo "$repo" --host codex)
contains "$out" $'format\tdarrow-reviewer-route-v1'
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\txhigh'
contains "$out" $'route_source\tbundled'

out=$(bash "$review_route" resolve --repo "$repo" --host claude)
contains "$out" $'selected_route\tclaude\tanthropic\tclaude-opus-5\txhigh'
contains "$out" $'route_source\tbundled'
for provider_selector in \
  CLAUDE_CODE_USE_BEDROCK \
  CLAUDE_CODE_USE_MANTLE \
  CLAUDE_CODE_USE_VERTEX \
  CLAUDE_CODE_USE_FOUNDRY \
  CLAUDE_CODE_USE_ANTHROPIC_AWS; do
  if env "$provider_selector=1" bash "$review_route" resolve \
    --repo "$repo" --host claude >/dev/null 2>&1; then
    fail "Claude route accepted provider selector: $provider_selector"
  fi
done
if ANTHROPIC_BASE_URL=https://gateway.example bash "$review_route" resolve \
  --repo "$repo" --host claude >/dev/null 2>&1; then
  fail "Claude route accepted a custom Anthropic API endpoint"
fi
ANTHROPIC_BASE_URL=https://api.anthropic.com bash "$review_route" resolve \
  --repo "$repo" --host claude >/dev/null ||
  fail "Claude route rejected the documented direct Anthropic endpoint"

records="$tmp_root/records"
mkdir -p "$records"
codex_route_record="$records/codex-route.tsv"
out=$(bash "$review_route" select --repo "$repo" --host codex \
  --record "$codex_route_record")
contains "$out" $'record\t'"$codex_route_record"
contains "$out" $'model\tgpt-5.6-sol'
contains "$out" $'reasoning_effort\txhigh'
test -r "$codex_route_record" || fail "select did not create the Codex route record"
contains "$(<"$codex_route_record")" $'selected_route\tcodex\topenai\tgpt-5.6-sol\txhigh'
if bash "$review_route" select --repo "$repo" --host codex \
  --record "$codex_route_record" >/dev/null 2>&1; then
  fail "select overwrote an existing route record"
fi
if bash "$review_route" select --repo "$repo" --host codex \
  --record relative-route.tsv >/dev/null 2>&1; then
  fail "select accepted a relative route-record path"
fi

codex_application="$records/standards-route.tsv"
out=$(bash "$review_route" confirm-codex --route-record "$codex_route_record" \
  --axis standards --agent-id codex-child-1 \
  --application-record "$codex_application")
contains "$out" $'record\t'"$codex_application"
test -r "$codex_application" || fail "confirm-codex did not create application evidence"
contains "$(<"$codex_application")" $'requested_route\tcodex\topenai\tgpt-5.6-sol\txhigh'
contains "$(<"$codex_application")" $'route_bound\ttrue'
if grep -F $'route_verified\ttrue' "$codex_application" >/dev/null; then
  fail "Codex binding record claimed standalone route verification"
fi
contains "$(<"$codex_application")" $'axis\tstandards'
contains "$(<"$codex_application")" $'agent_id\tcodex-child-1'
if bash "$review_route" confirm-codex --route-record "$codex_route_record" \
  --axis standards --application-record "$records/missing-agent-route.tsv" \
  >/dev/null 2>&1; then
  fail "confirm-codex accepted missing native child evidence"
fi

claude_route_record="$records/claude-route.tsv"
bash "$review_route" select --repo "$repo" --host claude \
  --record "$claude_route_record" >/dev/null
out=$(bash "$review_route" claude-agent --route-record "$claude_route_record")
contains "$out" $'selected_route\tclaude\tanthropic\tclaude-opus-5\txhigh'
contains "$out" $'subagent_type\tdarrow-review:review-reader-claude-opus-5-xhigh'
contains "$out" $'model\tclaude-opus-5'
contains "$out" $'effort\txhigh'

broken_plugin="$tmp_root/broken-plugin"
mkdir -p "$broken_plugin/bin" "$broken_plugin/config"
cp "$review_route" "$broken_plugin/bin/review-route"
cp "$script_dir/reviewers-json.awk" "$broken_plugin/bin/reviewers-json.awk"
cat >"$broken_plugin/config/reviewers.json" <<'EOF'
{"reviewers":[{"host":"codex","harness":"codex","provider":"anthropic","model":"gpt-5.6-sol","effort":"xhigh"}]}
EOF
if bash "$broken_plugin/bin/review-route" resolve --repo "$repo" --host codex \
  >/dev/null 2>&1; then
  fail "provider-inconsistent bundled reviewer route was accepted"
fi

mkdir -p "$repo/.darrow"
cat >"$repo/.darrow/config.json" <<'EOF'
{
  "routes": [
    {
      "host": "codex",
      "profile": "routine",
      "harness": "codex",
      "provider": "openai",
      "model": "gpt-5.6-terra",
      "effort": "medium",
      "fallbackModel": "none",
      "fallbackEffort": "none"
    }
  ],
  "reviewers": [
    {
      "host": "codex",
      "harness": "codex",
      "provider": "openai",
      "model": "gpt-5.5",
      "effort": "xhigh"
    }
  ]
}
EOF

out=$(bash "$review_route" resolve --repo "$repo" --host codex)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.5\txhigh'
contains "$out" $'route_source\trepository'

out=$(bash "$review_route" resolve --repo "$repo" --host claude)
contains "$out" $'selected_route\tclaude\tanthropic\tclaude-opus-5\txhigh'
contains "$out" $'route_source\tbundled'

cat >"$repo/.darrow/config.json" <<'EOF'
{"reviewers":[{"host":"codex","harness":"codex","provider":"openai","model":"gpt-5.6-sol","effort":"low"}]}
EOF
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "repository reviewer policy downgraded the strong effort floor"
fi

cat >"$repo/.darrow/config.json" <<'EOF'
{"reviewers":[{"host":"codex","harness":"codex","provider":"openai","model":"gpt-5.6-terra","effort":"high"}]}
EOF
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "repository reviewer policy selected a model outside the strong catalog"
fi

cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"gpt-5.6-terra","effort":"medium","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
out=$(bash "$review_route" resolve --repo "$repo" --host codex)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\txhigh'
contains "$out" $'route_source\tbundled'

printf '%s\n' '{}' >"$repo/.darrow/config.json"
out=$(bash "$review_route" resolve --repo "$repo" --host codex)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\txhigh'
contains "$out" $'route_source\tbundled'

printf '%s\n' '{"routes":[{"note":"\u0061\n"}]}' >"$repo/.darrow/config.json"
out=$(bash "$review_route" resolve --repo "$repo" --host codex)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\txhigh'
contains "$out" $'route_source\tbundled'

printf '%s\n' '{"review\u0065rs":[]}' >"$repo/.darrow/config.json"
out=$(bash "$review_route" resolve --repo "$repo" --host codex)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\txhigh'
contains "$out" $'route_source\tbundled'

printf '%s\n' '{"reviewers":[]}' >"$repo/.darrow/config.json"
out=$(bash "$review_route" resolve --repo "$repo" --host codex)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\txhigh'
contains "$out" $'route_source\tbundled'

printf '{malformed' >"$repo/.darrow/config.json"
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "malformed reviewer configuration fell back to bundled policy"
fi
printf '{"reviewers":\f[]}\n' >"$repo/.darrow/config.json"
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "form-feed JSON whitespace was accepted"
fi
printf '{"reviewers":\v[]}\n' >"$repo/.darrow/config.json"
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "vertical-tab JSON whitespace was accepted"
fi

cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":1e,"reviewers":[{"host":"codex","harness":"codex","provider":"openai","model":"gpt-5.6-sol","effort":"xhigh"}]}
EOF
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "invalid JSON in the sibling routes section was accepted"
fi

cat >"$repo/.darrow/config.json" <<'EOF'
{"reviewers":[{"host":"codex","harness":"codex","provider":"openai","model":"one","effort":"high"},{"host":"codex","harness":"codex","provider":"openai","model":"two","effort":"high"}]}
EOF
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "duplicate reviewer routes were accepted"
fi

cat >"$repo/.darrow/config.json" <<'EOF'
{"reviewers":[{"host":"codex","harness":"claude","provider":"openai","model":"test","effort":"high"}]}
EOF
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "host-inconsistent reviewer route was accepted"
fi

cat >"$repo/.darrow/config.json" <<'EOF'
{"reviewers":[{"host":"codex","harness":"codex","provider":"anthropic","model":"gpt-5.6-sol","effort":"xhigh"}]}
EOF
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "provider-inconsistent reviewer route was accepted"
fi

rm -f "$repo/.darrow/config.json"
ln -s "$plugin_dir/config/reviewers.json" "$repo/.darrow/config.json"
if bash "$review_route" resolve --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "unsafe reviewer configuration was accepted"
fi
rm -f "$repo/.darrow/config.json"

out=$(bash "$review_route" claude-agent --provider anthropic \
  --model claude-opus-5 --effort xhigh)
contains "$out" $'format\tdarrow-review-claude-agent-v1'
contains "$out" $'selected_route\tclaude\tanthropic\tclaude-opus-5\txhigh'
contains "$out" $'subagent_type\tdarrow-review:review-reader-claude-opus-5-xhigh'
contains "$out" $'agent_file\t'"$plugin_dir/agents/review-reader-claude-opus-5-xhigh.md"

if CLAUDE_CODE_SUBAGENT_MODEL=inherit bash "$review_route" claude-agent \
  --provider anthropic --model claude-opus-5 --effort xhigh >/dev/null 2>&1; then
  fail "version-dependent inherited Claude model was accepted"
fi

out=$(bash "$review_route" claude-agent --provider anthropic \
  --model claude-sonnet-5 --effort high)
contains "$out" $'subagent_type\tdarrow-review:review-reader-claude-sonnet-5-high'

if bash "$review_route" claude-agent --provider anthropic \
  --model claude-opus-5 --effort high >/dev/null 2>&1; then
  fail "unsupported Claude reviewer tuple was accepted"
fi

if CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-5 bash "$review_route" claude-agent \
  --provider anthropic --model claude-opus-5 --effort xhigh >/dev/null 2>&1; then
  fail "conflicting Claude model override was accepted"
fi
if CLAUDE_CODE_EFFORT_LEVEL=high bash "$review_route" claude-agent \
  --provider anthropic --model claude-opus-5 --effort xhigh >/dev/null 2>&1; then
  fail "conflicting Claude effort override was accepted"
fi

projects_root="$tmp_root/projects"
repo_real=$(CDPATH='' cd -- "$repo" && pwd -P)
slug=$(printf '%s' "$repo_real" | sed 's#^/##; s#/#-#g')
session_dir="$projects_root/-$slug"
mkdir -p "$session_dir/child/subagents"
transcript="$session_dir/child/subagents/agent-readerone.jsonl"
printf '%s\n' '{"message":{"model":"claude-opus-5","role":"assistant"},"type":"assistant","effort":"xhigh","agentId":"readerone","sessionId":"parent-session"}' >"$transcript"
printf '%s\n' '{"type":"user","tool_result":{"agentId":"readerone"}}' >"$session_dir/parent.jsonl"

printf '%s\n' '{"message":{"model":"claude-sonnet-5","role":"assistant","text":"readerone"},"type":"assistant","effort":"high","session_id":"parentone"}' >>"$session_dir/parent.jsonl"

out=$(bash "$claude_verify" --repo "$repo" --agent-id readerone \
  --projects-dir "$projects_root")
contains "$out" $'format\tdarrow-review-claude-route-v1'
contains "$out" $'provider_evidence\tcurrent-host-environment-default'
contains "$out" $'observed_route\tclaude\tanthropic\tclaude-opus-5\txhigh'
relative_projects=${projects_root#"$tmp_root"/}
out=$(cd "$tmp_root" && bash "$claude_verify" --repo "$repo" \
  --agent-id readerone --projects-dir "$relative_projects")
contains "$out" $'transcript\t'"$transcript"

if bash "$claude_verify" --repo "$repo" --agent-id reader \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail "Claude route verification accepted a substring-only agent match"
fi

partial_transcript="$session_dir/child/subagents/agent-readerpartial.jsonl"
printf '%s\n' '{"message":{"model":"claude-opus-5","role":"assistant"},"type":"assistant","effort":"xhigh","agentId":"readerpartial","sessionId":"parent-session"}' >"$partial_transcript"
printf '%s\n' '{"message":{"model":"claude-opus-5","role":"assistant"},"type":"assistant","agentId":"readerpartial","sessionId":"parent-session"}' >>"$partial_transcript"
if bash "$claude_verify" --repo "$repo" --agent-id readerpartial \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail "Claude route verification accepted a partially observed transcript"
fi

malformed_transcript="$session_dir/child/subagents/agent-readermalformed.jsonl"
printf '%s\n' '{"message":{"model":"claude-opus-5","role":"assistant"},"type":"assistant","effort":"xhigh","agentId":"readermalformed"' >"$malformed_transcript"
if bash "$claude_verify" --repo "$repo" --agent-id readermalformed \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail "Claude route verification accepted malformed JSONL evidence"
fi

observed_record="$records/standards-observed-route.tsv"
out=$(bash "$claude_verify" --repo "$repo" --agent-id readerone \
  --projects-dir "$projects_root" --record "$observed_record")
contains "$out" $'record\t'"$observed_record"
test -r "$observed_record" || fail "Claude verifier did not create observed-route evidence"
contains "$(<"$observed_record")" $'observed_route\tclaude\tanthropic\tclaude-opus-5\txhigh'
contains "$(<"$observed_record")" $'provider_evidence\tcurrent-host-environment-default'
if CLAUDE_CODE_USE_VERTEX=1 bash "$claude_verify" --repo "$repo" \
  --agent-id readerone --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail "Claude transcript verification manufactured Anthropic provider evidence under Vertex"
fi

claude_application="$records/spec-route.tsv"
out=$(bash "$review_route" confirm-claude --route-record "$claude_route_record" \
  --observed-record "$observed_record" --axis spec \
  --application-record "$claude_application")
contains "$out" $'record\t'"$claude_application"
test -r "$claude_application" || fail "confirm-claude did not create application evidence"
contains "$(<"$claude_application")" $'observed_route\tclaude\tanthropic\tclaude-opus-5\txhigh'
contains "$(<"$claude_application")" $'provider_evidence\tcurrent-host-environment-default'
contains "$(<"$claude_application")" $'route_bound\ttrue'
contains "$(<"$claude_application")" $'axis\tspec'
contains "$(<"$claude_application")" $'agent_id\treaderone'

mismatched_observed="$records/mismatched-observed.tsv"
sed 's/claude-opus-5/claude-sonnet-5/' "$observed_record" >"$mismatched_observed"
mismatched_application="$records/mismatched-route.tsv"
if bash "$review_route" confirm-claude --route-record "$claude_route_record" \
  --observed-record "$mismatched_observed" \
  --axis spec --application-record "$mismatched_application" >/dev/null 2>&1; then
  fail "confirm-claude accepted substituted transcript evidence"
fi
test ! -e "$mismatched_application" || fail "failed confirmation left partial evidence"

missing_provider_observed="$records/missing-provider-observed.tsv"
sed '/^provider_evidence	/d' "$observed_record" >"$missing_provider_observed"
if bash "$review_route" confirm-claude --route-record "$claude_route_record" \
  --observed-record "$missing_provider_observed" \
  --axis spec --application-record "$records/missing-provider-route.tsv" \
  >/dev/null 2>&1; then
  fail "confirm-claude accepted observed evidence without provider provenance"
fi

no_effort_transcript="$session_dir/child/subagents/agent-readernoeffort.jsonl"
printf '%s\n' '{"message":{"model":"claude-opus-5","role":"assistant"},"type":"assistant","agentId":"readernoeffort","sessionId":"parent-session"}' >"$no_effort_transcript"
if bash "$claude_verify" --repo "$repo" --agent-id readernoeffort \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail "Claude route verification accepted missing effort evidence"
fi

mixed_transcript="$session_dir/child/subagents/agent-readermixed.jsonl"
printf '%s\n' '{"message":{"model":"claude-opus-5","role":"assistant"},"type":"assistant","effort":"xhigh","agentId":"readermixed","sessionId":"parent-session"}' >"$mixed_transcript"
printf '%s\n' '{"message":{"model":"claude-sonnet-5","role":"assistant"},"type":"assistant","effort":"xhigh","agentId":"readermixed","sessionId":"parent-session"}' >>"$mixed_transcript"
if bash "$claude_verify" --repo "$repo" --agent-id readermixed \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail "Claude route verification accepted inconsistent model evidence"
fi

printf 'ok - reviewer route mechanics\n'
