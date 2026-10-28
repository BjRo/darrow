# Launch Claude Code readers

Use this reference for step 3 on Claude Code, after scope, checks, route and every
applicable input are prepared. Resolve the selected exact-tuple plugin reader:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-route claude-agent \
  --route-record '<run>/reviewer-route.json'
```

Invoke Agent with the returned namespaced `subagent_type`, `run_in_background:
false`, no per-call model override, and the complete unchanged preparation
`message` as its prompt. The plugin agent pins full model and effort together.
Emit both applicable foreground calls in the same assistant turn. That turn
through the first child result contains exactly those axes and no additional
Agent call. Background or later sequential launches do not satisfy the boundary.

The helpers refuse conflicting host/provider overrides. Preserve an unavailable
tuple's diagnostic through [review-recovery.md](review-recovery.md), without
substituting an alias, inherited route, generic agent or nested Claude process.

After each Agent call terminates, use its host-reported agent ID to observe the
route on every assistant turn in that child's transcript:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-claude-verify \
  --repo "$repo" --agent-id '<accepted-agent-id>' --record '<run>/<axis>-observed-route.json'
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-route confirm-claude \
  --route-record '<run>/reviewer-route.json' --observed-record '<run>/<axis>-observed-route.json' \
  --axis <standards|spec> --application-record '<run>/<axis>-route.json'
```

The retained native parent event must also bind the current Agent tool-use ID
to that same child ID. A stale matching transcript, frontmatter, acceptance or
self-report cannot establish an effective route. Missing/inconsistent evidence
blocks the axis even when Agent returns valid JSON.

Save the complete reader JSON unchanged at its returned `reader_record` path
and return to step 4. For one diagnostic correction, follow
[reader-inputs.md](reader-inputs.md). Reverify the continued child's transcript
with new observed/application filenames before accepting its corrected record.
Continuation of the existing Claude reader runs in the background with its
existing tools; this differs from a new background Agent launch. An unavailable
or unverifiable continuation leaves the axis blocked.
