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

Read the advertised independent-code-review instructions. The fixture mechanics
execute that deterministic provider in this bounded assessment context, then
collect the selected QA-like result. Run exactly:

```sh
uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-delivery-fixture verification "$repo" initial
```

For follow-up, require the complete original/prior results, finding identities,
provider provenance, blocking/advisory disposition, target and repair history,
and direct-regression lineage. In a fresh assessment context run:

```sh
uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-delivery-fixture verification "$repo" follow-up
```

Return the complete candidate-bound report, including both selected results,
every criterion's evidence and the combined clear/progress/no-progress/blocked
conclusion. Wait for the command's complete response. Do not repair or start a
new comprehensive assessment. The caller owns the shared budget and completion.
This fixture does not implement the future production QA capability.
