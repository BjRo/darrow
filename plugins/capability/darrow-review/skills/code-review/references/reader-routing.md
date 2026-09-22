# Reviewer route application

Resolve and prove one concrete reviewer route before accepting any fresh
reader result. Apply the same selected route to Standards, Spec, and every
fix-verification reader in one invocation.

## Resolve the policy

Resolve the bundled helper from the code-review skill directory:

```sh
route_record="$(dirname "$manifest")/reviewer-route.tsv"
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-route select --repo "$repo" --host <codex|claude> \
  --record "$route_record"
```

Use the current runtime as the host value. The helper writes one concrete route
record and returns the native launch fields separately. Use the returned
`model` and `reasoning_effort` on Codex. Do not parse the record, construct a
route tuple, redirect helper output, infer, inherit, shorten, alias, or replace
any field. A nonzero command, unreadable record, unresolved value, or provider
that the current runtime cannot apply blocks every otherwise-available reader
before invocation. Never fall back to the coordinator model.

The resolver binds Codex to the OpenAI provider and Claude to the Anthropic
provider. For Codex, an accepted native spawn therefore proves the provider as
well as explicit model and effort; configuration alone never establishes an
effective provider.

Keep `reviewer-route.tsv` beside the scope manifest as route-selection
evidence. Repository configuration comes only from the active worktree root.

## Codex readers

For every applicable axis, use `spawn_agent` with:

- `fork_turns` set to `none` so the context is fresh and route overrides apply;
- `model` set to the exact selected model;
- `reasoning_effort` set to the exact selected effort;
- a distinct bounded task name containing the exact axis token (`standards` or
  `spec`) and not the opposite axis token; and
- a message beginning with `- review_axis: <axis>` followed by only that axis's
  fully substituted prompt.

When two axes apply, issue both spawn calls before waiting for either. An
accepted spawn with all explicit route fields is application evidence. Wait for
each exact child, collect only its final axis record, and then write that axis's
route evidence beside the manifest:

```sh
axis_route="$(dirname "$manifest")/<axis>-route.tsv"
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-route confirm-codex --route-record "$route_record" \
  --axis <axis> --agent-id '<host-reported-child-id>' \
  --application-record "$axis_route"
```

Use only the child ID returned by the accepted native spawn. If the spawn
surface rejects the model or effort, returns no child ID, the child fails to
finish, or route confirmation fails, discard any returned judgment and bind
that axis as blocked. Do not retry on an inherited or substitute route.
Treat a canonical child reference returned in a host response field named
`task_name` as the child ID; it is distinct from the requested bounded task
label. Never promote the requested label itself into an ID.
When no child ID is returned, do not call `wait`, `wait_agent`, or any other
join operation for that axis. Do not use a plausible same-context finding as a
stand-in for the missing child. Proceed directly to the blocked axis record and
mechanical aggregation.
The retained native launch batch from the first bound spawn through the first
wait must contain exactly the bound axes and no additional spawn.

The application record proves only that the selected tuple, axis, and supplied
child ID are internally consistent. It is not launch evidence by itself. A
Codex result is admissible only while the coordinator also retains the host's
accepted `spawn_agent` event for that same child ID, exact model and effort,
`fork_turns: none`, and a host-visible axis marker in the native task name or
retained prompt. `confirm-codex` therefore writes a `route_bound<TAB>true`
binding record, never a standalone verification claim. Missing native evidence
still blocks the axis.

## Claude readers

Current Claude Code uses the plugin reader's full model and effort frontmatter
as one exact tuple. Resolve that exact-tuple reader before invoking Agent:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-route claude-agent --route-record "$route_record"
```

Use the returned namespaced `subagent_type`. The exact selected full model and
effort are pinned together in that plugin agent's frontmatter. Invoke Agent in
the foreground with that type, `run_in_background` set to `false`, no
per-invocation `model` override, and a prompt beginning with
`- review_axis: <axis>` followed by only the fully substituted axis prompt.
Start every applicable reader before waiting so
Standards and Spec remain parallel and isolated. On Claude, emit both
foreground Agent tool calls in the same assistant turn; a background or later
sequential Agent call is not parallel application evidence.
That retained turn through the first child result must contain exactly the
bound axes and no additional Agent call.

The helper rejects conflicting `CLAUDE_CODE_SUBAGENT_MODEL` and
`CLAUDE_CODE_EFFORT_LEVEL` values. It also blocks the Anthropic-only route when
the current host environment selects Bedrock, Mantle, Vertex, Foundry, Claude
Platform on AWS, or a custom API endpoint. The
transcript verifier repeats that provider observation after the child exits. A
current host that rejects the full model ID or exact-tuple reader is
unavailable; do not retry with a per-call alias,
inherited model, different effort, generic agent, or nested Claude process.

After each exact Agent call terminates, take its host-reported agent ID and
derive the effective route from that child's transcript:

```sh
observed_record="$(dirname "$manifest")/<axis>-observed-route.tsv"
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-claude-verify --repo "$repo" --agent-id '<agent-id>' \
  --record "$observed_record"
```

Feed both record paths into the confirmation gate. The helper parses and
compares the selected and transcript-observed values:

```sh
axis_route="$(dirname "$manifest")/<axis>-route.tsv"
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-route confirm-claude --route-record "$route_record" \
  --observed-record "$observed_record" --axis <axis> \
  --application-record "$axis_route"
```

Missing transcript evidence, missing effort, multiple observed values, model
substitution, or any selected/observed mismatch blocks the axis and discards
its judgment even when Agent returned a syntactically valid record. Prompt
text, agent frontmatter, Agent acceptance, and self-report are not effective
route evidence. The retained native parent event must also bind the current
Agent tool-use ID to that same host-reported child ID; a matching stale child
transcript is insufficient.

## Bind route failure

In comprehensive mode, materialize a schema-valid axis record with
`status<TAB>blocked` and a `source` naming the exact route evidence gap. In
fix-verification mode, materialize a schema-valid fix-axis record containing an
`evidence_gap` naming it. Preserve the selected route record and any observed
route record. Never replace unavailable independent judgment with coordinator
analysis.

An unavailable selected route permits zero native reader-launch attempts;
inherited, substituted, generic, background, and otherwise unbound retries all
invalidate the blocked result.

Route application is complete only when every invoked reader has its own
validated route-application record and schema-valid axis record for the same
pinned scope. Each application record names that axis and its distinct
host-reported child ID. The coordinator never parses or serializes a route
artifact.
