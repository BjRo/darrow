---
name: independent-code-review
description: Independently review one exact current code change and report its findings and outcome. Use when an explicit goal contract requires independent review before completion or publication. Remain read-only and do not repair, commit, push, publish, approve, merge, release, or deploy.
---

# Independently review the current change

Accept the originating acceptance criteria, repository standards, current check
evidence and candidate scope. You are the provider coordinator in the fresh
context supplied by verification. This deterministic fixture stands in for
independent Standards and Acceptance judgments. It does no implementation or
repair. Missing or stale required evidence cannot pass. Follow-up preserves
original findings, disposition,
target and repair history and direct-regression lineage; only the closed set is
assessed. Return clear, material progress, unchanged failure or unavailable
judgment as observed, preserving its meaning and complete check evidence.

Resolve this file's directory and the repository root. Use `comprehensive` for
the first assessment and `verify` for closed follow-up after owner repairs.
Never restart comprehensive review or verify before the original assessment.

Launch separate fresh Standards and Acceptance readers with their axis, this
absolute skill directory, repository, candidate, acceptance, constraints, checks
and closed history when applicable. On Codex use native `spawn_agent` with
`fork_turns: "none"`, `model: "gpt-6.1-sol"` and `reasoning_effort: "xhigh"`
for both. On Claude use fresh native Agent contexts pinned to Opus/high. Keep
the caller's provider-coordinator route unchanged. Start both before waiting.
Each reader runs this bounded read-only command once and returns its complete
output; readers do not coordinate another review, launch agents or save reports:

```sh
uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-goal-fixture review-preview "$repo" "$mode" independent-review-skill-contract-v1
```

Require both complete reader results to name the same current target and
outcome. Missing, failed, stale or conflicting results return unavailable;
never fill in a missing reader result yourself. After both return, record one
canonical assessment as coordinator, passing their literal shared target:

```sh
uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-goal-fixture review "$repo" "$mode" independent-review-skill-contract-v1 "$reader_target"
```

The helper refuses a changed candidate and preserves the closed history.
Preserve any unavailable or inconclusive canonical outcome, including mutation
during assessment. Return a faithful inline explanation of the outcome, assessed
scope, actionable findings and their blocking or advisory disposition, and material limitations.
For follow-up, distinguish resolved, unresolved and blocked findings and direct
regressions. Include the absolute complete-report path emitted by the command.
The saved report preserves the full original findings, targets, history and
evidence references; those details need not be copied into every message.
Keep that report unchanged and accessible to the caller. A generic verdict or
report path alone does not replace the inline explanation. Exact wording and
verbatim copying are not required.

Return this result to the enclosing caller when it requested review. Do not
repair the change or perform the enclosing goal's next action
inside this capability. Never convert an unrelated observation into the closed
convergence set.
