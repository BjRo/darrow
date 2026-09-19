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
judgment as observed, preserving the native output and complete check evidence.

Resolve this file's directory and the repository root. For the first
comprehensive review run exactly:

```sh
uv run --quiet --frozen --no-dev --project "$skill_dir/../../backend" adaptive-delivery-fixture review "$repo" comprehensive independent-review-skill-contract-v1
```

After an enclosing goal repairs that comprehensive review's closed finding set,
fix-verify only those attempts and direct repair-caused regressions by running:

```sh
uv run --quiet --frozen --no-dev --project "$skill_dir/../../backend" adaptive-delivery-fixture review "$repo" verify independent-review-skill-contract-v1
```

Treat the ordinary prose response as this capability's complete, read-only
review. Return it to an enclosing goal when the goal contract requested the
review. Do not repair the change or perform the enclosing goal's next action
inside this capability. Never run a second comprehensive review, never verify
before the comprehensive invocation, and never convert an unrelated observation
into the closed convergence set.
