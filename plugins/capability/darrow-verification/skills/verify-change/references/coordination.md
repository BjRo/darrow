# Place coordination

Decide where this assessment's coordination runs before checks or assessment.
The rule is the same for initial assessments and closed follow-ups.

## Ask the placement helper

Run this plugin's helper with the host you are running in. A shell with
`CODEX_THREAD_ID` set runs on Codex; one with `CLAUDECODE=1` runs on Claude
Code. A prompt's description of another host or route does not change this.
Use the backend bound in skill step 2:

```text
uv run --quiet --no-project "<absolute-backend-path>/scripts/run_locked.py" --isolated darrow-verify-placement --host <codex|claude>
```

The helper reads this session's actual model and effort from the host
transcript, compares them with the supported floor (`gpt-6.1-sol/medium` or
`claude-sonnet-5-5/medium`, or higher effort on the same model) and returns
`placement`:

- `inline`: run this workflow and the bound provider's workflow here. Readers
  still start fresh.
- `fallback`: launch one fallback coordinator, wait for its complete result and
  return it.

A helper refusal, a rejected launch or readers that cannot run return blocked
with the actual diagnostic. Never assess the change yourself.

## Launch the fallback coordinator

Give it the absolute path of this `SKILL.md`, the review binding, repository,
candidate, scope and base, objective and every criterion, constraints,
successful checks and any closed follow-up history. State that it is the
fallback coordinator, must run inline and must end with step 5's complete
rendered output as its final message.

- **Codex:** call `spawn_agent` with `fork_turns: "none"`,
  `model: "gpt-6.1-sol"`, `reasoning_effort: "medium"` and a unique lowercase
  `task_name` that contains neither `standards` nor `spec`. Then call
  `wait_agent` for that child, repeating until it completes or fails. Do not
  answer while it is still running. The child's own helper call observes its
  supported route and places it inline.
- **Claude:** refuse a conflicting nonempty `CLAUDE_CODE_SUBAGENT_MODEL` or
  `CLAUDE_CODE_EFFORT_LEVEL`. Then call Agent with `run_in_background: false`,
  no model override and the scoped agent
  `darrow-verification:assessment-coordinator-sonnet-5-5-medium`. The call
  returns when the coordinator finishes. Only that pinned agent passes
  `--pinned-fallback-agent` to the helper, because a Claude subagent cannot
  observe its own route.

## Return the result

The fallback's final message already includes reconciliation and rendering.
Do not repeat any step in this context. Standalone use copies that message
verbatim as the entire final response, ending with its
`Complete provider result:` line; never summarize or reformat it. In an
enclosing goal, return it to that owner, which continues its own delivery.
