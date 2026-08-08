# Fix bug

Execute the selected bug-fix contract through this sequence.

## Sequence

1. Reproduce the failure at the narrowest stable public seam.
2. Establish the cause before changing production behavior.
3. Add regression evidence that fails for the diagnosed reason.
4. Make the smallest complete fix while preserving adjacent behavior.
5. Rerun the reproducer, affected tests, and the repository's scoped gate.
