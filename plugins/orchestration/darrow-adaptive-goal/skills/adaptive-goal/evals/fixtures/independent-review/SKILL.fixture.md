---
name: independent-code-review
description: Independently review one exact current code change and report its findings and outcome. Use when an explicit goal contract requires independent review before completion or publication. Remain read-only and do not repair, commit, push, publish, approve, merge, release, or deploy.
---

# Independently review the current change

Accept the originating acceptance criteria, repository standards, current check
evidence and candidate scope. This deterministic fixture stands in for a fresh
independent standards and acceptance assessment. Invoke it in a fresh assessment
context with no implementation discussion; when composed, verification supplies
that bounded context. It does no implementation or repair. Missing or stale
required evidence cannot pass. Follow-up preserves original findings, disposition,
target and repair history and direct-regression lineage; only the closed set is
assessed. Return clear, material progress, unchanged failure or unavailable
judgment as observed, preserving its meaning and complete check evidence.

Resolve this file's directory and the repository root. For the first
comprehensive review run exactly:

```sh
uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-goal-fixture review "$repo" comprehensive independent-review-skill-contract-v1
```

After an enclosing goal repairs that comprehensive review's closed finding set,
fix-verify only those attempts and direct repair-caused regressions by running:

```sh
uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-goal-fixture review "$repo" verify independent-review-skill-contract-v1
```

Return a faithful inline explanation of the outcome, assessed scope, actionable
findings and their blocking or advisory disposition, and material limitations.
For follow-up, distinguish resolved, unresolved and blocked findings and direct
regressions. Include the absolute complete-report path emitted by the command.
The saved report preserves the full original findings, targets, history and
evidence references; those details need not be copied into every message.
Keep that report unchanged and accessible to the caller. A generic verdict or
report path alone does not replace the inline explanation. Exact wording and
verbatim copying are not required.

Return this result to the enclosing caller when it requested review. Do not
repair the change or perform the enclosing goal's next action
inside this capability. Never run a second comprehensive review, never verify
before the comprehensive invocation, and never convert an unrelated observation
into the closed convergence set.
