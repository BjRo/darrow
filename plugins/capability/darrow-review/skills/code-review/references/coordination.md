# Place coordination

Decide where this review's coordination runs before preparing reader inputs.
The rule is the same for initial reviews and fix verification.

## Ask the placement helper

Run the helper with the host you are running in. A shell with
`CODEX_THREAD_ID` set runs on Codex; one with `CLAUDECODE=1` runs on Claude
Code. A prompt's description of another host or route does not change this.

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-route place \
  --host <codex|claude>
```

The helper reads this session's actual model and effort from the host
transcript, compares them with the supported floor (`gpt-6.1-sol/medium` or
`claude-sonnet-5-5/medium`, or higher effort on the same model) and returns
`placement`:

- `inline`: run this workflow here. Readers still start fresh.
- `fallback`: launch one fallback coordinator, wait for its complete result and
  return it.

A helper refusal, a rejected launch or readers that cannot run return blocked
with the actual diagnostic. Never review the change yourself.

## Launch the fallback coordinator

Give it the absolute path of this `SKILL.md`, the repository, scope, originating
requirement, checks to run, constraints and any closed fix-verification
history. State that it is the fallback coordinator and must run inline.

- **Codex:** call `spawn_agent` with `fork_turns: "none"`,
  `model: "gpt-6.1-sol"`, `reasoning_effort: "medium"` and a unique lowercase
  `task_name` that contains neither `standards` nor `spec`. Then call
  `wait_agent` for that child, repeating until it completes or fails. Do not
  answer while it is still running. The child's own helper call observes its
  supported route and places it inline.
- **Claude:** refuse a conflicting nonempty `CLAUDE_CODE_SUBAGENT_MODEL` or
  `CLAUDE_CODE_EFFORT_LEVEL`. Then call Agent with `run_in_background: false`,
  no model override and the scoped agent
  `darrow-review:assessment-coordinator-sonnet-5-5-medium`. The call returns
  when the coordinator finishes. Only that pinned agent passes
  `--pinned-fallback-agent` to the helper, because a Claude subagent cannot
  observe its own route.

## Return the result

The fallback's complete result is this operation's result. Do not repeat its
coordination or finalization. Standalone use returns it unchanged. In an
enclosing goal, return it to that owner, which continues its own delivery.
