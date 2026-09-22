---
name: assess-implementation-readiness
description: Assess readiness of an authoritative request, including reassessment of affected assumptions during implementation. Remain read-only and return the assessment to the invoking agent.
---

# Assess implementation readiness

Resolve this file's directory as `skill_dir` and the repository root as `repo`.
Run `uv run --quiet --no-project "$skill_dir/../../backend/scripts/run_locked.py" adaptive-delivery-fixture readiness "$repo"`.
Return its complete assessment to the invoking agent. Do not implement the
request or transfer execution to another agent inside this capability.
