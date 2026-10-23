---
name: assess-candidate
description: Coordinate acceptance verification of an implementation candidate through compatible independent code review and selected assessment providers. Use for initial assurance and targeted follow-up across original findings; never implement, repair, publish or control the enclosing goal.
---

# Assess a candidate

This bounded composition fixture supports the advertised independent-code-review
provider plus an explicitly selected QA-like cache assessment. Require compatible
review; neither provider owns repairs or continuation. The caller supplies the
repository, candidate, acceptance, constraints, successful current checks,
selection and initial or closed-follow-up mode. Missing required evidence blocks.

Delegate the advertised independent-code-review workflow to a fresh provider
coordinator, carrying the repository, candidate, acceptance, constraints, current
successful checks and assessment mode. On Codex use `spawn_agent` with
`fork_turns: "none"`, `model: "gpt-6-luna"` and `reasoning_effort: "medium"`.
The provider owns its independent readers and canonical report; do not execute
review yourself. Wait for its complete result, read the supplied absolute report,
and preserve any missing, unavailable or stale evidence as blocked.

For initial assessment request comprehensive review. Then combine its complete
canonical report with the selected QA-like result:

```sh
uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-goal-fixture verification "$repo" initial "$review_report"
```

For follow-up, require the complete original/prior results, finding identities,
provider provenance, blocking/advisory disposition, target and repair history,
and direct-regression lineage. Delegate closed fix verification to a fresh review
provider coordinator with that complete history. After it returns and its report
has been read, run:

```sh
uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-goal-fixture verification "$repo" follow-up "$review_report"
```

Return the complete candidate-bound report, including both selected results,
every criterion's evidence and the combined clear/progress/no-progress/blocked
conclusion. Wait for the command's complete response. Do not repair or start a
new comprehensive assessment. The caller owns the shared budget and completion.
This fixture does not implement the future production QA capability.
