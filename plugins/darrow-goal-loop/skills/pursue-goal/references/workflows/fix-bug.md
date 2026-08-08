# Fix bug

Use this workflow when existing observable behavior is incorrect or a check
reproduces a defect.

## Sequence

1. Reproduce the failure at the narrowest stable public seam.
2. Establish the cause before changing production behavior.
3. Add regression evidence that fails for the diagnosed reason.
4. Make the smallest complete fix while preserving adjacent behavior.
5. Rerun the reproducer, affected tests, and the repository's scoped gate.

Do not turn an unreproduced symptom into an opportunistic refactor. If the
desired behavior is itself new or intentionally changing, select the feature
workflow that matches that contract instead.
