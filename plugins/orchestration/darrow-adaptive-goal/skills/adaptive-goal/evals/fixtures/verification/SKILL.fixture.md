---
name: assess-candidate
description: Observe the selected QA-like cache criterion for an exact candidate, retaining already completed independent Review evidence. Return current observations or gaps; never coordinate Review, repair, publish or own acceptance.
---

# Observe the cache criterion

This deterministic fixture observes CACHE_SIZE = 5 after the main thread has
obtained independent Review through that provider's complete public workflow.
It supplies no readers and does not launch Review or another coordinator. The
main thread owns criterion coverage, combined conclusions and repair accounting.

Accept repository, current candidate, originating criteria, successful checks,
mode and the complete already-returned current Review report. Read that report;
missing, unavailable or stale evidence remains blocked. For follow-up require
original/prior results, finding identities, dispositions, targets, attempted
repairs and direct-regression lineage. Do not reconstruct or reset history.

Use `initial` for the first observation or `follow-up` after owner repair:

```sh
uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-goal-fixture verification "$repo" "$mode" "$review_report"
```

Wait for its complete response and return it unchanged as fixture evidence. The
helper mechanically retains candidate-bound Review and QA observations and their
history; its conclusion cannot replace the owner's coverage of all originating
criteria. Do not launch review, supply missing judgments, repair, or reopen the
original finding set. This is an eval fixture, not a production QA capability.
